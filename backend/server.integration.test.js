const assert = require('node:assert/strict');
const { after, before, describe, it } = require('node:test');
const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');
const app = require('./server');
const db = require('./db');

const TEST_PASSWORD = 'TestPass123!';
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'password123',
  database: process.env.DB_NAME || 'tile_pattern_generator',
};

let server;
let baseUrl;
let connection;
const testUsers = {};
const createdLayoutIds = [];

function uniqueValue(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};

  return { response, body };
}

function jsonHeaders(token) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

async function createTestUser(role = 'user') {
  const username = uniqueValue(`cs233_${role}`);
  const email = `${username}@example.com`;
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 12);
  const [result] = await connection.execute(
    `
      INSERT INTO users (
        username,
        username_normalized,
        email,
        email_normalized,
        password_hash,
        role
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    [username, username.toLowerCase(), email, email, passwordHash, role],
  );

  return {
    id: result.insertId,
    username,
    email,
    password: TEST_PASSWORD,
    role,
  };
}

async function ensureLayoutFavoriteColumn() {
  const [columns] = await connection.execute(
    `
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'layouts'
        AND COLUMN_NAME = 'is_favorite'
      LIMIT 1
    `,
  );

  if (columns.length === 0) {
    await connection.execute(
      'ALTER TABLE layouts ADD COLUMN is_favorite BOOLEAN NOT NULL DEFAULT FALSE',
    );
  }
}

async function login(user) {
  const { response, body } = await request('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: user.username,
      password: user.password,
    }),
  });

  assert.equal(response.status, 200);
  assert.equal(body.id, user.id);
  assert.equal(body.role, user.role);
  assert.ok(body.token);
  return body;
}

describe('backend integration routes', () => {
  before(async () => {
    connection = await mysql.createConnection(dbConfig);
    await ensureLayoutFavoriteColumn();
    testUsers.userA = await createTestUser('user');
    testUsers.userB = await createTestUser('user');
    testUsers.admin = await createTestUser('admin');

    server = app.listen(0);
    await new Promise((resolve) => {
      server.once('listening', resolve);
    });
    const { port } = server.address();
    baseUrl = `http://127.0.0.1:${port}`;
  });

  after(async () => {
    const userIds = [testUsers.userA?.id, testUsers.userB?.id, testUsers.admin?.id]
      .filter(Boolean);

    if (connection && userIds.length > 0) {
      if (createdLayoutIds.length > 0) {
        const placeholders = createdLayoutIds.map(() => '?').join(', ');
        await connection.execute(
          `DELETE FROM layouts WHERE id IN (${placeholders})`,
          createdLayoutIds,
        );
      }

      const placeholders = userIds.map(() => '?').join(', ');
      await connection.execute(
        `DELETE FROM layouts WHERE userId IN (${placeholders})`,
        userIds,
      );
      await connection.execute(
        `DELETE FROM users WHERE id IN (${placeholders})`,
        userIds,
      );
      await connection.end();
    }

    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }

    await new Promise((resolve) => db.end(resolve));
  });

  it('logs in a created test user', async () => {
    await login(testUsers.userA);
  });

  it('rejects protected layout access without a bearer token', async () => {
    const { response, body } = await request(
      `/users/${testUsers.userA.id}/layouts`,
    );

    assert.equal(response.status, 401);
    assert.equal(body.error, 'Authentication required.');
  });

  it('allows an authenticated user to create, read, and delete their layout', async () => {
    const session = await login(testUsers.userA);
    const layoutName = uniqueValue('Integration Layout');
    const layout = {
      version: 2,
      cells: [{ id: 1, tileId: null, rotation: 0 }],
      columns: 1,
      rows: 1,
    };

    const createResult = await request(`/users/${testUsers.userA.id}/layouts`, {
      method: 'POST',
      headers: jsonHeaders(session.token),
      body: JSON.stringify({ name: layoutName, layout }),
    });

    assert.equal(createResult.response.status, 201);
    assert.ok(createResult.body.id);
    createdLayoutIds.push(createResult.body.id);

    const readResult = await request(`/users/${testUsers.userA.id}/layouts`, {
      headers: jsonHeaders(session.token),
    });

    assert.equal(readResult.response.status, 200);
    const createdLayout = readResult.body.find(
      (savedLayout) =>
        savedLayout.id === createResult.body.id &&
        savedLayout.name === layoutName,
    );
    assert.ok(createdLayout);
    assert.equal(createdLayout.isFavorite, false);

    const favoriteResult = await request(
      `/layouts/${createResult.body.id}/favorite`,
      {
        method: 'PATCH',
        headers: jsonHeaders(session.token),
      },
    );

    assert.equal(favoriteResult.response.status, 200);
    assert.equal(favoriteResult.body.id, createResult.body.id);
    assert.equal(favoriteResult.body.isFavorite, true);

    const userBSession = await login(testUsers.userB);
    const forbiddenFavoriteResult = await request(
      `/layouts/${createResult.body.id}/favorite`,
      {
        method: 'PATCH',
        headers: jsonHeaders(userBSession.token),
      },
    );

    assert.equal(forbiddenFavoriteResult.response.status, 403);
    assert.equal(
      forbiddenFavoriteResult.body.error,
      'You are not allowed to update this layout.',
    );

    const adminSession = await login(testUsers.admin);
    const adminFavoriteResult = await request(
      `/layouts/${createResult.body.id}/favorite`,
      {
        method: 'PATCH',
        headers: jsonHeaders(adminSession.token),
      },
    );

    assert.equal(adminFavoriteResult.response.status, 200);
    assert.equal(adminFavoriteResult.body.id, createResult.body.id);
    assert.equal(adminFavoriteResult.body.isFavorite, false);

    const deleteResult = await request(
      `/users/${testUsers.userA.id}/layouts/${createResult.body.id}`,
      {
        method: 'DELETE',
        headers: jsonHeaders(session.token),
      },
    );

    assert.equal(deleteResult.response.status, 200);
  });

  it('blocks IDOR access to another user layout list', async () => {
    const session = await login(testUsers.userA);
    const { response, body } = await request(
      `/users/${testUsers.userB.id}/layouts`,
      {
        headers: jsonHeaders(session.token),
      },
    );

    assert.equal(response.status, 403);
    assert.equal(body.error, 'You are not allowed to access this user resource.');
  });

  it('blocks normal users from admin routes', async () => {
    const session = await login(testUsers.userA);
    const { response, body } = await request('/admin/users', {
      headers: jsonHeaders(session.token),
    });

    assert.equal(response.status, 403);
    assert.equal(body.error, 'Admin access required.');
  });

  it('allows an admin user to access admin routes', async () => {
    const session = await login(testUsers.admin);
    const { response, body } = await request('/admin/users', {
      headers: jsonHeaders(session.token),
    });

    assert.equal(response.status, 200);
    assert.ok(Array.isArray(body));
    assert.ok(body.some((user) => user.id === testUsers.admin.id));
  });
});

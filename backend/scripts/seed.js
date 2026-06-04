const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');

const BCRYPT_COST = 12;
const SAMPLE_PASSWORD = 'SamplePass123!';
const SAMPLE_LAYOUTS_PER_USER = 10;
const SAMPLE_USER_COUNT = 25;

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'password123',
  database: process.env.DB_NAME || 'tile_pattern_generator',
};

const sampleUsers = [
  ['sample_avery_01', 'avery.sample01@example.com'],
  ['sample_blake_02', 'blake.sample02@example.com'],
  ['sample_casey_03', 'casey.sample03@example.com'],
  ['sample_drew_04', 'drew.sample04@example.com'],
  ['sample_ellis_05', 'ellis.sample05@example.com'],
  ['sample_finn_06', 'finn.sample06@example.com'],
  ['sample_gray_07', 'gray.sample07@example.com'],
  ['sample_harper_08', 'harper.sample08@example.com'],
  ['sample_jordan_09', 'jordan.sample09@example.com'],
  ['sample_kai_10', 'kai.sample10@example.com'],
  ['sample_logan_11', 'logan.sample11@example.com'],
  ['sample_morgan_12', 'morgan.sample12@example.com'],
  ['sample_noah_13', 'noah.sample13@example.com'],
  ['sample_parker_14', 'parker.sample14@example.com'],
  ['sample_quinn_15', 'quinn.sample15@example.com'],
  ['sample_reese_16', 'reese.sample16@example.com'],
  ['sample_riley_17', 'riley.sample17@example.com'],
  ['sample_sawyer_18', 'sawyer.sample18@example.com'],
  ['sample_taylor_19', 'taylor.sample19@example.com'],
  ['sample_wren_20', 'wren.sample20@example.com'],
  ['sample_alex_21', 'alex.sample21@example.com'],
  ['sample_brook_22', 'brook.sample22@example.com'],
  ['sample_cameron_23', 'cameron.sample23@example.com'],
  ['sample_devon_24', 'devon.sample24@example.com'],
  ['sample_emery_25', 'emery.sample25@example.com'],
];

const layoutBaseNames = [
  'Kitchen Backsplash',
  'Bathroom Shower Wall',
  'Pool Room Limestone Layout',
  'Media Room Floor',
  'Jack and Jill Shower',
  'Fireplace Tile Concept',
  'Entry Floor Pattern',
  'Laundry Room Tile Plan',
  'Master Bath Accent Wall',
  'Pool Room Bench Layout',
];

const builtInTiles = [
  { tileId: 1, tileKey: 'macron-arc-matte' },
  { tileId: 2, tileKey: 'raised-edge-macron' },
  { tileId: 3, tileKey: 'macron-flat-matte' },
  { tileId: 4, tileKey: 'macron-domino-matte' },
  { tileId: 5, tileKey: 'macron-domino-blue' },
  { tileId: 6, tileKey: 'macron-domino-cocoa-ash' },
  { tileId: 7, tileKey: 'macron-flat-blue' },
  { tileId: 8, tileKey: 'macron-flat-cocoa-ash' },
  { tileId: 9, tileKey: 'macron-pressed-blue' },
  { tileId: 10, tileKey: 'macron-pressed-cocoa-ash' },
  { tileId: 11, tileKey: 'macron-radius-blue-cream' },
  { tileId: 12, tileKey: 'macron-radius-cocoa-ash' },
];

const gridSizes = [
  { columns: 3, rows: 3 },
  { columns: 4, rows: 4 },
  { columns: 5, rows: 5 },
  { columns: 6, rows: 4 },
  { columns: 7, rows: 5 },
  { columns: 8, rows: 6 },
];
const tileSizes = [4, 6, 8, 12];
const groutSizes = [0.0625, 0.125, 0.1875, 0.25];
const zoomLevels = [80, 100, 120, 140];
const rotations = [0, 90, 180, 270];

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function normalizeUsername(username) {
  return username.trim().toLowerCase();
}

function getWallDimension(tileCount, tileSize, grout) {
  return Number((tileCount * tileSize + (tileCount - 1) * grout).toFixed(3));
}

function createProjectSnapshot(seedIndex) {
  const grid = gridSizes[seedIndex % gridSizes.length];
  const tileSize = tileSizes[seedIndex % tileSizes.length];
  const grout = groutSizes[seedIndex % groutSizes.length];
  const zoom = zoomLevels[seedIndex % zoomLevels.length];
  const cellCount = grid.columns * grid.rows;

  const cells = Array.from({ length: cellCount }, (_, index) => {
    const tileIndex =
      (seedIndex + index + Math.floor(index / grid.columns)) %
      builtInTiles.length;
    const tile = builtInTiles[tileIndex];

    return {
      id: index + 1,
      tileId: tile.tileId,
      tileKey: tile.tileKey,
      rotation: rotations[(seedIndex + index) % rotations.length],
    };
  });

  return {
    version: 2,
    cells,
    columns: grid.columns,
    rows: grid.rows,
    wallWidth: getWallDimension(grid.columns, tileSize, grout),
    wallHeight: getWallDimension(grid.rows, tileSize, grout),
    tileSize,
    grout,
    zoom,
  };
}

async function getTableColumns(connection, tableName) {
  const [rows] = await connection.execute(`SHOW COLUMNS FROM ${tableName}`);
  return new Set(rows.map((row) => row.Field));
}

async function findUser(connection, usernameNormalized, emailNormalized) {
  const [rows] = await connection.execute(
    `
      SELECT id
      FROM users
      WHERE username_normalized = ?
         OR email_normalized = ?
      LIMIT 1
    `,
    [usernameNormalized, emailNormalized],
  );

  return rows[0] || null;
}

async function createSampleUser(
  connection,
  columns,
  username,
  email,
  passwordHash,
) {
  const fields = [
    'username',
    'username_normalized',
    'email',
    'email_normalized',
    'password_hash',
  ];
  const values = [
    username,
    normalizeUsername(username),
    email,
    normalizeEmail(email),
    passwordHash,
  ];

  if (columns.has('role')) {
    fields.push('role');
    values.push('user');
  }

  const placeholders = fields.map(() => '?').join(', ');
  const [result] = await connection.execute(
    `
      INSERT INTO users (${fields.join(', ')})
      VALUES (${placeholders})
    `,
    values,
  );

  return result.insertId;
}

async function layoutExists(connection, userId, name) {
  const [rows] = await connection.execute(
    `
      SELECT id
      FROM layouts
      WHERE userId = ?
        AND name = ?
      LIMIT 1
    `,
    [userId, name],
  );

  return rows.length > 0;
}

async function createSampleLayout(connection, userId, name, snapshot) {
  await connection.execute(
    `
      INSERT INTO layouts (userId, name, layout)
      VALUES (?, ?, ?)
    `,
    [userId, name, JSON.stringify(snapshot)],
  );
}

async function main() {
  const startedAt = Date.now();
  const report = {
    usersCreated: 0,
    usersSkipped: 0,
    layoutsCreated: 0,
    layoutsSkipped: 0,
  };

  if (sampleUsers.length !== SAMPLE_USER_COUNT) {
    throw new Error(
      `Expected ${SAMPLE_USER_COUNT} sample users, found ${sampleUsers.length}.`,
    );
  }

  const connection = await mysql.createConnection(dbConfig);

  try {
    const userColumns = await getTableColumns(connection, 'users');

    if (!userColumns.has('password_hash')) {
      throw new Error(
        'The users.password_hash column is required before seeding sample users.',
      );
    }

    const passwordHash = await bcrypt.hash(SAMPLE_PASSWORD, BCRYPT_COST);
    const seededUsers = [];

    for (const [username, email] of sampleUsers) {
      const usernameNormalized = normalizeUsername(username);
      const emailNormalized = normalizeEmail(email);
      const existingUser = await findUser(
        connection,
        usernameNormalized,
        emailNormalized,
      );

      if (existingUser) {
        report.usersSkipped += 1;
        seededUsers.push({ id: existingUser.id, username, email });
        continue;
      }

      const id = await createSampleUser(
        connection,
        userColumns,
        username,
        email,
        passwordHash,
      );
      report.usersCreated += 1;
      seededUsers.push({ id, username, email });
    }

    for (const [userIndex, user] of seededUsers.entries()) {
      for (
        let layoutIndex = 0;
        layoutIndex < SAMPLE_LAYOUTS_PER_USER;
        layoutIndex += 1
      ) {
        const baseName = layoutBaseNames[layoutIndex % layoutBaseNames.length];
        const name = `[SAMPLE] ${baseName} ${String(userIndex + 1).padStart(
          2,
          '0',
        )}-${String(layoutIndex + 1).padStart(2, '0')}`;

        if (await layoutExists(connection, user.id, name)) {
          report.layoutsSkipped += 1;
          continue;
        }

        const seedIndex = userIndex * SAMPLE_LAYOUTS_PER_USER + layoutIndex;
        await createSampleLayout(
          connection,
          user.id,
          name,
          createProjectSnapshot(seedIndex),
        );
        report.layoutsCreated += 1;
      }
    }
  } finally {
    await connection.end();
  }

  const executionTimeSeconds = ((Date.now() - startedAt) / 1000).toFixed(2);

  console.log('Sample data seed complete.');
  console.log(`users created: ${report.usersCreated}`);
  console.log(`layouts created: ${report.layoutsCreated}`);
  console.log(`users skipped: ${report.usersSkipped}`);
  console.log(`layouts skipped: ${report.layoutsSkipped}`);
  console.log(`total execution time: ${executionTimeSeconds}s`);
}

main().catch((error) => {
  console.error('Sample data seed failed.');
  console.error(error);
  process.exitCode = 1;
});

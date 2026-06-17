# Testing Demo

## Micro-Project

Add unit and integration tests to an app, then quantify test coverage.

## Existing Tests

The project already included frontend unit tests using Vitest:

- `frontend/src/TilePreview.test.js`
- `frontend/src/utils/randomizeLayout.test.js`

These tests cover layout helper behavior, layout normalization, randomizable tile selection, and random layout generation.

## Added Integration Tests

Backend integration tests were added in:

- `backend/server.integration.test.js`

The integration suite starts the Express application on a random local port, creates temporary test users in the MySQL/MariaDB database, exercises the real HTTP API using `fetch`, and cleans up the records it creates after execution.

Covered integration behaviors include:

- Login succeeds for a created test user.
- Protected layout access fails without a bearer token.
- An authenticated user can create, read, and delete their own layout.
- User A cannot access User B's layout list.
- A normal user cannot access admin routes.
- An admin user can access admin routes.

To make this practical without changing production behavior, `backend/server.js` now exports the Express application and only calls `app.listen()` when run directly using:

```bash
node server.js
```

This allows the application to be imported during testing while preserving normal application startup behavior.

## Commands

Run all tests from the project root:

```bash
npm test
```

Run all coverage checks from the project root:

```bash
npm run coverage
```

Run frontend tests only:

```bash
npm --prefix frontend test
```

Run backend integration tests only:

```bash
npm --prefix backend test
```

Run frontend coverage only:

```bash
npm --prefix frontend run coverage
```

Run backend coverage only:

```bash
npm --prefix backend run coverage
```

## Latest Test Results

Date recorded: June 16, 2026

Command:

```bash
npm test
```

Result summary:

```text
frontend: 2 test files passed, 14 tests passed
backend: 1 integration test file passed, 6 tests passed
total: 3 test files passed, 20 tests passed
```

## Latest Coverage Results

Date recorded: June 16, 2026

Command:

```bash
npm run coverage
```

Frontend coverage summary:

```text
Statements   : 84.05% (58/69)
Branches     : 74.68% (59/79)
Functions    : 80.00% (16/20)
Lines        : 83.07% (54/65)
```

Backend coverage summary:

```text
db.js line coverage: 83.33%
server.js line coverage: 36.76%
all backend files line coverage: 37.63%
all backend files branch coverage: 56.14%
all backend files function coverage: 40.74%
```

## Interpretation

The frontend demonstrates strong, focused unit coverage for helper logic that controls layout normalization, tile selection, and randomization.

The backend coverage percentage is lower because the integration suite is intentionally focused on the application's most critical workflows rather than attempting exhaustive route coverage. The tests prioritize authentication, authorization, security regression prevention, and core CRUD functionality while exercising the real Express API against a real MySQL/MariaDB database.

This approach favors meaningful regression protection over artificially inflating coverage metrics.

## Requirements and Limitations

- Backend integration tests require a local MySQL/MariaDB database named `tile_pattern_generator`.
- Backend integration tests use the same default local database values as the application: `localhost`, user `root`, password `password123`.
- Database connection values can be overridden with `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME`.
- The backend tests create temporary users and layouts with unique names and delete those records after the test run completes.
- Media upload testing is not included because it would introduce file fixtures and multipart request complexity beyond the scope of this focused testing pass.
- The suite does not attempt comprehensive production-grade coverage of every application path.

## Conclusion

This project now demonstrates:

- frontend unit testing,
- backend integration-style API testing,
- authentication and authorization testing,
- security regression testing,
- repeatable test execution commands,
- repeatable coverage commands,
- and quantified coverage results.

Together, these testing practices satisfy the requirements of CS233 Micro-Project #13 by demonstrating unit testing, integration-style testing, and measurable coverage within the Tile Pattern Generator application.

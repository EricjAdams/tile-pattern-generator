# Sample Data Demo

## What Seed Data Is

Seed data is predictable development data that can be loaded into a local database so the application has realistic users and records to test with.

For Tile Pattern Generator, the seed script creates sample users and saved tile layouts. It does not create real customer data, uploaded image files, or admin accounts.

## Why Developers Use Seed Data

Developers use seed data to test common workflows without manually creating records each time. In this project, sample data helps verify:

- user-scoped layout lists
- admin user and layout views
- layout search
- layout loading
- duplicate layout-name behavior
- performance with a larger number of saved layouts

## How The Seed Script Works

The script lives at `backend/scripts/seed.js` and can be run from the project root with:

```bash
npm run seed
```

It connects to the existing MySQL database using the same default local database values as the backend:

- host: `localhost`
- port: `3306`
- user: `root`
- password: `password123`
- database: `tile_pattern_generator`

These can be overridden with environment variables:

```bash
DB_HOST=127.0.0.1 DB_USER=root DB_PASSWORD=password123 DB_NAME=tile_pattern_generator npm run seed
```

The script creates:

- 25 sample users
- 250 sample layouts
- 10 layouts per sample user

Sample users use bcrypt-hashed passwords with cost factor 12. The shared sample password is:

```text
SamplePass123!
```

## How Idempotent Seeding Works

The seed script is safe to run more than once.

Sample users are identified by predictable `sample_...` usernames and `example.com` emails. If a matching sample user already exists, the script skips creating that user.

Sample layouts are identified by names beginning with:

```text
[SAMPLE]
```

If a sample layout with the same name already exists for the same sample user, the script skips that layout.

The script does not delete real users or real layouts. It also does not modify authentication, authorization, admin routes, frontend behavior, uploaded tile files, or existing application records.

## Layout Format

The script uses the current saved layout project snapshot format stored in `layouts.layout`:

```json
{
  "version": 2,
  "cells": [
    {
      "id": 1,
      "tileId": 1,
      "tileKey": "macron-arc-matte",
      "rotation": 0
    }
  ],
  "columns": 3,
  "rows": 3,
  "wallWidth": 18.25,
  "wallHeight": 18.25,
  "tileSize": 6,
  "grout": 0.125,
  "zoom": 100
}
```

The seeded layouts reference existing stable built-in tile keys so they can render without creating uploaded image files.

## How To Run The Script

From the project root:

```bash
npm run seed
```

Expected output:

```text
Sample data seed complete.
users created: 25
layouts created: 250
users skipped: 0
layouts skipped: 0
total execution time: 1.23s
```

On later runs, created records should be skipped:

```text
Sample data seed complete.
users created: 0
layouts created: 0
users skipped: 25
layouts skipped: 250
total execution time: 0.42s
```

## How To Verify Users Were Created

Run this SQL:

```sql
SELECT id, username, email, role, deleted_at
FROM users
WHERE username LIKE 'sample_%'
ORDER BY id;
```

You should see 25 sample users.

## How To Verify Layouts Were Created

Run this SQL:

```sql
SELECT userId, COUNT(*) AS sample_layouts
FROM layouts
WHERE name LIKE '[SAMPLE]%'
GROUP BY userId
ORDER BY userId;
```

You should see 10 sample layouts per sample user.

To verify the stored JSON shape:

```sql
SELECT id, name, JSON_EXTRACT(layout, '$.version') AS version
FROM layouts
WHERE name LIKE '[SAMPLE]%'
ORDER BY id
LIMIT 10;
```

Each seeded layout should report version `2`.

## How To Verify The App Still Functions

1. Start the backend and frontend normally.
2. Log in as a sample user, for example:
   - username: `sample_avery_01`
   - password: `SamplePass123!`
3. Confirm the saved layouts list contains `[SAMPLE]` layouts.
4. Search for a seeded layout name such as `Kitchen Backsplash`.
5. Load a seeded layout and confirm geometry, rotations, and tile images render.
6. If your account has the `admin` role, open the Admin Dashboard and confirm sample users and layouts appear.
7. Run `npm run seed` again and confirm it skips the existing sample records instead of duplicating them.

## Limitations

- The script creates development/demo data only.
- The script does not create uploaded tile image files.
- Seeded layouts use built-in tile keys for reliable rendering.
- The script does not create admin users.
- The script does not clean up sample records automatically.
- The script assumes the auth migration has been applied because it requires `users.password_hash`.

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

## Recorded Seeded-Data Performance Evidence

Date recorded: June 6, 2026

The seed script was run against the existing local database:

```bash
npm run seed
```

Result:

```text
Sample data seed complete.
users created: 0
layouts created: 1
users skipped: 25
layouts skipped: 249
total execution time: 0.27s
```

This run found the sample users already present and created one missing sample layout, leaving the seeded dataset complete.

The seeded data was verified with:

```bash
mysql -uroot -ppassword123 tile_pattern_generator -e "SELECT COUNT(*) AS total_users FROM users; SELECT COUNT(*) AS total_layouts FROM layouts; SELECT COUNT(*) AS sample_users FROM users WHERE username REGEXP '^sample_'; SELECT COUNT(*) AS sample_layouts FROM layouts WHERE name LIKE '[SAMPLE]%'; SELECT role, COUNT(*) AS sample_users FROM users WHERE username REGEXP '^sample_' GROUP BY role;"
```

Result:

```text
total_users
37
total_layouts
275
sample_users
25
sample_layouts
250
role    sample_users
user    25
```

The backend was started with:

```bash
node backend/server.js
```

Result:

```text
Server running on http://localhost:3001
Connected to MySQL
```

Performance was measured against the existing authenticated sample-user API routes. The test user was `sample_avery_01` with password `SamplePass123!`.

```bash
LOGIN_JSON=$(curl -s -X POST http://localhost:3001/login -H "Content-Type: application/json" -d '{"identifier":"sample_avery_01","password":"SamplePass123!"}')
TOKEN=$(printf '%s' "$LOGIN_JSON" | node -pe 'JSON.parse(require("fs").readFileSync(0, "utf8")).token')
USER_ID=$(printf '%s' "$LOGIN_JSON" | node -pe 'JSON.parse(require("fs").readFileSync(0, "utf8")).id')
printf 'login user id: %s\n' "$USER_ID"
for i in 1 2 3 4 5; do curl -s -o /tmp/sample-layouts-$i.json -w "retrieval run $i: http=%{http_code} time=%{time_total}s size=%{size_download} bytes\n" -H "Authorization: Bearer $TOKEN" "http://localhost:3001/users/$USER_ID/layouts"; done
for i in 1 2 3 4 5; do curl -s -o /tmp/sample-search-$i.json -w "search run $i: http=%{http_code} time=%{time_total}s size=%{size_download} bytes\n" -H "Authorization: Bearer $TOKEN" "http://localhost:3001/users/$USER_ID/layouts?search=Kitchen"; done
```

Results:

```text
login user id: 10
retrieval run 1: http=200 time=0.001568s size=17650 bytes
retrieval run 2: http=200 time=0.001668s size=17650 bytes
retrieval run 3: http=200 time=0.001661s size=17650 bytes
retrieval run 4: http=200 time=0.001482s size=17650 bytes
retrieval run 5: http=200 time=0.001318s size=17650 bytes
search run 1: http=200 time=0.001313s size=798 bytes
search run 2: http=200 time=0.001212s size=798 bytes
search run 3: http=200 time=0.001218s size=798 bytes
search run 4: http=200 time=0.001125s size=798 bytes
search run 5: http=200 time=0.001598s size=798 bytes
retrieved layouts: 10
search results: 1
first search result: [SAMPLE] Kitchen Backsplash 01-01
```

Average local response times:

- Layout retrieval: about 0.00154s, or 1.54 ms
- Layout search: about 0.00129s, or 1.29 ms

Scaling analysis: with 37 total users, 275 total layouts, 25 sample users, and 250 sample layouts in the database, the user-scoped saved-layout API still returns the sample user's layout list and search results quickly. The seeded dataset is large enough to demonstrate that the app can operate against many saved layouts without visible slowdown in the tested local development environment.

Conclusion: performance scales acceptably for this CS233 sample-data micro-project.

## Screenshot Checklist

Capture:

1. Terminal showing `npm run seed` completing with 25 sample users skipped and 250 sample layouts present after the run.
2. Terminal showing the MySQL count query result: 37 total users, 275 total layouts, 25 sample users, 250 sample layouts, and sample users with role `user`.
3. Terminal showing `node backend/server.js` with `Server running on http://localhost:3001` and `Connected to MySQL`.
4. Terminal showing the seeded API timing results for layout retrieval and layout search.
5. Browser showing login as `sample_avery_01`.
6. Browser showing the saved layouts list with `[SAMPLE]` layouts.
7. Browser showing a search for `Kitchen` returning `[SAMPLE] Kitchen Backsplash 01-01`.
8. Browser showing the seeded layout loaded in the tile pattern editor.

## Video Demonstration Checklist

Show:

1. `SAMPLE_DATA_DEMO.md` and the seed script location.
2. Run `npm run seed` and point out that the seed process is idempotent.
3. Run the MySQL verification query and point out the sample-user and sample-layout counts.
4. Start the backend with `node backend/server.js`.
5. Log in as `sample_avery_01`.
6. Show the saved `[SAMPLE]` layouts in the app.
7. Search for `Kitchen` and load the matching seeded layout.
8. Run the seeded API timing command and point out the retrieval and search response times.
9. Conclude that the seeded dataset exists and the app still retrieves and searches layouts quickly.

## Limitations

- The script creates development/demo data only.
- The script does not create uploaded tile image files.
- Seeded layouts use built-in tile keys for reliable rendering.
- The script does not create admin users.
- The script does not clean up sample records automatically.
- The script assumes the auth migration has been applied because it requires `users.password_hash`.

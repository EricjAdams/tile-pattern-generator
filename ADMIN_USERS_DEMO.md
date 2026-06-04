# Administrative Users Demo

## Role-Based Access Control

The Tile Pattern Generator now supports a simple role-based access control
(RBAC) model.

Each user has one role:

- `user`
- `admin`

Normal users can manage only their own layouts and uploaded tiles. Admin users
can access admin-only routes to view all users, view all layouts, and delete any
layout.

## Role Field

The `users.role` column stores the account role:

```sql
role ENUM('user', 'admin') NOT NULL DEFAULT 'user'
```

New registered users receive the default `user` role.

To promote an existing account to admin, run:

```sql
UPDATE users
SET role = 'admin'
WHERE email = 'eric@example.com';
```

## Admin Authorization

The backend reuses the bearer-token authentication added in the IDOR patch.

Admin routes require:

1. A valid `Authorization: Bearer <token>` header.
2. A session where the authenticated user's role is `admin`.

If the user is not authenticated, the backend returns `401 Unauthorized`.
If the user is authenticated but not an admin, the backend returns
`403 Forbidden`.

## Admin Routes

Admin-only routes:

- `GET /admin/users`
- `GET /admin/layouts`
- `DELETE /admin/layouts/:id`

## Frontend Admin Dashboard

The frontend shows an `Admin` button only when:

```js
currentUser.role === 'admin'
```

The Admin Dashboard displays:

- all users
- all layouts
- each layout owner
- a delete action for layouts

If a non-admin somehow reaches the admin view, the UI shows `Access Denied`.

## Test Admin Access

1. Run the role migration.
2. Promote your account:

   ```sql
   UPDATE users
   SET role = 'admin'
   WHERE email = 'eric@example.com';
   ```

3. Restart the backend.
4. Log out and log back in so the login response includes `role: "admin"`.
5. Confirm the `Admin` button appears.
6. Open the Admin Dashboard.
7. Confirm users and layouts load.
8. Delete a layout from the dashboard.
9. Confirm the layout is removed from the admin list.

## Test Non-Admin Access

1. Log in as a normal user.
2. Confirm the `Admin` button is not visible.
3. Call an admin route manually using the normal user's token:

   ```http
   GET /admin/users
   Authorization: Bearer <normalUserToken>
   ```

4. Expected result:

   ```http
   403 Forbidden
   ```

## Limitations

- Sessions are still in memory and reset when the backend restarts.
- Admin roles are managed manually with SQL.
- There is no admin user editor yet.
- There is no restore flow for deleted layouts.
- Layout deletion is a hard delete, matching the existing layout delete behavior.
- The frontend hides admin UI for non-admins, but backend authorization is the
  real security control.

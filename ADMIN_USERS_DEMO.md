# Administrative Users Demo

## Role-Based Access Control

The Tile Pattern Generator supports a simple role-based access control (RBAC) model.

Each user has one role:

- `user`
- `admin`

Normal users can manage only their own layouts and uploaded tiles. Admin users can access protected routes to review application data and perform administrative actions unavailable to standard users.

## Role Field

The `users.role` column stores the account role:

```sql
role ENUM('user', 'admin') NOT NULL DEFAULT 'user'
```

Newly registered users receive the default `user` role.

To promote an existing account to admin, run:

```sql
UPDATE users
SET role = 'admin'
WHERE email = 'eric@example.com';
```

After updating the role, log out and log back in so the authentication response includes the updated role information.

## Admin Authorization

The backend reuses the bearer-token authentication introduced during the IDOR remediation work.

Admin routes require:

1. A valid `Authorization: Bearer <token>` header.
2. A session where the authenticated user's role is `admin`.

If the user is not authenticated, the backend returns `401 Unauthorized`.

If the user is authenticated but not an admin, the backend returns `403 Forbidden`.

The frontend hides administrative functionality from non-admin users, but backend authorization remains the primary security control.

## Admin Routes

Admin-only routes:

- `GET /admin/users`
- `GET /admin/layouts`
- `DELETE /admin/layouts/:id`

These routes allow administrators to review users, review saved layouts, and moderate user-generated content.

## Frontend Admin Dashboard

The frontend shows an `Admin` button only when:

```js
currentUser.role === "admin";
```

The Admin Dashboard displays:

- all users
- all layouts
- each layout owner
- a delete action for layouts

If a non-admin somehow reaches the admin view, the UI displays `Access Denied`, and backend authorization prevents access to protected data.

## Test Admin Access

1. Run the role migration if required.

2. Promote your account:

   ```sql
   UPDATE users
   SET role = 'admin'
   WHERE email = 'eric@example.com';
   ```

3. Restart the backend if necessary.

4. Log out and log back in so the login response includes `role: "admin"`.

5. Confirm the `Admin` button appears.

6. Open the Admin Dashboard.

7. Confirm users and layouts load successfully.

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

5. Confirm the user can still access only their own layouts and uploaded tiles.

## Limitations

- Sessions are stored in memory and reset when the backend restarts.
- Admin roles are managed manually through SQL updates.
- There is no dedicated interface for managing administrator roles.
- There is no restore workflow for deleted layouts.
- Layout deletion is a hard delete and follows the existing layout deletion behavior.
- The frontend hides admin functionality for non-admin users, but backend authorization is the real security control.

# Security Demo: IDOR Vulnerability and Patch

## Vulnerability

The Tile Pattern Generator previously had an insecure direct object reference
(IDOR) risk on user-scoped routes.

The frontend stored the current user in `localStorage`, but the backend trusted
the `:userId` value in route URLs. A user who was logged in as user 1 could
manually request another user's resource by changing the URL, for example:

```http
GET /users/2/layouts
```

Because the backend did not verify that the requester was actually user 2, this
could expose another user's saved layouts.

## Why Frontend Checks Were Not Enough

Frontend state and `localStorage` are controlled by the browser. They can help
the UI remember who is signed in, but they cannot prove identity to the server.
Authorization must happen on the backend for every protected request.

## Patch

The patch adds a simple server-issued bearer token mechanism:

1. Successful login and registration create a random server token.
2. The backend stores the token in an in-memory session map.
3. The frontend sends the token on protected API calls with:

   ```http
   Authorization: Bearer <token>
   ```

4. User-specific backend routes require authentication.
5. User-specific backend routes compare the authenticated session user id with
   the `:userId` route parameter.
6. If the ids do not match, the backend returns `403 Forbidden`.
7. Legacy unscoped layout routes are disabled with `410 Gone`.

## Protected Routes

The following routes now require a valid token and matching user id:

- `DELETE /users/:userId`
- `GET /users/:userId/tiles`
- `POST /users/:userId/tiles`
- `GET /users/:userId/layouts`
- `POST /users/:userId/layouts`
- `PUT /users/:userId/layouts/:id`
- `DELETE /users/:userId/layouts/:id`

The following legacy routes are disabled:

- `GET /layouts/:id`
- `PUT /layouts/:id`
- `DELETE /layouts/:id`

## Manual Test

1. Log in as user A and copy the returned token from the network response.
2. Request user A's layouts with that token:

   ```http
   GET /users/<userAId>/layouts
   Authorization: Bearer <userAToken>
   ```

   Expected result: `200 OK`.

3. Request user B's layouts with user A's token:

   ```http
   GET /users/<userBId>/layouts
   Authorization: Bearer <userAToken>
   ```

   Expected result: `403 Forbidden`.

4. Request any protected route without a token.

   Expected result: `401 Unauthorized`.

5. Request a disabled legacy layout route.

   Expected result: `410 Gone`.

## Remaining Limitations

This patch is intentionally small for the micro-project. It improves backend
authorization, but it is not a complete production authentication system.

Known limitations:

- Sessions are stored in memory and are cleared when the backend restarts.
- Tokens are stored in frontend `localStorage`.
- There is no token expiration yet.
- There is no refresh-token flow.
- There is no rate limiting.
- CORS is still broadly enabled.
- Legacy plaintext password compatibility still exists for old users.

Future production work should move to hardened sessions or JWTs, add expiration
and rotation, tighten CORS, add rate limiting, and remove plaintext password
compatibility after all active users have migrated.

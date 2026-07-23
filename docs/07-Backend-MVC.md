# Backend MVC Architecture

## 1. Core Stack
- **Runtime**: Node.js
- **Framework**: Express.js
- **Architecture**: MVC (Model-View-Controller) / Repository Pattern
- **Validation**: Zod
- **Logging**: Winston
- **Security**: Helmet, CORS, Express Rate Limit

## 2. Directory Structure
```text
/src
  /config         # DB connection, Cloud COS config, Environment vars
  /controllers    # Express route controllers (req, res, next)
  /middlewares    # Auth, Error handling, Rate limiting, Validation
  /models         # Database models (Neon Postgres driver wrappers)
  /repositories   # Data access layer (separates DB logic from services)
  /services       # Business logic (called by controllers)
  /routes         # API route definitions
  /utils          # Helper functions, Error classes, Logger
  /workers        # Background process scripts
```

## 3. Data Flow (Request Lifecycle)
1. **Route (`/routes`)**: Receives the HTTP request.
2. **Middleware (`/middlewares`)**: Authenticates via JWT, validates payload with Zod.
3. **Controller (`/controllers`)**: Extracts `req.body`, `req.params`, `req.user`. Calls the appropriate Service.
4. **Service (`/services`)**: Executes business logic (e.g., "Can this user delete this file?"). Calls the Repository.
5. **Repository (`/repositories`)**: Executes the SQL query against Neon PostgreSQL. Returns data to Service.
6. **Controller**: Formats the final response and sends it back to the client via `res.json()`.

## 4. Why Repository Pattern?
By isolating the database queries in `/repositories`, the `/services` remain purely focused on business logic. If we ever swap the underlying ORM or query builder, we only change the repositories, not the services or controllers.

## 5. WebSockets
A separate WebSocket server (attached to the Express HTTP server) will broadcast:
- Upload progress updates.
- Real-time share notifications.
- State changes for background ZIP tasks.

# Security Document

## 1. Authentication & Authorization
- **Tencent CAM**: Used for initial identity verification.
- **JWT**: Stateless session management. Access tokens expire in 15 minutes. Refresh tokens are stored as HTTP-only secure cookies and expire in 7 days.
- **RBAC**: Middleware validates roles (e.g., Owner vs User).

## 2. Infrastructure Security
- **Helmet**: All Express responses are protected by Helmet (HSTS, NoSniff, XSS Filter).
- **CORS**: Strictly limited to the specific Vercel production domain.
- **Rate Limiting**: 
  - Global API: 100 requests per minute per IP.
  - Login Route: 5 requests per 15 minutes per IP.

## 3. Data Protection
- **SQL Injection**: Prevented by using parameter binding natively in the PostgreSQL driver / query builder.
- **XSS**: Frontend strictly uses React which inherently escapes variables. No use of `dangerouslySetInnerHTML`.
- **Validation**: Strict validation using Zod ensures no malformed objects reach the repository layer.

## 4. Storage Security
- **Private Buckets**: Tencent COS buckets are set to completely private.
- **Signed URLs**: Downloads and uploads are authorized exclusively via time-limited signed URLs (e.g., expiring in 60 minutes).
- **Password Protected Shares**: File sharing links can be secured with bcrypt-hashed passwords.

## 5. Audit Logging
Every action (login, create, delete, share, download) writes an immutable record to the `activity_logs` table for compliance tracking.

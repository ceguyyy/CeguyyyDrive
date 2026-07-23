# Roadmap

## Phase 1: Documentation (Current)
- Complete PRD, Architecture, DB Schema, OpenAPI, and Security docs.

## Phase 2: Database Setup
- Provision Neon DB.
- Create migration scripts based on `09-Database-Schema.md`.

## Phase 3: Backend Foundation
- Setup Express API with MVC structure.
- Add Error handlers, Winston logger, and Helmet.

## Phase 4: Authentication
- Integrate Tencent CAM.
- Implement JWT generation and validation middleware.

## Phase 5 & 6: Folder & File Modules
- CRUD operations for virtual directories.
- Storing file metadata.

## Phase 7: Upload Module
- Pre-signed URLs and chunking logic.
- WebSocket integration.

## Phase 8 & 9: Sharing & Search
- Implement RBAC sharing rules.
- PostgreSQL full-text search or ILIKE filtering.

## Phase 10-15: Polish & Deployment
- Dashboard, Activity Logs, Frontend UI, E2E Testing, and Docker/Render/Vercel deployment.

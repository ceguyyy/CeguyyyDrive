# Software Requirement Specification (SRS)

## 1. Introduction
This document specifies the software requirements for **CeguyyyDrive**, a scalable enterprise cloud storage application.

## 2. Overall Description
### 2.1 System Environment
- **Frontend**: React JS, Vite, Tailwind CSS, TanStack Query, Zustand, deployed on Vercel.
- **Backend**: Node.js, Express.js (REST API + WebSockets), deployed via Docker on Render.
- **Database**: PostgreSQL (Neon).
- **Storage**: Tencent Cloud Object Storage (COS).
- **Auth**: Tencent Cloud CAM + JWT.

### 2.2 Design Constraints
- No TypeScript (JavaScript only).
- No Redis or BullMQ (use Node.js Worker Threads/PostgreSQL for background tasks).
- No Kubernetes or Serverless Functions.
- No Supabase Auth or Firebase.
- No MongoDB.

## 3. Functional Requirements
### 3.1 Authentication Module (REQ-AUTH)
- The system must authenticate users via Tencent CAM mapped to internal JWTs.
- The system must manage sessions using access and refresh tokens.
- The system must enforce RBAC (Owner, User).

### 3.2 Storage Management Module (REQ-STORAGE)
- The system must use Tencent COS for physical file storage.
- The system must handle duplicate uploads by appending an incrementing suffix (e.g., `file_1.pdf`).
- Existing files must never be overwritten.

### 3.3 Folder Module (REQ-FOLDER)
- The system must store folder structures as logical entities (metadata) in PostgreSQL.
- The system must support infinite nesting of folders.

### 3.4 File Module (REQ-FILE)
- The system must provide chunked, multipart uploads with tracking in `upload_sessions`.
- The system must support file versioning upon updates to the same logical file ID.

### 3.5 Background Processing Module (REQ-BG)
- The system must manage background tasks (e.g., ZIP creation, trash cleanup) using Node.js Worker Threads or Child Processes.
- The state of tasks must be persisted in PostgreSQL.

## 4. External Interfaces
- **Tencent COS API**: For generating presigned URLs and managing objects.
- **Tencent CAM API**: For generating temporary credentials and role management.
- **PostgreSQL (Neon)**: Relational data mapping (users, metadata, logs).

## 5. Security Requirements
- All API endpoints must be protected by rate limiting.
- The API must implement Helmet for HTTP headers.
- Input must be validated using Zod.
- SQL injection protection via parameterized queries (built into the PG driver/ORM).

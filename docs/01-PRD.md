# Product Requirement Document (PRD)

## 1. Product Overview
**Name**: CeguyyyDrive
**Description**: A production-ready enterprise cloud storage platform powered by Tencent Cloud Object Storage (COS). It functions similarly to Google Drive, offering users the ability to store, manage, share, and collaborate on files in a highly secure and scalable environment.

## 2. Target Audience
- Enterprise users needing secure, structured file storage.
- Individual professionals requiring high-capacity, reliable cloud storage.

## 3. Goals & Objectives
- Provide a robust, highly available file storage system.
- Ensure enterprise-level security and compliance.
- Deliver an exceptional, responsive User Interface using the Neubrutalism design trend.
- Enable high-performance, resilient file uploads (chunking, multipart, pause/resume).

## 4. Key Features
### 4.1 Folder Management
- Create, Rename, Move, Delete, Restore (from Trash).
- Unlimited nested folders.
- Breadcrumb navigation.

### 4.2 File Management
- Upload, Download, Move, Rename, Delete, Restore, Favorite.
- Information Panel (Metadata).
- Version History (keep track of file modifications).
- Context Menu operations (Right-click equivalent via 3-dot action button).

### 4.3 Upload & Download capabilities
- Drag and Drop support.
- Chunk and Multipart uploads for large files.
- Pause, Resume, Retry, Cancel uploads.
- WebSocket-powered progress bars.
- Bulk download and ZIP download for folders.

### 4.4 Advanced Search & Filtering
- Real-time search across Filename, Extension, Owner, Folder.
- Filters: Images, Videos, Office, PDF, Audio, ZIP, Code, Unknown.
- Sorting: Name, Date, Size, Extension (Asc/Desc).

### 4.5 Sharing & Collaboration
- Public links, Password-protected sharing.
- Expiration dates for shares.
- Permissions: Read Only, Download Only.
- Audit Logging for shared access.

### 4.6 File Preview
- Support for Images, PDFs, Word, Excel, PowerPoint.
- Video thumbnails, Audio icons.

### 4.7 User & System Management
- Storage Dashboard (charts, usage stats, biggest files).
- Activity Logs (track logins, uploads, downloads, sharing).
- Recycle Bin (soft delete and permanent delete).
- Interactive Tutorial and Keyboard Shortcuts.

## 5. Non-Functional Requirements
- **Performance**: High-speed uploads directly interfacing with Tencent COS via signed URLs where appropriate.
- **Scalability**: Stateless backend capable of horizontal scaling.
- **Security**: Strict RBAC, Input sanitization, Helmet, Rate Limiting, signed URLs, JWT expiration and rotation.
- **Design**: Neubrutalism styling (thick borders, strong shadows, bright colors, accessible WCAG AA).

## 6. Success Metrics
- 99.9% uptime.
- <2s average page load time.
- Successful chunked uploads for files > 1GB.
- Zero data loss for interrupted uploads (resume functionality).

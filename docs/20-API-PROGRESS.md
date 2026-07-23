# API Progress Tracker

This document tracks the implementation status of all planned API endpoints.

| Method | Endpoint | Status | Notes |
|--------|----------|--------|-------|
| `POST` | `/auth/login` | Pending | Maps CAM token to JWT |
| `POST` | `/auth/refresh` | Pending | Refresh JWT |
| `GET`  | `/folders` | Pending | List root folders |
| `POST` | `/folders` | Pending | Create new folder |
| `PUT`  | `/folders/:id` | Pending | Rename/Move folder |
| `DELETE` | `/folders/:id` | Pending | Soft delete folder |
| `POST` | `/files/upload-session` | Pending | Get Pre-signed URL / STS |
| `GET`  | `/files/:id` | Pending | Get file metadata |
| `DELETE` | `/files/:id` | Pending | Soft delete file |
| `POST` | `/shares` | Pending | Create share link |
| `GET`  | `/shares/:token` | Pending | Access shared file |
| `GET`  | `/search` | Pending | Full text search |
| `GET`  | `/dashboard/stats` | Pending | Storage statistics |

# Database Progress Tracker

This document tracks the creation and deployment of database migrations.

| Table Name | Schema Written? | Migrated to Neon? | Notes |
|------------|-----------------|-------------------|-------|
| `roles` | Yes | Pending | - |
| `users` | Yes | Pending | - |
| `folders` | Yes | Pending | Handles nested structure |
| `files` | Yes | Pending | Metadata only |
| `file_versions` | Pending | Pending | - |
| `shares` | Pending | Pending | - |
| `favorites` | Pending | Pending | - |
| `upload_sessions` | Pending | Pending | State machine for background tasks |
| `activity_logs` | Pending | Pending | - |
| `trash` | Pending | Pending | Actually just `is_deleted` flag on files/folders |

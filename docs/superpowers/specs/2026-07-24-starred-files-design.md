# Starred Files — Design Spec

Date: 2026-07-24

## Problem

There is no way to mark a file as important for quick access later. Users must
navigate the folder tree every time to find frequently-used documents.

## Goals (v1)

- Star/un-star a file directly from its card in My Drive, via an always-visible
  star icon (no context menu needed) — click toggles instantly.
- A new "Starred" sidebar entry showing every starred file across all folders,
  flat, most-recently-starred first.

## Non-goals (v1)

- Folders cannot be starred — files only.
- Company Drive files are out of scope — personal My Drive only.
- No starring from Shared-with-me or public share views.

## Data Model

No new column, no new table. `favorites` already exists in the schema
(`001_initial_schema.sql`) with exactly the right shape — `user_id`,
`file_id`, `folder_id` (both nullable, `CHECK` requires at least one),
`created_at` — but is not referenced anywhere in the codebase yet. Starring a
file is inserting/deleting a row here (`file_id` set, `folder_id` left null,
per this feature's files-only scope).

One migration is still needed: a partial unique index so toggling is a clean
upsert/delete instead of accumulating duplicate rows:

```sql
CREATE UNIQUE INDEX idx_favorites_user_file_unique ON favorites(user_id, file_id) WHERE file_id IS NOT NULL;
```

## Backend

New endpoints in the existing personal-Drive file module (`fileController.js` /
`fileService.js` / a new `favoriteRepository.js` / `file.routes.js`) — this is
personal-Drive-only, so it belongs alongside the existing file endpoints, not
in a new module:

| Method | Path | Purpose |
|---|---|---|
| PATCH | `/files/:id/star` | Toggle: insert a `favorites` row if none exists for `(user_id, file_id)`, delete it if one does |
| GET | `/files/starred` | Join `favorites` → `files` for the caller, non-deleted files only, ordered by `favorites.created_at DESC` |

Both scoped by `user_id = req.user.id`, matching every other personal-file
query in this codebase. The file-listing queries used by My Drive
(`fileRepository.findByFolderAndUser`) also gain a `LEFT JOIN favorites` so
`FileCard` knows whether to render its star filled or outline, the same
pattern already used for the approval-status badge added earlier.

## Frontend

**`FileCard.jsx`:** a star icon (outline when unstarred, filled/yellow when
starred) sits in the **top-left** corner of the thumbnail box. The approval
status badge added previously already occupies the top-right corner — the two
must not collide. Clicking the star calls the toggle mutation immediately;
no confirmation, no menu.

**Sidebar** ([Sidebar.jsx](../../../frontend/src/components/layout/Sidebar.jsx)):
new nav item "Starred" (star icon) positioned between "My Drive" and "Shared
with me".

**New page** `StarredFiles.jsx` (route `/starred`): fetches `GET
/files/starred` and renders the results through the existing `FileCard`
component unchanged, in a flat grid (no folder grouping, since results span
multiple folders). Empty state: "No starred files yet."

## Out of scope / follow-ups

- Starring folders.
- Starring items in Company Drive or Shared-with-me.

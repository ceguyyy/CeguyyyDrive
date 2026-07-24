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

**`files`** (migration adds):
- `is_starred BOOLEAN NOT NULL DEFAULT false`

No new tables — a single boolean is sufficient for a personal, per-user file
(files already belong to exactly one `user_id`).

## Backend

New endpoints in the existing personal-Drive file module (`fileController.js` /
`fileService.js` / `fileRepository.js` / `file.routes.js`) — this is
personal-Drive-only, so it belongs alongside the existing file endpoints, not
in a new module:

| Method | Path | Purpose |
|---|---|---|
| PATCH | `/files/:id/star` | Toggle `is_starred` for a file owned by the caller |
| GET | `/files/starred` | List every starred, non-deleted file owned by the caller, ordered by `updated_at DESC` |

Both scoped by `user_id = req.user.id`, matching every other personal-file
query in this codebase.

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

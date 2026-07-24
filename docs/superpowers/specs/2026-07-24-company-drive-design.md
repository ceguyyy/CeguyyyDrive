# Company Drive — Design Spec

Date: 2026-07-24

## Problem

Files and folders currently belong exclusively to a single user (`files.user_id`,
`folders.user_id`, both `NOT NULL`). Organizations have no shared storage space of
their own — everything a member uploads lives in their personal "My Drive" only.
There's an existing (unused) `organization_roles.storage_limit` column and a
half-wired frontend call to `PATCH /organizations/:orgId/members/:memberId/storage`
with no backend route behind it, suggesting a shared-drive-per-organization
feature was intended but never built.

This spec adds **Company Drive**: a storage space per organization, structured
around the same role hierarchy already built for `RoleHierarchyCanvas`
([frontend/src/components/organization/RoleHierarchyCanvas.jsx](../../../frontend/src/components/organization/RoleHierarchyCanvas.jsx)).

## Goals (v1)

- Every organization gets one root folder per Role, auto-created.
- Access to a folder (and everything nested inside it) is granted to: the role
  that owns it, and any ancestor role above it in the hierarchy (a superior can
  manage their subordinates' folders). Peers, unrelated branches, and superior
  folders are **fully hidden** from a subordinate — not shown read-only, not
  shown at all.
- Core file operations: browse folders/subfolders, create subfolder, upload,
  download, rename, soft-delete (trash), restore from a dedicated Company Drive
  trash.
- Sidebar navigation: a new collapsible "Company Drive" entry that expands to
  list the user's organizations (file-explorer-tree style), one level, no
  further nesting of the tree itself.

## Non-goals (v1)

- No storage quota enforcement. `organization_roles.storage_limit` remains
  informational/display-only for now (it is not wired to a blocking check on
  upload). Enforcing it is a follow-up.
- No public share links or "Submit for Approval" integration for Company Drive
  files — those stay personal-Drive-only for now.
- No automatic folder deletion/reparenting when a Role is deleted or moved in
  the Role Hierarchy canvas. A role's folder simply becomes orphaned (still
  reachable by the org Owner) rather than being cascaded away.
- No changes to existing personal-Drive behavior, endpoints, or queries.

## Data Model

Reuse the existing `folders` and `files` tables — no new tables.

**`folders`** (migration adds):
- `organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE` (nullable)
- `owner_role_id UUID REFERENCES organization_roles(id) ON DELETE SET NULL`
  (nullable; set only on the auto-created root folder for a role)
- `user_id` becomes **nullable** (currently `NOT NULL ... ON DELETE CASCADE`).
  A Company Drive root folder is not owned by any single user — if it were tied
  to whichever user triggered its creation, that user being removed later would
  cascade-delete the organization's folder.
- Add constraint: `CHECK (user_id IS NOT NULL OR organization_id IS NOT NULL)`.

**`files`** (migration adds):
- `organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE` (nullable)
- `user_id` stays `NOT NULL` — for a Company Drive file it now means "uploaded
  by", not "has exclusive access to". Access is derived from the folder tree,
  not from `files.user_id`.

Subfolders and files created underneath a role-root folder do **not** carry
their own `owner_role_id` — access is resolved by walking `parent_id` up to
the nearest ancestor folder that has one.

## Access Control

Given a user's role in an organization (`organization_members.role_name`,
matched against `organization_roles.name`) and a target folder/file inside
Company Drive:

1. Walk `parent_id` upward until hitting a folder with `owner_role_id` set —
   that is the owning role for the whole subtree.
2. Compute the set of "manageable roles" for the viewer: their own role, plus
   every descendant role in the hierarchy (recursive walk over
   `organization_roles.parent_role_id`, same shape of traversal already used
   by `computeDepths` in `RoleHierarchyCanvas.jsx`).
3. If the owning role is in that set → full access (list, upload, create
   subfolder, rename, delete, restore).
4. Otherwise → the folder/file does not appear in any listing at all.

The org Owner's role has no parent, so no other role is its ancestor — only a
member whose `role_name` is literally the Owner role can access the Owner's
folder, which in practice is the org owner (and whoever `transferOwner` has
most recently reassigned that role to).

A member whose `role_name` doesn't match any current `organization_roles.name`
(stale after a role rename/delete) is treated as having no role — no Company
Drive folders are shown to them. Rare edge case, acceptable for v1.

## Backend

New, parallel code — does not touch existing personal-Drive files
(`fileRepository.js`, `folderRepository.js`, `fileService.js`, `folderService.js`,
their controllers/routes):

- `backend/src/repositories/orgDriveRepository.js`
- `backend/src/services/orgDriveService.js`
- `backend/src/controllers/orgDriveController.js`
- `backend/src/routes/orgDrive.routes.js`, mounted at `/organizations/:orgId/drive`

| Method | Path | Purpose |
|---|---|---|
| GET | `/organizations/:orgId/drive/folders/:folderId?` | List subfolders + files (no `folderId` → role-root folders visible to the caller) |
| POST | `/organizations/:orgId/drive/folders` | Create subfolder |
| POST | `/organizations/:orgId/drive/upload-url` | Presigned upload URL + file record (reuses `cosService`) |
| GET | `/organizations/:orgId/drive/download-url/:fileId` | Presigned download URL |
| PATCH | `/organizations/:orgId/drive/folders/:id` \| `/files/:id` | Rename |
| DELETE | `/organizations/:orgId/drive/folders/:id` \| `/files/:id` | Soft delete (trash) |
| GET | `/organizations/:orgId/drive/trash` | List trashed items visible to caller |
| POST | `/organizations/:orgId/drive/trash/:type/:id/restore` | Restore |

Every endpoint runs the access check above in the service layer before acting.
Root role-folders themselves cannot be renamed or trashed through these
endpoints (only their contents can) — mirrors how the Owner node can't be
deleted in the hierarchy canvas.

### Role-folder provisioning

- `organizationRepository.createOrganization`: after seeding the default Owner
  / Manager / Staff roles, create one root folder per role in the same
  transaction (`organization_id` + `owner_role_id` set, `user_id` NULL).
- `organizationService.saveRoles` (existing Role Hierarchy canvas save path):
  for any role in the payload that is newly created (no prior matching id),
  create its root folder. For any existing role whose `name` changed, rename
  its root folder to match.
- Deleting a role via the canvas does not delete or reparent its folder.

## Frontend

**Sidebar** ([Sidebar.jsx](../../../frontend/src/components/layout/Sidebar.jsx)):
new collapsible "Company Drive" nav entry below "My Drive". Expands to list the
user's organizations (reusing the existing `/organizations` query already used
elsewhere); selecting one navigates into that org's drive.

```
📁 My Drive
🏢 Company Drive        ▾
   📦 PT Contoh A
   📦 PT Contoh B
👥 Shared with me
☑  Approvals
🏢 Organization
🗑  Trash
```

**Routes:**
- `/company-drive/:orgId` — root (role-root folders visible to the user)
- `/company-drive/:orgId/folders/:folderId` — subfolder contents
- `/company-drive/:orgId/trash` — organization-scoped trash

**Pages/components:**
- `CompanyDrivePage.jsx` — structurally like `Dashboard.jsx` but calling the
  `/organizations/:orgId/drive/...` endpoints. Reuses `FileGrid`, `FileCard`,
  `FolderCard`, `ContextMenu` unchanged — because the backend already filters
  to only what the viewer may manage, the frontend needs no extra permission
  logic: anything listed is fully actionable. "Share" and "Submit for Approval"
  menu items are omitted in this context (out of v1 scope).
- `CompanyDriveTrash.jsx` — same shape as the existing personal Trash page,
  pointed at the org-scoped trash endpoints.
- `useOrgUpload(orgId, folderId)` hook — mirrors `useUpload.js` but targets the
  org drive upload endpoints, including the folder-structure-on-drop logic.

Root role-folders hide their Rename/Trash actions in the UI (only their
contents show those actions).

## Out of scope / follow-ups

- Enforcing `organization_roles.storage_limit` as an upload-blocking quota.
- Share links and approval submission for Company Drive files.
- Cascading folder rename/delete/reparent when roles change shape in the
  hierarchy canvas beyond simple create/rename.

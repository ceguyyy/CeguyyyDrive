# Company Drive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every organization a shared "Company Drive" — one root folder per Role, where access to a folder (and everything nested inside it) is granted to that role and any role above it in the hierarchy, and hidden entirely from everyone else.

**Architecture:** Reuse the existing `folders`/`files` tables (new nullable `organization_id` + `owner_role_id` columns) instead of a parallel schema. A fully separate backend module (`orgDriveRepository`/`orgDriveService`/`orgDriveController`/`orgDrive.routes.js`) implements org-scoped, role-hierarchy-based access control without touching the existing personal-Drive code. The frontend gets small, purpose-built components (`OrgFolderCard`, `OrgFileCard`, `OrgFileGrid`) rather than retrofitting the personal-Drive components, because those are tightly coupled to drag-and-drop/clipboard logic that Company Drive v1 doesn't use.

**Tech Stack:** Node/Express/PostgreSQL (`pg`) backend, React/MUI/TanStack Query frontend — matching the rest of the codebase.

**Spec:** [docs/superpowers/specs/2026-07-24-company-drive-design.md](../specs/2026-07-24-company-drive-design.md)

**A note on verification steps:** this repository has no automated test framework (no Jest/Vitest config, no `*.test.js` files, no `test` script in `package.json`). Rather than introduce test infrastructure as a side effect of this feature, each task's "Verify" step is a concrete manual check — a `curl` command with expected JSON, a SQL query with expected rows, or an exact UI click-through — following the project's existing convention of no automated tests.

---

## Part A — Database & existing Organization backend fixes

### Task A1: Migration — add Company Drive columns

**Files:**
- Create: `backend/src/db/migrations/005_add_company_drive.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Company Drive: shared, role-scoped storage per organization

-- A folder can now belong to either a personal user OR an organization (never neither)
ALTER TABLE folders ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE folders ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE folders ADD COLUMN owner_role_id UUID REFERENCES organization_roles(id) ON DELETE SET NULL;
ALTER TABLE folders ADD CONSTRAINT folders_user_or_org_check CHECK (user_id IS NOT NULL OR organization_id IS NOT NULL);
CREATE UNIQUE INDEX idx_folders_owner_role_id_unique ON folders(owner_role_id) WHERE owner_role_id IS NOT NULL;
CREATE INDEX idx_folders_organization_id ON folders(organization_id);

-- A file uploaded into Company Drive is tagged with the organization; user_id still records the uploader
ALTER TABLE files ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
CREATE INDEX idx_files_organization_id ON files(organization_id);
```

- [ ] **Step 2: Run the migration**

Run: `cd backend && npm run migrate`

Expected output includes:
```
Applying migration: 005_add_company_drive
Successfully applied 005_add_company_drive
All migrations applied successfully.
```

- [ ] **Step 3: Verify the columns exist**

Run (adjust connection as needed, or use whatever DB client the project already uses):

```bash
cd backend && node -e "
const db = require('./src/config/db');
db.query(\"SELECT column_name FROM information_schema.columns WHERE table_name='folders' AND column_name IN ('organization_id','owner_role_id')\").then(r => { console.log(r.rows); process.exit(0); });
"
```

Expected: prints both `organization_id` and `owner_role_id` rows.

- [ ] **Step 4: Commit**

```bash
git add backend/src/db/migrations/005_add_company_drive.sql
git commit -m "feat: add Company Drive columns to folders and files"
```

---

### Task A2: Fix `organizationRepository.createOrganization` — provision role-root folders

**Files:**
- Modify: `backend/src/repositories/organizationRepository.js:4-50`

**Why:** every org needs one root folder per default role (Owner/Manager/Staff), created atomically with the roles themselves.

- [ ] **Step 1: Replace `createOrganization`**

Replace the existing method (lines 4-50) with:

```javascript
    async createOrganization(name, ownerId) {
        const client = await db.getClient();
        try {
            await client.query('BEGIN');
            const orgRes = await client.query(
                `INSERT INTO organizations (name, owner_id) VALUES ($1, $2) RETURNING *`,
                [name, ownerId]
            );
            const org = orgRes.rows[0];

            // Add owner as accepted Owner member
            await client.query(
                `INSERT INTO organization_members (organization_id, user_id, email, role_name, status) 
                 SELECT $1, id, email, 'Owner', 'accepted' FROM users WHERE id = $2`,
                [org.id, ownerId]
            );

            // Add default roles (Owner, Manager, Staff)
            const ceoRes = await client.query(
                `INSERT INTO organization_roles (organization_id, name, parent_role_id, canvas_position_x, canvas_position_y, color) 
                 VALUES ($1, 'Owner', NULL, 300, 50, '#EF4444') RETURNING id`,
                [org.id]
            );
            const ceoId = ceoRes.rows[0].id;

            const mgrRes = await client.query(
                `INSERT INTO organization_roles (organization_id, name, parent_role_id, canvas_position_x, canvas_position_y, color) 
                 VALUES ($1, 'Manager', $2, 250, 180, '#3B82F6') RETURNING id`,
                [org.id, ceoId]
            );
            const mgrId = mgrRes.rows[0].id;

            const staffRes = await client.query(
                `INSERT INTO organization_roles (organization_id, name, parent_role_id, canvas_position_x, canvas_position_y, color) 
                 VALUES ($1, 'Staff', $2, 250, 310, '#10B981') RETURNING id`,
                [org.id, mgrId]
            );
            const staffId = staffRes.rows[0].id;

            // Company Drive: one root folder per default role
            await client.query(
                `INSERT INTO folders (name, organization_id, owner_role_id, user_id) VALUES ($1, $2, $3, NULL)`,
                ['Owner', org.id, ceoId]
            );
            await client.query(
                `INSERT INTO folders (name, organization_id, owner_role_id, user_id) VALUES ($1, $2, $3, NULL)`,
                ['Manager', org.id, mgrId]
            );
            await client.query(
                `INSERT INTO folders (name, organization_id, owner_role_id, user_id) VALUES ($1, $2, $3, NULL)`,
                ['Staff', org.id, staffId]
            );

            await client.query('COMMIT');
            return org;
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }
```

- [ ] **Step 2: Verify by creating an org through the running API**

Start the backend (`cd backend && npm run dev`) if not already running, then:

```bash
TOKEN=$(curl -s -X POST http://localhost:8080/v1/auth/register -H "Content-Type: application/json" \
  -d '{"email":"cd-owner@test.com","password":"password123","fullName":"CD Owner","ticket":"t","randstr":"r"}' \
  | node -e "process.stdout.write(JSON.parse(require('fs').readFileSync(0,'utf8')).data.accessToken)")

ORG_ID=$(curl -s -X POST http://localhost:8080/v1/organizations -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" -d '{"name":"CD Test Org"}' \
  | node -e "process.stdout.write(JSON.parse(require('fs').readFileSync(0,'utf8')).data.organization.id)")

echo "Org: $ORG_ID"

cd backend && node -e "
const db = require('./src/config/db');
db.query('SELECT name, owner_role_id FROM folders WHERE organization_id = \$1 ORDER BY name', ['$ORG_ID'])
  .then(r => { console.log(r.rows); process.exit(0); });
"
```

Expected: 3 rows — `Manager`, `Owner`, `Staff` — each with a non-null `owner_role_id`.

- [ ] **Step 3: Commit**

```bash
git add backend/src/repositories/organizationRepository.js
git commit -m "feat: auto-provision Company Drive root folders on organization creation"
```

---

### Task A3: Fix `organizationRepository.saveRoles` — safe upsert instead of delete-all/insert-all

**Files:**
- Modify: `backend/src/repositories/organizationRepository.js` (the `saveRoles` method)

**Why:** the current implementation does `DELETE FROM organization_roles WHERE organization_id = $1` then re-inserts every role fresh. Because `folders.owner_role_id` has `ON DELETE SET NULL`, that delete — even for roles whose id is immediately reinserted unchanged — fires the cascade and permanently unlinks every Company Drive root folder from its role on every single Save from the Role Hierarchy canvas. This must change to a targeted delete (only roles genuinely removed) plus `ON CONFLICT (id) DO UPDATE` for the rest, and then keep each role's root folder in sync (create if missing, rename if the role was renamed).

- [ ] **Step 1: Replace `saveRoles`**

```javascript
    async saveRoles(orgId, roles) {
        const client = await db.getClient();
        try {
            await client.query('BEGIN');

            const incomingIds = roles.filter(r => r.id).map(r => r.id);
            if (incomingIds.length > 0) {
                await client.query(
                    `DELETE FROM organization_roles WHERE organization_id = $1 AND id != ALL($2::uuid[])`,
                    [orgId, incomingIds]
                );
            } else {
                await client.query(`DELETE FROM organization_roles WHERE organization_id = $1`, [orgId]);
            }

            const upserted = [];
            for (const r of roles) {
                const res = await client.query(
                    `INSERT INTO organization_roles (id, organization_id, name, parent_role_id, canvas_position_x, canvas_position_y, color, storage_limit)
                     VALUES (COALESCE($1, uuid_generate_v4()), $2, $3, $4, $5, $6, $7, $8)
                     ON CONFLICT (id) DO UPDATE SET
                        name = EXCLUDED.name,
                        parent_role_id = EXCLUDED.parent_role_id,
                        canvas_position_x = EXCLUDED.canvas_position_x,
                        canvas_position_y = EXCLUDED.canvas_position_y,
                        color = EXCLUDED.color,
                        storage_limit = EXCLUDED.storage_limit
                     RETURNING *`,
                    [r.id || null, orgId, r.name, r.parent_role_id || null, r.canvas_position_x || 250, r.canvas_position_y || 100, r.color || '#3B82F6', r.storage_limit || null]
                );
                upserted.push(res.rows[0]);
            }

            // Company Drive: ensure every current role has a root folder, name kept in sync
            for (const role of upserted) {
                const existing = await client.query(
                    `SELECT id FROM folders WHERE owner_role_id = $1`,
                    [role.id]
                );
                if (existing.rows.length === 0) {
                    await client.query(
                        `INSERT INTO folders (name, organization_id, owner_role_id, user_id) VALUES ($1, $2, $3, NULL)`,
                        [role.name, orgId, role.id]
                    );
                } else {
                    await client.query(
                        `UPDATE folders SET name = $1 WHERE owner_role_id = $2`,
                        [role.name, role.id]
                    );
                }
            }

            await client.query('COMMIT');
            return upserted;
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }
```

- [ ] **Step 2: Verify roles keep their folders across repeated saves**

Using the `$TOKEN` and `$ORG_ID` from Task A2's verification (re-run those two `curl` lines first if you're in a new shell):

```bash
# Fetch current roles, then re-save them completely unchanged
ROLES=$(curl -s http://localhost:8080/v1/organizations/$ORG_ID/roles -H "Authorization: Bearer $TOKEN")
echo "$ROLES" | node -e "
const roles = JSON.parse(require('fs').readFileSync(0,'utf8')).data.roles;
console.log(JSON.stringify({ roles }));
" > /tmp/roles_payload.json

curl -s -X POST http://localhost:8080/v1/organizations/$ORG_ID/roles \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  --data @/tmp/roles_payload.json > /dev/null

cd backend && node -e "
const db = require('./src/config/db');
db.query('SELECT name, owner_role_id FROM folders WHERE organization_id = \$1 ORDER BY name', ['$ORG_ID'])
  .then(r => { console.log(r.rows); process.exit(0); });
"
```

Expected: still exactly 3 rows (`Manager`, `Owner`, `Staff`), each with the SAME non-null `owner_role_id` values as in Task A2 — proving the save did not orphan the folders.

- [ ] **Step 3: Commit**

```bash
git add backend/src/repositories/organizationRepository.js
git commit -m "fix: saveRoles now upserts instead of delete-all/insert-all, preserving Company Drive folder links"
```

---

## Part B — Org Drive backend module

### Task B1: `orgDriveRepository.js` — data access

**Files:**
- Create: `backend/src/repositories/orgDriveRepository.js`

- [ ] **Step 1: Write the repository**

```javascript
const db = require('../config/db');

class OrgDriveRepository {
    async findAcceptedMembership(orgId, userId) {
        const result = await db.query(
            `SELECT * FROM organization_members WHERE organization_id = $1 AND user_id = $2 AND status = 'accepted'`,
            [orgId, userId]
        );
        return result.rows[0];
    }

    // The viewer's own role, plus every role below it in the hierarchy (self + descendants)
    async getManageableRoleIds(orgId, roleName) {
        const result = await db.query(
            `WITH RECURSIVE role_tree AS (
                SELECT id FROM organization_roles WHERE organization_id = $1 AND LOWER(name) = LOWER($2)
                UNION ALL
                SELECT r.id FROM organization_roles r
                INNER JOIN role_tree rt ON r.parent_role_id = rt.id
            )
            SELECT id FROM role_tree`,
            [orgId, roleName]
        );
        return result.rows.map(row => row.id);
    }

    // Walk parent_id upward from a folder until hitting the nearest role-root folder
    async findOwningRoleId(folderId) {
        const result = await db.query(
            `WITH RECURSIVE ancestry AS (
                SELECT id, parent_id, owner_role_id, 0 AS depth FROM folders WHERE id = $1
                UNION ALL
                SELECT f.id, f.parent_id, f.owner_role_id, a.depth + 1
                FROM folders f INNER JOIN ancestry a ON f.id = a.parent_id
            )
            SELECT owner_role_id FROM ancestry WHERE owner_role_id IS NOT NULL ORDER BY depth ASC LIMIT 1`,
            [folderId]
        );
        return result.rows[0]?.owner_role_id || null;
    }

    // For every folder in the org, resolve which role-root it belongs to (used for trash listing)
    async getFolderOwnerMap(orgId) {
        const result = await db.query(
            `WITH RECURSIVE folder_owner AS (
                SELECT id, owner_role_id FROM folders
                WHERE organization_id = $1 AND owner_role_id IS NOT NULL
                UNION ALL
                SELECT f.id, fo.owner_role_id FROM folders f
                INNER JOIN folder_owner fo ON f.parent_id = fo.id
                WHERE f.organization_id = $1
            )
            SELECT id, owner_role_id FROM folder_owner`,
            [orgId]
        );
        const map = {};
        result.rows.forEach(r => { map[r.id] = r.owner_role_id; });
        return map;
    }

    async findRootFolders(orgId, manageableRoleIds) {
        if (manageableRoleIds.length === 0) return [];
        const result = await db.query(
            `SELECT f.* FROM folders f
             WHERE f.organization_id = $1 AND f.owner_role_id = ANY($2::uuid[]) AND f.is_deleted = false
             ORDER BY f.name ASC`,
            [orgId, manageableRoleIds]
        );
        return result.rows;
    }

    async findFolderById(folderId, orgId, includeDeleted = false) {
        const result = await db.query(
            `SELECT * FROM folders WHERE id = $1 AND organization_id = $2 AND is_deleted = $3`,
            [folderId, orgId, includeDeleted]
        );
        return result.rows[0];
    }

    async findSubfolders(parentId, orgId) {
        const result = await db.query(
            `SELECT * FROM folders WHERE parent_id = $1 AND organization_id = $2 AND is_deleted = false ORDER BY name ASC`,
            [parentId, orgId]
        );
        return result.rows;
    }

    async findFiles(folderId, orgId) {
        const result = await db.query(
            `SELECT * FROM files WHERE folder_id = $1 AND organization_id = $2 AND is_deleted = false ORDER BY original_name ASC`,
            [folderId, orgId]
        );
        return result.rows;
    }

    async findByNameAndParent(name, parentId, orgId) {
        const result = await db.query(
            `SELECT * FROM folders WHERE name = $1 AND parent_id = $2 AND organization_id = $3 AND is_deleted = false`,
            [name, parentId, orgId]
        );
        return result.rows[0];
    }

    async createFolder(name, parentId, orgId) {
        const result = await db.query(
            `INSERT INTO folders (name, parent_id, organization_id, user_id) VALUES ($1, $2, $3, NULL) RETURNING *`,
            [name, parentId, orgId]
        );
        return result.rows[0];
    }

    async renameFolder(folderId, name) {
        const result = await db.query(
            `UPDATE folders SET name = $1 WHERE id = $2 RETURNING *`,
            [name, folderId]
        );
        return result.rows[0];
    }

    async softDeleteFolder(folderId) {
        const result = await db.query(`UPDATE folders SET is_deleted = true WHERE id = $1 RETURNING *`, [folderId]);
        return result.rows[0];
    }

    async restoreFolder(folderId) {
        const result = await db.query(`UPDATE folders SET is_deleted = false WHERE id = $1 RETURNING *`, [folderId]);
        return result.rows[0];
    }

    async getAncestors(folderId, orgId) {
        const ancestors = [];
        let currentId = folderId;
        while (currentId) {
            const folder = await this.findFolderById(currentId, orgId);
            if (!folder || !folder.parent_id) break;
            const parentFolder = await this.findFolderById(folder.parent_id, orgId);
            if (!parentFolder) break;
            ancestors.unshift({ id: parentFolder.id, name: parentFolder.name });
            currentId = parentFolder.id;
        }
        return ancestors;
    }

    async createFile(originalName, size, mimeType, storageKey, folderId, orgId, uploaderId) {
        const result = await db.query(
            `INSERT INTO files (original_name, size, mime_type, storage_key, folder_id, organization_id, user_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [originalName, size, mimeType, storageKey, folderId, orgId, uploaderId]
        );
        return result.rows[0];
    }

    async findFileById(fileId, orgId, includeDeleted = false) {
        const result = await db.query(
            `SELECT * FROM files WHERE id = $1 AND organization_id = $2 AND is_deleted = $3`,
            [fileId, orgId, includeDeleted]
        );
        return result.rows[0];
    }

    async renameFile(fileId, name) {
        const result = await db.query(
            `UPDATE files SET original_name = $1 WHERE id = $2 RETURNING *`,
            [name, fileId]
        );
        return result.rows[0];
    }

    async softDeleteFile(fileId) {
        const result = await db.query(`UPDATE files SET is_deleted = true WHERE id = $1 RETURNING *`, [fileId]);
        return result.rows[0];
    }

    async restoreFile(fileId) {
        const result = await db.query(`UPDATE files SET is_deleted = false WHERE id = $1 RETURNING *`, [fileId]);
        return result.rows[0];
    }

    async findTrashedFolders(orgId) {
        const result = await db.query(`SELECT * FROM folders WHERE organization_id = $1 AND is_deleted = true`, [orgId]);
        return result.rows;
    }

    async findTrashedFiles(orgId) {
        const result = await db.query(`SELECT * FROM files WHERE organization_id = $1 AND is_deleted = true`, [orgId]);
        return result.rows;
    }
}

module.exports = new OrgDriveRepository();
```

- [ ] **Step 2: Verify the recursive role-tree query works standalone**

Using `$ORG_ID` from Task A2:

```bash
cd backend && node -e "
const orgDriveRepository = require('./src/repositories/orgDriveRepository');
orgDriveRepository.getManageableRoleIds('$ORG_ID', 'Owner').then(ids => { console.log('Owner manages', ids.length, 'roles'); process.exit(0); });
"
```

Expected: `Owner manages 3 roles` (Owner + Manager + Staff, since Owner is the top of the hierarchy).

```bash
cd backend && node -e "
const orgDriveRepository = require('./src/repositories/orgDriveRepository');
orgDriveRepository.getManageableRoleIds('$ORG_ID', 'Staff').then(ids => { console.log('Staff manages', ids.length, 'roles'); process.exit(0); });
"
```

Expected: `Staff manages 1 roles` (Staff is a leaf — only manages itself).

- [ ] **Step 3: Commit**

```bash
git add backend/src/repositories/orgDriveRepository.js
git commit -m "feat: add orgDriveRepository for Company Drive data access"
```

---

### Task B2: `orgDriveService.js` — access control & business logic

**Files:**
- Create: `backend/src/services/orgDriveService.js`

- [ ] **Step 1: Write the service**

```javascript
const orgDriveRepository = require('../repositories/orgDriveRepository');
const organizationRepository = require('../repositories/organizationRepository');
const AppError = require('../utils/AppError');

class OrgDriveService {
    async _getViewerContext(orgId, userId) {
        const org = await organizationRepository.findOrganizationById(orgId);
        if (!org) throw new AppError('Organization not found', 404);

        const membership = await orgDriveRepository.findAcceptedMembership(orgId, userId);
        const roleName = membership ? membership.role_name : null;

        const manageableRoleIds = roleName
            ? await orgDriveRepository.getManageableRoleIds(orgId, roleName)
            : [];

        return { org, roleName, manageableRoleIds, isOrgOwner: org.owner_id === userId };
    }

    async _assertCanAccessFolder(orgId, userId, folderId) {
        const ctx = await this._getViewerContext(orgId, userId);
        const owningRoleId = await orgDriveRepository.findOwningRoleId(folderId);

        if (!owningRoleId) {
            if (!ctx.isOrgOwner) throw new AppError('You do not have access to this folder', 403);
            return ctx;
        }

        if (!ctx.manageableRoleIds.includes(owningRoleId)) {
            throw new AppError('You do not have access to this folder', 403);
        }
        return ctx;
    }

    async listRoot(orgId, userId) {
        const ctx = await this._getViewerContext(orgId, userId);
        const rootFolders = await orgDriveRepository.findRootFolders(orgId, ctx.manageableRoleIds);
        return { folder: null, ancestors: [], subfolders: rootFolders, files: [] };
    }

    async listFolder(orgId, userId, folderId) {
        await this._assertCanAccessFolder(orgId, userId, folderId);
        const folder = await orgDriveRepository.findFolderById(folderId, orgId);
        if (!folder) throw new AppError('Folder not found', 404);
        const ancestors = await orgDriveRepository.getAncestors(folderId, orgId);
        const subfolders = await orgDriveRepository.findSubfolders(folderId, orgId);
        const files = await orgDriveRepository.findFiles(folderId, orgId);
        return { folder, ancestors, subfolders, files };
    }

    async createSubfolder(orgId, userId, parentFolderId, name) {
        await this._assertCanAccessFolder(orgId, userId, parentFolderId);
        const existing = await orgDriveRepository.findByNameAndParent(name, parentFolderId, orgId);
        if (existing) throw new AppError('A folder with this name already exists in this location', 400);
        return await orgDriveRepository.createFolder(name, parentFolderId, orgId);
    }

    async renameFolder(orgId, userId, folderId, name) {
        await this._assertCanAccessFolder(orgId, userId, folderId);
        const folder = await orgDriveRepository.findFolderById(folderId, orgId);
        if (!folder) throw new AppError('Folder not found', 404);
        if (folder.owner_role_id) throw new AppError('Role root folders cannot be renamed', 400);
        return await orgDriveRepository.renameFolder(folderId, name);
    }

    async deleteFolder(orgId, userId, folderId) {
        await this._assertCanAccessFolder(orgId, userId, folderId);
        const folder = await orgDriveRepository.findFolderById(folderId, orgId);
        if (!folder) throw new AppError('Folder not found', 404);
        if (folder.owner_role_id) throw new AppError('Role root folders cannot be deleted', 400);
        return await orgDriveRepository.softDeleteFolder(folderId);
    }

    async createFileRecord(orgId, userId, parentFolderId, originalName, size, mimeType, storageKey) {
        await this._assertCanAccessFolder(orgId, userId, parentFolderId);
        return await orgDriveRepository.createFile(originalName, size, mimeType, storageKey, parentFolderId, orgId, userId);
    }

    async renameFile(orgId, userId, fileId, name) {
        const file = await orgDriveRepository.findFileById(fileId, orgId);
        if (!file) throw new AppError('File not found', 404);
        await this._assertCanAccessFolder(orgId, userId, file.folder_id);
        return await orgDriveRepository.renameFile(fileId, name);
    }

    async deleteFile(orgId, userId, fileId) {
        const file = await orgDriveRepository.findFileById(fileId, orgId);
        if (!file) throw new AppError('File not found', 404);
        await this._assertCanAccessFolder(orgId, userId, file.folder_id);
        return await orgDriveRepository.softDeleteFile(fileId);
    }

    async getDownloadTarget(orgId, userId, fileId) {
        const file = await orgDriveRepository.findFileById(fileId, orgId);
        if (!file) throw new AppError('File not found', 404);
        await this._assertCanAccessFolder(orgId, userId, file.folder_id);
        return file;
    }

    async listTrash(orgId, userId) {
        const ctx = await this._getViewerContext(orgId, userId);
        const ownerMap = await orgDriveRepository.getFolderOwnerMap(orgId);

        const canSee = (folderId) => {
            const owningRoleId = ownerMap[folderId];
            if (!owningRoleId) return ctx.isOrgOwner;
            return ctx.manageableRoleIds.includes(owningRoleId);
        };

        const allFolders = await orgDriveRepository.findTrashedFolders(orgId);
        const allFiles = await orgDriveRepository.findTrashedFiles(orgId);

        return {
            folders: allFolders.filter(f => canSee(f.id)),
            files: allFiles.filter(f => canSee(f.folder_id))
        };
    }

    async restoreItem(orgId, userId, type, id) {
        if (type === 'file') {
            const file = await orgDriveRepository.findFileById(id, orgId, true);
            if (!file) throw new AppError('File not found in trash', 404);
            await this._assertCanAccessFolder(orgId, userId, file.folder_id);
            return await orgDriveRepository.restoreFile(id);
        } else if (type === 'folder') {
            const folder = await orgDriveRepository.findFolderById(id, orgId, true);
            if (!folder) throw new AppError('Folder not found in trash', 404);
            await this._assertCanAccessFolder(orgId, userId, folder.id);
            return await orgDriveRepository.restoreFolder(id);
        }
        throw new AppError('Invalid item type', 400);
    }
}

module.exports = new OrgDriveService();
```

- [ ] **Step 2: Commit**

The full access-control verification (two users, two roles) needs the routes from Task B4 to actually be reachable over HTTP — it's run there instead of here.

```bash
git add backend/src/services/orgDriveService.js
git commit -m "feat: add orgDriveService with role-hierarchy access control"
```

---

### Task B3: `orgDriveController.js`

**Files:**
- Create: `backend/src/controllers/orgDriveController.js`

- [ ] **Step 1: Write the controller**

```javascript
const { z } = require('zod');
const orgDriveService = require('../services/orgDriveService');
const cosService = require('../services/cosService');

const createFolderSchema = z.object({
    name: z.string().min(1).max(255),
    parentId: z.string().uuid()
});

const renameSchema = z.object({
    name: z.string().min(1).max(255)
});

const uploadUrlSchema = z.object({
    fileName: z.string().min(1).max(255),
    size: z.number().int().nonnegative(),
    mimeType: z.string().min(1).max(100),
    folderId: z.string().uuid()
});

const restoreSchema = z.object({
    type: z.enum(['file', 'folder']),
    id: z.string().uuid()
});

exports.listFolder = async (req, res, next) => {
    try {
        const { orgId, folderId } = req.params;
        const data = folderId === 'root'
            ? await orgDriveService.listRoot(orgId, req.user.id)
            : await orgDriveService.listFolder(orgId, req.user.id, folderId);
        res.status(200).json({ status: 'success', data });
    } catch (err) {
        next(err);
    }
};

exports.createFolder = async (req, res, next) => {
    try {
        const { orgId } = req.params;
        const { name, parentId } = createFolderSchema.parse(req.body);
        const folder = await orgDriveService.createSubfolder(orgId, req.user.id, parentId, name);
        res.status(201).json({ status: 'success', data: { folder } });
    } catch (err) {
        next(err);
    }
};

exports.renameFolder = async (req, res, next) => {
    try {
        const { orgId, id } = req.params;
        const { name } = renameSchema.parse(req.body);
        const folder = await orgDriveService.renameFolder(orgId, req.user.id, id, name);
        res.status(200).json({ status: 'success', data: { folder } });
    } catch (err) {
        next(err);
    }
};

exports.deleteFolder = async (req, res, next) => {
    try {
        const { orgId, id } = req.params;
        await orgDriveService.deleteFolder(orgId, req.user.id, id);
        res.status(204).send();
    } catch (err) {
        next(err);
    }
};

exports.generateUploadUrl = async (req, res, next) => {
    try {
        const { orgId } = req.params;
        const { fileName, size, mimeType, folderId } = uploadUrlSchema.parse(req.body);

        const storageKey = cosService.generateObjectKey(req.user.id, fileName);
        const file = await orgDriveService.createFileRecord(orgId, req.user.id, folderId, fileName, size, mimeType, storageKey);
        const uploadUrl = await cosService.getPresignedUploadUrl(storageKey);

        res.status(200).json({ status: 'success', data: { uploadUrl, fileId: file.id, storageKey } });
    } catch (err) {
        next(err);
    }
};

exports.generateDownloadUrl = async (req, res, next) => {
    try {
        const { orgId, fileId } = req.params;
        const file = await orgDriveService.getDownloadTarget(orgId, req.user.id, fileId);
        const downloadUrl = await cosService.getPresignedDownloadUrl(file.storage_key, true, file.mime_type);
        res.status(200).json({ status: 'success', data: { downloadUrl } });
    } catch (err) {
        next(err);
    }
};

exports.renameFile = async (req, res, next) => {
    try {
        const { orgId, id } = req.params;
        const { name } = renameSchema.parse(req.body);
        const file = await orgDriveService.renameFile(orgId, req.user.id, id, name);
        res.status(200).json({ status: 'success', data: { file } });
    } catch (err) {
        next(err);
    }
};

exports.deleteFile = async (req, res, next) => {
    try {
        const { orgId, id } = req.params;
        await orgDriveService.deleteFile(orgId, req.user.id, id);
        res.status(204).send();
    } catch (err) {
        next(err);
    }
};

exports.getTrash = async (req, res, next) => {
    try {
        const { orgId } = req.params;
        const trash = await orgDriveService.listTrash(orgId, req.user.id);
        res.status(200).json({ status: 'success', data: trash });
    } catch (err) {
        next(err);
    }
};

exports.restoreItem = async (req, res, next) => {
    try {
        const { orgId } = req.params;
        const { type, id } = restoreSchema.parse(req.body);
        const restoredItem = await orgDriveService.restoreItem(orgId, req.user.id, type, id);
        res.status(200).json({ status: 'success', data: { restoredItem } });
    } catch (err) {
        next(err);
    }
};
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/controllers/orgDriveController.js
git commit -m "feat: add orgDriveController"
```

---

### Task B4: Routes — `orgDrive.routes.js` mounted under `organization.routes.js`

**Files:**
- Create: `backend/src/routes/orgDrive.routes.js`
- Modify: `backend/src/routes/organization.routes.js`

- [ ] **Step 1: Write the routes file**

```javascript
const express = require('express');
const orgDriveController = require('../controllers/orgDriveController');

// mergeParams so :orgId from the parent router (organization.routes.js) is visible here
const router = express.Router({ mergeParams: true });

router.get('/folders/:folderId', orgDriveController.listFolder);
router.post('/folders', orgDriveController.createFolder);
router.patch('/folders/:id', orgDriveController.renameFolder);
router.delete('/folders/:id', orgDriveController.deleteFolder);

router.post('/upload-url', orgDriveController.generateUploadUrl);
router.get('/download-url/:fileId', orgDriveController.generateDownloadUrl);
router.patch('/files/:id', orgDriveController.renameFile);
router.delete('/files/:id', orgDriveController.deleteFile);

router.get('/trash', orgDriveController.getTrash);
router.post('/trash/restore', orgDriveController.restoreItem);

module.exports = router;
```

- [ ] **Step 2: Mount it in `organization.routes.js`**

In `backend/src/routes/organization.routes.js`, add the import near the top and the mount line at the end (auth is already applied via the existing `router.use(authMiddleware.protect)` on line 7, so the nested router inherits it):

```javascript
const express = require('express');
const organizationController = require('../controllers/organizationController');
const authMiddleware = require('../middlewares/authMiddleware');
const orgDriveRoutes = require('./orgDrive.routes');

const router = express.Router();

router.use(authMiddleware.protect);

router.post('/', organizationController.createOrganization);
router.get('/', organizationController.getUserOrganizations);
router.post('/:orgId/invite', organizationController.inviteMember);
router.post('/:orgId/respond', organizationController.respondToInvitation);
router.get('/:orgId/members', organizationController.getMembers);
router.get('/:orgId/roles', organizationController.getRoles);
router.post('/:orgId/roles', organizationController.saveRoles);
router.delete('/:orgId', organizationController.deleteOrganization);
router.delete('/:orgId/members/:memberId', organizationController.removeMember);
router.post('/:orgId/transfer-owner', organizationController.transferOwner);
router.use('/:orgId/drive', orgDriveRoutes);

module.exports = router;
```

- [ ] **Step 3: Restart the backend and verify access control with two users of different roles**

This is the core correctness check for the whole feature — confirm a Staff-role user cannot see or touch a Manager's folder, and Owner sees everything. Restart `npm run dev` if it doesn't auto-reload, then:

```bash
# Assumes $TOKEN (Owner) and $ORG_ID exist from Task A2

# Register a second user who will become a Staff member
STAFF_TOKEN=$(curl -s -X POST http://localhost:8080/v1/auth/register -H "Content-Type: application/json" \
  -d '{"email":"cd-staffer@test.com","password":"password123","fullName":"CD Staffer","ticket":"t","randstr":"r"}' \
  | node -e "process.stdout.write(JSON.parse(require('fs').readFileSync(0,'utf8')).data.accessToken)")

# Owner invites them as Staff
curl -s -X POST http://localhost:8080/v1/organizations/$ORG_ID/invite -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" -d '{"email":"cd-staffer@test.com","roleName":"Staff"}' > /dev/null

# Staffer accepts
curl -s -X POST http://localhost:8080/v1/organizations/$ORG_ID/respond -H "Content-Type: application/json" \
  -H "Authorization: Bearer $STAFF_TOKEN" -d '{"accept":true}' > /dev/null

# Find the Manager folder's id (Owner can see all root folders)
MANAGER_FOLDER_ID=$(curl -s http://localhost:8080/v1/organizations/$ORG_ID/drive/folders/root \
  -H "Authorization: Bearer $TOKEN" \
  | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')).data; process.stdout.write(d.subfolders.find(f=>f.name==='Manager').id)")

echo "Manager folder: $MANAGER_FOLDER_ID"

# As Owner: root listing should show 3 role folders
curl -s http://localhost:8080/v1/organizations/$ORG_ID/drive/folders/root -H "Authorization: Bearer $TOKEN" \
  | node -e "console.log('Owner sees', JSON.parse(require('fs').readFileSync(0,'utf8')).data.subfolders.length, 'root folders')"

# As Staff: root listing should show only 1 root folder (their own)
curl -s http://localhost:8080/v1/organizations/$ORG_ID/drive/folders/root -H "Authorization: Bearer $STAFF_TOKEN" \
  | node -e "console.log('Staff sees', JSON.parse(require('fs').readFileSync(0,'utf8')).data.subfolders.length, 'root folders')"

# As Staff: reaching directly into the Manager folder must be rejected
curl -s -o /dev/null -w "Staff GET Manager folder -> HTTP %{http_code}\n" \
  http://localhost:8080/v1/organizations/$ORG_ID/drive/folders/$MANAGER_FOLDER_ID \
  -H "Authorization: Bearer $STAFF_TOKEN"
```

Expected:
- `Manager folder: <some-uuid>`
- `Owner sees 3 root folders`
- `Staff sees 1 root folders`
- `Staff GET Manager folder -> HTTP 403`

- [ ] **Step 4: Verify the full CRUD + trash lifecycle as Owner**

```bash
# Create a subfolder inside the Owner's own Manager-managed area (Owner manages everything)
SUBFOLDER_ID=$(curl -s -X POST http://localhost:8080/v1/organizations/$ORG_ID/drive/folders \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d "{\"name\":\"Q3 Reports\",\"parentId\":\"$MANAGER_FOLDER_ID\"}" \
  | node -e "process.stdout.write(JSON.parse(require('fs').readFileSync(0,'utf8')).data.folder.id)")

echo "Subfolder: $SUBFOLDER_ID"

# Rename it
curl -s -X PATCH http://localhost:8080/v1/organizations/$ORG_ID/drive/folders/$SUBFOLDER_ID \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Q3 Reports Final"}' | node -e "console.log(JSON.parse(require('fs').readFileSync(0,'utf8')).data.folder.name)"

# Trash it
curl -s -o /dev/null -w "Delete -> HTTP %{http_code}\n" -X DELETE \
  http://localhost:8080/v1/organizations/$ORG_ID/drive/folders/$SUBFOLDER_ID -H "Authorization: Bearer $TOKEN"

# See it in trash
curl -s http://localhost:8080/v1/organizations/$ORG_ID/drive/trash -H "Authorization: Bearer $TOKEN" \
  | node -e "console.log(JSON.parse(require('fs').readFileSync(0,'utf8')).data.folders.map(f=>f.name))"

# Restore it
curl -s -X POST http://localhost:8080/v1/organizations/$ORG_ID/drive/trash/restore \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d "{\"type\":\"folder\",\"id\":\"$SUBFOLDER_ID\"}" | node -e "console.log(JSON.parse(require('fs').readFileSync(0,'utf8')).data.restoredItem.name)"

# Attempting to rename/delete a ROLE ROOT folder itself must be rejected
curl -s -o /dev/null -w "Rename root folder -> HTTP %{http_code}\n" -X PATCH \
  http://localhost:8080/v1/organizations/$ORG_ID/drive/folders/$MANAGER_FOLDER_ID \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{"name":"Hacked"}'
```

Expected:
- `Subfolder: <uuid>`
- `Q3 Reports Final`
- `Delete -> HTTP 204`
- `[ 'Q3 Reports Final' ]`
- `Q3 Reports Final` (restored)
- `Rename root folder -> HTTP 400`

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/orgDrive.routes.js backend/src/routes/organization.routes.js
git commit -m "feat: mount Company Drive routes under /organizations/:orgId/drive"
```

---

## Part C — Frontend: small shared-component parameterization

### Task C1: `CreateFolderModal.jsx` — optional create/invalidate overrides

**Files:**
- Modify: `frontend/src/components/modals/CreateFolderModal.jsx`

**Why:** Company Drive needs a "create subfolder" dialog identical in UI to the personal one, but posting to a different endpoint. Rather than duplicate this ~60-line file, add two optional props with defaults that reproduce today's exact behavior.

- [ ] **Step 1: Replace the file**

```jsx
import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import { 
    Dialog, DialogTitle, DialogContent, DialogActions, 
    Button, TextField 
} from '@mui/material';

export default function CreateFolderModal({ isOpen, onClose, parentId = null, createFn, invalidateKeys }) {
    const [name, setName] = useState('');
    const queryClient = useQueryClient();

    const mutation = useMutation({
        mutationFn: async (folderName) => {
            if (createFn) return await createFn(folderName);
            const actualParentId = parentId === 'root' ? null : parentId;
            const res = await api.post('/folders', { name: folderName, parentId: actualParentId });
            return res.data;
        },
        onSuccess: () => {
            const keys = invalidateKeys || [['folders', parentId ? parentId : 'root']];
            keys.forEach(key => queryClient.invalidateQueries({ queryKey: key }));
            setName('');
            onClose();
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (name.trim()) mutation.mutate(name.trim());
    };

    return (
        <Dialog open={isOpen} onClose={onClose} fullWidth maxWidth="sm">
            <form onSubmit={handleSubmit}>
                <DialogTitle fontWeight="bold">Create Folder</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        id="name"
                        label="Folder Name"
                        type="text"
                        fullWidth
                        variant="outlined"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Q3 Financials"
                    />
                </DialogContent>
                <DialogActions sx={{ p: 2, pt: 0 }}>
                    <Button onClick={onClose} color="inherit">
                        Cancel
                    </Button>
                    <Button 
                        type="submit" 
                        variant="contained" 
                        disabled={!name.trim() || mutation.isPending}
                    >
                        {mutation.isPending ? 'Creating...' : 'Create'}
                    </Button>
                </DialogActions>
            </form>
        </Dialog>
    );
}
```

- [ ] **Step 2: Verify personal Drive still works unchanged**

Run the frontend (`cd frontend && npm run dev`), log in, go to My Drive, click **New Folder**, create one. Expected: folder appears exactly as before — this confirms the default (no `createFn`/`invalidateKeys` passed) path is unchanged.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/modals/CreateFolderModal.jsx
git commit -m "refactor: parameterize CreateFolderModal to support alternate drives"
```

---

### Task C2: `FilePreviewModal.jsx` — optional download URL path override

**Files:**
- Modify: `frontend/src/components/modals/FilePreviewModal.jsx:12,19-67`

- [ ] **Step 1: Change the function signature (line 12)**

Old:
```jsx
export default function FilePreviewModal({ isOpen, onClose, file }) {
```

New:
```jsx
export default function FilePreviewModal({ isOpen, onClose, file, downloadUrlPath }) {
```

- [ ] **Step 2: Use the override when resolving the download URL (inside the `useEffect`, around line 27-28)**

Old:
```jsx
            const targetId = file.id || file.file_id;
            api.get(`/storage/download-url/${targetId}`)
```

New:
```jsx
            const targetId = file.id || file.file_id;
            const path = downloadUrlPath ? downloadUrlPath(targetId) : `/storage/download-url/${targetId}`;
            api.get(path)
```

- [ ] **Step 3: Verify personal Drive preview still works unchanged**

In the running frontend, open My Drive, click a file to preview it. Expected: preview loads exactly as before (default path used since `downloadUrlPath` isn't passed there).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/modals/FilePreviewModal.jsx
git commit -m "refactor: allow FilePreviewModal to resolve download URLs from an alternate drive"
```

---

## Part D — Frontend: Org Drive hooks

### Task D1: `useOrgDriveActions.js` — rename/delete

**Files:**
- Create: `frontend/src/hooks/useOrgDriveActions.js`

- [ ] **Step 1: Write the hook**

```javascript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';

export function useOrgDriveActions(orgId, folderId = null) {
    const queryClient = useQueryClient();
    const queryKey = ['org-drive', orgId, folderId ? folderId : 'root'];

    const renameFolder = useMutation({
        mutationFn: async ({ id, newName }) => {
            const res = await api.patch(`/organizations/${orgId}/drive/folders/${id}`, { name: newName });
            return res.data;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey })
    });

    const renameFile = useMutation({
        mutationFn: async ({ id, newName }) => {
            const res = await api.patch(`/organizations/${orgId}/drive/files/${id}`, { name: newName });
            return res.data;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey })
    });

    const deleteFolder = useMutation({
        mutationFn: async (id) => {
            await api.delete(`/organizations/${orgId}/drive/folders/${id}`);
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey })
    });

    const deleteFile = useMutation({
        mutationFn: async (id) => {
            await api.delete(`/organizations/${orgId}/drive/files/${id}`);
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey })
    });

    return { renameFolder, renameFile, deleteFolder, deleteFile };
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/hooks/useOrgDriveActions.js
git commit -m "feat: add useOrgDriveActions hook"
```

---

### Task D2: `useOrgDriveTrashActions.js` — restore

**Files:**
- Create: `frontend/src/hooks/useOrgDriveTrashActions.js`

- [ ] **Step 1: Write the hook**

```javascript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';

export function useOrgDriveTrashActions(orgId) {
    const queryClient = useQueryClient();

    const restoreItem = useMutation({
        mutationFn: async ({ type, id }) => {
            const res = await api.post(`/organizations/${orgId}/drive/trash/restore`, { type, id });
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['org-drive-trash', orgId] });
            queryClient.invalidateQueries({ queryKey: ['org-drive', orgId] });
        }
    });

    return { restoreItem };
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/hooks/useOrgDriveTrashActions.js
git commit -m "feat: add useOrgDriveTrashActions hook"
```

---

### Task D3: `useOrgUpload.js` — single-file upload

**Files:**
- Create: `frontend/src/hooks/useOrgUpload.js`

- [ ] **Step 1: Write the hook**

```javascript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import api from '../services/api';
import { useUploadStore } from '../store/uploadStore';

export function useOrgUpload(orgId, folderId) {
    const queryClient = useQueryClient();
    const { addUpload, updateProgress, setStatus } = useUploadStore();

    return useMutation({
        mutationFn: async (file) => {
            const uploadId = Math.random().toString(36).substring(7);
            addUpload(uploadId, file.name);

            let createdFileId = null;
            try {
                const { data: { data } } = await api.post(`/organizations/${orgId}/drive/upload-url`, {
                    fileName: file.name,
                    size: file.size,
                    mimeType: file.type || 'application/octet-stream',
                    folderId
                });

                const { uploadUrl, fileId, storageKey } = data;
                createdFileId = fileId;

                await axios.put(uploadUrl, file, {
                    headers: { 'Content-Type': file.type || 'application/octet-stream' },
                    onUploadProgress: (progressEvent) => {
                        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                        updateProgress(uploadId, percentCompleted);
                    }
                });

                setStatus(uploadId, 'success');
                queryClient.invalidateQueries({ queryKey: ['org-drive', orgId, folderId ? folderId : 'root'] });

                return { fileId, storageKey };
            } catch (err) {
                console.error('Org Drive upload failed:', err);
                setStatus(uploadId, 'error');

                if (createdFileId) {
                    try {
                        await api.delete(`/organizations/${orgId}/drive/files/${createdFileId}`);
                        queryClient.invalidateQueries({ queryKey: ['org-drive', orgId, folderId ? folderId : 'root'] });
                    } catch (rollbackErr) {
                        console.error('Failed to rollback ghost org file', rollbackErr);
                    }
                }

                const errorMsg = err.response?.data?.message || err.message || 'Unknown error';
                alert(`Failed to upload ${file.name}:\n${errorMsg}`);
                throw err;
            }
        }
    });
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/hooks/useOrgUpload.js
git commit -m "feat: add useOrgUpload hook for Company Drive uploads"
```

---

## Part E — Frontend: Org Drive UI components

### Task E1: `OrgFolderCard.jsx`

**Files:**
- Create: `frontend/src/features/orgDrive/OrgFolderCard.jsx`

- [ ] **Step 1: Write the component**

```jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Folder as FolderIcon } from '@mui/icons-material';
import { Card, CardActionArea, Typography, Box } from '@mui/material';
import ContextMenu from '../../components/ui/ContextMenu';
import RenameModal from '../../components/modals/RenameModal';
import { useOrgDriveActions } from '../../hooks/useOrgDriveActions';

export default function OrgFolderCard({ orgId, folder }) {
    const [isRenameOpen, setIsRenameOpen] = useState(false);
    const { renameFolder, deleteFolder } = useOrgDriveActions(orgId, folder.parent_id);
    const navigate = useNavigate();
    const isRoleRoot = !!folder.owner_role_id;

    return (
        <>
            <Card
                elevation={0}
                sx={{
                    aspectRatio: '1 / 1', overflow: 'hidden', height: '100%',
                    display: 'flex', flexDirection: 'column', position: 'relative',
                    border: '1px solid transparent',
                    bgcolor: 'background.paper'
                }}
            >
                <CardActionArea
                    onClick={() => navigate(`/company-drive/${orgId}/folders/${folder.id}`)}
                    sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 2 }}
                >
                    <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                        <FolderIcon sx={{ color: isRoleRoot ? 'primary.main' : 'text.secondary', fontSize: 64 }} />
                    </Box>
                    <Box sx={{ width: '100%', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mt: 1 }}>
                        <Box sx={{ minWidth: 0, flex: 1, pr: 1, textAlign: 'left' }}>
                            <Typography variant="body2" fontWeight="500" noWrap>
                                {folder.name}
                            </Typography>
                            {isRoleRoot && (
                                <Typography variant="caption" color="primary.main" noWrap display="block">
                                    Role folder
                                </Typography>
                            )}
                        </Box>
                        {!isRoleRoot && (
                            <ContextMenu
                                onRename={() => setIsRenameOpen(true)}
                                onDelete={() => deleteFolder.mutate(folder.id)}
                            />
                        )}
                    </Box>
                </CardActionArea>
            </Card>

            <RenameModal
                isOpen={isRenameOpen}
                currentName={folder.name}
                onClose={() => setIsRenameOpen(false)}
                onSave={(newName) => renameFolder.mutate({ id: folder.id, newName })}
            />
        </>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/orgDrive/OrgFolderCard.jsx
git commit -m "feat: add OrgFolderCard component"
```

---

### Task E2: `OrgFileCard.jsx`

**Files:**
- Create: `frontend/src/features/orgDrive/OrgFileCard.jsx`

- [ ] **Step 1: Write the component**

```jsx
import React, { useState } from 'react';
import { InsertDriveFile as DocumentIcon, Image as ImageIcon } from '@mui/icons-material';
import { Card, CardActionArea, Typography, Box, Skeleton } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';
import ContextMenu from '../../components/ui/ContextMenu';
import RenameModal from '../../components/modals/RenameModal';
import FilePreviewModal from '../../components/modals/FilePreviewModal';
import { useOrgDriveActions } from '../../hooks/useOrgDriveActions';

function formatBytes(bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function OrgFileCard({ orgId, file }) {
    const [isRenameOpen, setIsRenameOpen] = useState(false);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const { renameFile, deleteFile } = useOrgDriveActions(orgId, file.folder_id);

    const displayName = file.original_name || file.name;
    const isImage = file.mime_type?.startsWith('image/');

    const { data: thumbnailUrl, isLoading: isThumbnailLoading } = useQuery({
        queryKey: ['org-thumbnail', orgId, file.id],
        queryFn: async () => {
            const res = await api.get(`/organizations/${orgId}/drive/download-url/${file.id}`);
            return res.data.data.downloadUrl;
        },
        enabled: isImage,
        staleTime: 1000 * 60 * 15
    });

    return (
        <>
            <Card
                elevation={0}
                sx={{
                    aspectRatio: '1 / 1', overflow: 'hidden', height: '100%',
                    display: 'flex', flexDirection: 'column', position: 'relative',
                    border: '1px solid transparent'
                }}
            >
                <CardActionArea onClick={() => setIsPreviewOpen(true)} sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <Box sx={{
                        bgcolor: '#F7F7F5', flex: 1, width: '100%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        borderBottom: '1px solid #EAEAEA'
                    }}>
                        {isImage ? (
                            isThumbnailLoading ? (
                                <Skeleton variant="rectangular" width="100%" height="100%" />
                            ) : thumbnailUrl ? (
                                <Box component="img" src={thumbnailUrl} alt={displayName} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                <ImageIcon sx={{ fontSize: 64, color: 'text.secondary' }} />
                            )
                        ) : (
                            <DocumentIcon sx={{ fontSize: 64, color: 'text.secondary' }} />
                        )}
                    </Box>
                </CardActionArea>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1.5 }}>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography variant="body2" fontWeight="500" noWrap title={displayName}>
                            {displayName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" noWrap display="block">
                            {formatBytes(file.size)} {file.created_at ? `• ${new Date(file.created_at).toLocaleDateString()}` : ''}
                        </Typography>
                    </Box>
                    <ContextMenu
                        onRename={() => setIsRenameOpen(true)}
                        onDelete={() => deleteFile.mutate(file.id)}
                    />
                </Box>
            </Card>

            <RenameModal
                isOpen={isRenameOpen}
                currentName={displayName}
                onClose={() => setIsRenameOpen(false)}
                onSave={(newName) => renameFile.mutate({ id: file.id, newName })}
            />

            <FilePreviewModal
                isOpen={isPreviewOpen}
                onClose={() => setIsPreviewOpen(false)}
                file={file}
                downloadUrlPath={(id) => `/organizations/${orgId}/drive/download-url/${id}`}
            />
        </>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/orgDrive/OrgFileCard.jsx
git commit -m "feat: add OrgFileCard component"
```

---

### Task E3: `OrgFileGrid.jsx`

**Files:**
- Create: `frontend/src/features/orgDrive/OrgFileGrid.jsx`

- [ ] **Step 1: Write the component**

```jsx
import React from 'react';
import OrgFolderCard from './OrgFolderCard';
import OrgFileCard from './OrgFileCard';
import { Box, Typography } from '@mui/material';

export default function OrgFileGrid({ orgId, folders, files }) {
    if (folders.length === 0 && files.length === 0) {
        return (
            <Box sx={{
                flex: 1, border: '2px dashed #E0E0E0', bgcolor: 'background.paper',
                display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 2
            }}>
                <Typography variant="h6" color="text.secondary">
                    This folder is empty
                </Typography>
            </Box>
        );
    }

    return (
        <Box sx={{
            display: 'grid',
            gridTemplateColumns: {
                xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))',
                md: 'repeat(3, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))', xl: 'repeat(5, minmax(0, 1fr))'
            },
            gap: 3, pb: 4
        }}>
            {folders.map(folder => <OrgFolderCard key={folder.id} orgId={orgId} folder={folder} />)}
            {files.map(file => <OrgFileCard key={file.id} orgId={orgId} file={file} />)}
        </Box>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/orgDrive/OrgFileGrid.jsx
git commit -m "feat: add OrgFileGrid component"
```

---

## Part F — Frontend: pages, routes, navigation

### Task F1: `CompanyDrivePage.jsx`

**Files:**
- Create: `frontend/src/pages/CompanyDrivePage.jsx`

- [ ] **Step 1: Write the page**

```jsx
import React, { useState, useRef } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import OrgFileGrid from '../features/orgDrive/OrgFileGrid';
import CreateFolderModal from '../components/modals/CreateFolderModal';
import {
    Typography, Box, CircularProgress, Alert, Breadcrumbs, Link,
    Button, IconButton, Tooltip
} from '@mui/material';
import {
    NavigateNext as NavigateNextIcon,
    UploadFile as UploadFileIcon,
    CreateNewFolder as CreateNewFolderIcon,
    Refresh as RefreshIcon
} from '@mui/icons-material';
import { useOrgUpload } from '../hooks/useOrgUpload';

export default function CompanyDrivePage() {
    const { orgId, folderId } = useParams();
    const currentFolderId = folderId || 'root';
    const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
    const fileInputRef = useRef(null);

    const uploadMutation = useOrgUpload(orgId, currentFolderId === 'root' ? null : currentFolderId);

    const { data, isLoading, error, refetch, isRefetching } = useQuery({
        queryKey: ['org-drive', orgId, currentFolderId],
        queryFn: async () => {
            const res = await api.get(`/organizations/${orgId}/drive/folders/${currentFolderId}`);
            return res.data.data;
        }
    });

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) uploadMutation.mutate(file);
        e.target.value = null;
    };

    if (isLoading) return (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 8 }}>
            <CircularProgress />
        </Box>
    );

    if (error) return (
        <Alert severity="error" sx={{ m: 4 }}>
            Failed to load Company Drive: {error.response?.data?.message || error.message}
        </Alert>
    );

    const folders = data.subfolders || [];
    const files = data.files || [];
    const currentFolder = data.folder;
    const ancestors = data.ancestors || [];

    return (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} aria-label="breadcrumb">
                        <Link
                            component={RouterLink}
                            to={`/company-drive/${orgId}`}
                            underline="hover"
                            color={currentFolder ? 'text.secondary' : 'text.primary'}
                            sx={{ fontSize: '1.25rem', fontWeight: currentFolder ? 500 : 700 }}
                        >
                            Company Drive
                        </Link>
                        {ancestors.map((anc) => (
                            <Link
                                key={anc.id}
                                component={RouterLink}
                                to={`/company-drive/${orgId}/folders/${anc.id}`}
                                underline="hover"
                                color="text.secondary"
                                sx={{ fontSize: '1.25rem', fontWeight: 500 }}
                            >
                                {anc.name}
                            </Link>
                        ))}
                        {currentFolder && (
                            <Typography color="text.primary" sx={{ fontSize: '1.25rem', fontWeight: 700 }}>
                                {currentFolder.name}
                            </Typography>
                        )}
                    </Breadcrumbs>
                    <Tooltip title="Refresh">
                        <IconButton size="small" onClick={() => refetch()} disabled={isRefetching} sx={{ color: 'text.secondary' }}>
                            <RefreshIcon fontSize="small" sx={{ transform: isRefetching ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }} />
                        </IconButton>
                    </Tooltip>
                </Box>

                {currentFolder && (
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button variant="outlined" size="small" startIcon={<CreateNewFolderIcon />} onClick={() => setIsFolderModalOpen(true)}>
                            New Folder
                        </Button>
                        <Button variant="contained" size="small" startIcon={<UploadFileIcon />} onClick={() => fileInputRef.current?.click()}>
                            Upload
                        </Button>
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} />
                    </Box>
                )}
            </Box>

            <Box sx={{ flex: 1, overflow: 'auto' }}>
                <OrgFileGrid orgId={orgId} folders={folders} files={files} />
            </Box>

            <CreateFolderModal
                isOpen={isFolderModalOpen}
                onClose={() => setIsFolderModalOpen(false)}
                parentId={currentFolderId}
                createFn={async (name) => {
                    const res = await api.post(`/organizations/${orgId}/drive/folders`, {
                        name,
                        parentId: currentFolderId === 'root' ? null : currentFolderId
                    });
                    return res.data;
                }}
                invalidateKeys={[['org-drive', orgId, currentFolderId]]}
            />
        </Box>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/CompanyDrivePage.jsx
git commit -m "feat: add CompanyDrivePage"
```

---

### Task F2: `CompanyDriveTrash.jsx`

**Files:**
- Create: `frontend/src/pages/CompanyDriveTrash.jsx`

- [ ] **Step 1: Write the page**

```jsx
import React from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
    Restore as RestoreIcon, Warning as WarningIcon,
    Folder as FolderIcon, InsertDriveFile as DocumentIcon,
    Refresh as RefreshIcon
} from '@mui/icons-material';
import api from '../services/api';
import { useOrgDriveTrashActions } from '../hooks/useOrgDriveTrashActions';
import {
    Box, Typography, CircularProgress, Alert,
    Card, CardContent, IconButton, Tooltip, Stack, Button
} from '@mui/material';

export default function CompanyDriveTrash() {
    const { orgId } = useParams();
    const { data, isLoading, error, refetch, isRefetching } = useQuery({
        queryKey: ['org-drive-trash', orgId],
        queryFn: async () => {
            const res = await api.get(`/organizations/${orgId}/drive/trash`);
            return res.data.data;
        }
    });

    const { restoreItem } = useOrgDriveTrashActions(orgId);

    if (isLoading) return (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 8 }}>
            <CircularProgress />
        </Box>
    );

    if (error) return (
        <Alert severity="error" sx={{ m: 4 }}>
            Failed to load Company Drive trash
        </Alert>
    );

    const files = data?.files || [];
    const folders = data?.folders || [];
    const totalItems = files.length + folders.length;

    return (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 4 }}>
                <Typography color="text.primary" sx={{ fontSize: '1.25rem', fontWeight: 700 }}>
                    Company Drive Trash
                </Typography>
                <Tooltip title="Refresh">
                    <IconButton size="small" onClick={() => refetch()} disabled={isRefetching} sx={{ color: 'text.secondary' }}>
                        <RefreshIcon fontSize="small" sx={{ transform: isRefetching ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }} />
                    </IconButton>
                </Tooltip>
            </Box>

            {totalItems === 0 ? (
                <Box sx={{
                    flex: 1, border: '2px dashed #E0E0E0', bgcolor: 'background.paper',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    gap: 2, borderRadius: 2
                }}>
                    <WarningIcon sx={{ fontSize: 64, color: 'text.disabled' }} />
                    <Typography variant="h6" color="text.secondary">
                        Trash is empty
                    </Typography>
                </Box>
            ) : (
                <Stack spacing={2} sx={{ flex: 1, overflowY: 'auto', pb: 4, minHeight: 0 }}>
                    {folders.map(folder => (
                        <Card key={folder.id} variant="outlined" sx={{ flexShrink: 0 }}>
                            <CardContent sx={{ display: 'flex', alignItems: 'center', p: 2, '&:last-child': { pb: 2 } }}>
                                <FolderIcon sx={{ color: 'primary.main', mr: 2, fontSize: 32 }} />
                                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                                    <Typography variant="body1" sx={{ textDecoration: 'line-through', color: 'text.secondary' }} noWrap>
                                        {folder.name}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary" textTransform="uppercase">
                                        Folder
                                    </Typography>
                                </Box>
                                <Button variant="outlined" startIcon={<RestoreIcon />} onClick={() => restoreItem.mutate({ type: 'folder', id: folder.id })}>
                                    Restore
                                </Button>
                            </CardContent>
                        </Card>
                    ))}

                    {files.map(file => (
                        <Card key={file.id} variant="outlined" sx={{ flexShrink: 0 }}>
                            <CardContent sx={{ display: 'flex', alignItems: 'center', p: 2, '&:last-child': { pb: 2 } }}>
                                <DocumentIcon sx={{ color: 'text.secondary', mr: 2, fontSize: 32 }} />
                                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                                    <Typography variant="body1" sx={{ textDecoration: 'line-through', color: 'text.secondary' }} noWrap>
                                        {file.original_name || file.name}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary" textTransform="uppercase">
                                        File
                                    </Typography>
                                </Box>
                                <Button variant="outlined" startIcon={<RestoreIcon />} onClick={() => restoreItem.mutate({ type: 'file', id: file.id })}>
                                    Restore
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </Stack>
            )}
        </Box>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/CompanyDriveTrash.jsx
git commit -m "feat: add CompanyDriveTrash page"
```

---

### Task F3: Wire routes into `App.jsx`

**Files:**
- Modify: `frontend/src/App.jsx`

- [ ] **Step 1: Add the imports (after the `OrganizationSettings` import, line 15)**

```jsx
import CompanyDrivePage from './pages/CompanyDrivePage';
import CompanyDriveTrash from './pages/CompanyDriveTrash';
```

- [ ] **Step 2: Add the routes (inside the `<Route path="/" ...>` block, after `<Route path="organization" .../>` on line 49)**

Old:
```jsx
                <Route path="organization" element={<OrganizationSettings />} />
                <Route path="trash" element={<Trash />} />
```

New:
```jsx
                <Route path="organization" element={<OrganizationSettings />} />
                <Route path="company-drive/:orgId" element={<CompanyDrivePage />} />
                <Route path="company-drive/:orgId/folders/:folderId" element={<CompanyDrivePage />} />
                <Route path="company-drive/:orgId/trash" element={<CompanyDriveTrash />} />
                <Route path="trash" element={<Trash />} />
```

- [ ] **Step 3: Verify**

Run `cd frontend && npm run dev`, log in, manually visit `http://localhost:5173/company-drive/<an-org-id-you-own>` (use `$ORG_ID` from the backend verification tasks, or any org id visible in `Organization Settings`). Expected: the page loads and shows 3 role folders (Owner/Manager/Staff) without a JS error in the console.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.jsx
git commit -m "feat: wire Company Drive routes into App"
```

---

### Task F4: Sidebar — collapsible "Company Drive" nav tree

**Files:**
- Modify: `frontend/src/components/layout/Sidebar.jsx`

- [ ] **Step 1: Add imports**

Old (lines 1-27):
```jsx
import React, { useState, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import CreateFolderModal from '../modals/CreateFolderModal';
import ProfileModal from '../modals/ProfileModal';
import { useUpload } from '../../hooks/useUpload';
import { useItemActions } from '../../hooks/useItemActions';
import { 
    Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText, 
    Button, Box, Typography, Divider, Menu, MenuItem, Avatar, LinearProgress,
    IconButton, Tooltip
} from '@mui/material';
import { 
    Folder as FolderIcon, 
    Delete as TrashIcon, 
    Group as UsersIcon, 
    Add as PlusIcon, 
    Logout as LogoutIcon,
    CreateNewFolder as CreateNewFolderIcon,
    UploadFile as UploadFileIcon,
    Cloud as CloudIcon,
    Chat as ChatIcon,
    ChevronLeft as ChevronLeftIcon,
    ChevronRight as ChevronRightIcon,
    FactCheck as ApprovalIcon,
    Business as OrgIcon
} from '@mui/icons-material';
```

New:
```jsx
import React, { useState, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import api from '../../services/api';
import CreateFolderModal from '../modals/CreateFolderModal';
import ProfileModal from '../modals/ProfileModal';
import { useUpload } from '../../hooks/useUpload';
import { useItemActions } from '../../hooks/useItemActions';
import { 
    Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText, 
    Button, Box, Typography, Divider, Menu, MenuItem, Avatar, LinearProgress,
    IconButton, Tooltip
} from '@mui/material';
import { 
    Folder as FolderIcon, 
    Delete as TrashIcon, 
    Group as UsersIcon, 
    Add as PlusIcon, 
    Logout as LogoutIcon,
    CreateNewFolder as CreateNewFolderIcon,
    UploadFile as UploadFileIcon,
    Cloud as CloudIcon,
    Chat as ChatIcon,
    ChevronLeft as ChevronLeftIcon,
    ChevronRight as ChevronRightIcon,
    FactCheck as ApprovalIcon,
    Business as OrgIcon,
    ExpandLess as ExpandLessIcon,
    ExpandMore as ExpandMoreIcon
} from '@mui/icons-material';
```

- [ ] **Step 2: Add state and the organizations query**

Old (inside the `Sidebar` function, lines 32-39):
```jsx
export default function Sidebar() {
    const { logout, user, totalMemory, profileModalOpen, openProfileModal, closeProfileModal } = useAuthStore();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isHovered, setIsHovered] = useState(false);

    const [anchorEl, setAnchorEl] = useState(null);
    const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
    const [isMyDriveDragOver, setIsMyDriveDragOver] = useState(false);
```

New:
```jsx
export default function Sidebar() {
    const { logout, user, totalMemory, profileModalOpen, openProfileModal, closeProfileModal } = useAuthStore();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isHovered, setIsHovered] = useState(false);

    const [anchorEl, setAnchorEl] = useState(null);
    const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
    const [isMyDriveDragOver, setIsMyDriveDragOver] = useState(false);
    const [isCompanyDriveExpanded, setIsCompanyDriveExpanded] = useState(false);

    const { data: orgsData } = useQuery({
        queryKey: ['organizations'],
        queryFn: async () => {
            const res = await api.get('/organizations');
            return res.data.data.organizations;
        }
    });
    const myOrgs = (orgsData || []).filter(o => o.membership_status === 'accepted');
```

- [ ] **Step 3: Insert the Company Drive tree into the nav `<List>`**

Find this exact block (the closing of the `navItems.map` render, right before `</List>`):

```jsx
                        return (
                            <ListItem key={item.name} disablePadding sx={{ mb: 0.5, display: 'block' }}>
                                {showFull ? (
                                    btnContent
                                ) : (
                                    <Tooltip title={item.name} placement="right">
                                        {btnContent}
                                    </Tooltip>
                                )}
                            </ListItem>
                        );
                    })}
                </List>
```

Replace with:

```jsx
                        return (
                            <ListItem key={item.name} disablePadding sx={{ mb: 0.5, display: 'block' }}>
                                {showFull ? (
                                    btnContent
                                ) : (
                                    <Tooltip title={item.name} placement="right">
                                        {btnContent}
                                    </Tooltip>
                                )}
                            </ListItem>
                        );
                    })}

                    <ListItem disablePadding sx={{ mb: 0.5, display: 'block' }}>
                        <ListItemButton
                            onClick={() => setIsCompanyDriveExpanded(v => !v)}
                            sx={{
                                py: 0.75, px: showFull ? 1.5 : 0,
                                justifyContent: showFull ? 'flex-start' : 'center',
                                borderRadius: 1,
                                '& .MuiListItemIcon-root': { minWidth: showFull ? 32 : 'auto', justifyContent: 'center', color: 'text.secondary' },
                                '& .MuiListItemText-primary': { fontSize: '0.875rem', fontWeight: 500, color: 'text.secondary' }
                            }}
                        >
                            <ListItemIcon>
                                <OrgIcon />
                            </ListItemIcon>
                            {showFull && <ListItemText primary="Company Drive" />}
                            {showFull && myOrgs.length > 0 && (
                                isCompanyDriveExpanded
                                    ? <ExpandLessIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                                    : <ExpandMoreIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                            )}
                        </ListItemButton>
                    </ListItem>

                    {showFull && isCompanyDriveExpanded && myOrgs.map(org => (
                        <ListItem key={org.id} disablePadding sx={{ mb: 0.5, display: 'block' }}>
                            <ListItemButton
                                component={NavLink}
                                to={`/company-drive/${org.id}`}
                                sx={{
                                    py: 0.5, pl: 4, pr: 1.5,
                                    borderRadius: 1,
                                    '&.active': { backgroundColor: 'action.selected' },
                                    '& .MuiListItemText-primary': { fontSize: '0.8rem', fontWeight: 500, color: 'text.secondary' },
                                    '&.active .MuiListItemText-primary': { fontWeight: 600, color: 'text.primary' }
                                }}
                            >
                                <ListItemText primary={org.name} />
                            </ListItemButton>
                        </ListItem>
                    ))}
                </List>
```

- [ ] **Step 4: Verify in the browser**

With the frontend running and logged in as a user who belongs to at least one organization: confirm a "Company Drive" row appears below the existing nav items, with a chevron. Click it — it expands to list your organization(s) by name. Click an organization name — it navigates to `/company-drive/<orgId>` and `CompanyDrivePage` loads the 3 role folders.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/layout/Sidebar.jsx
git commit -m "feat: add collapsible Company Drive nav tree to Sidebar"
```

---

## Part G — End-to-end walkthrough

### Task G1: Full manual walkthrough as two different roles

**Files:** none (verification only)

- [ ] **Step 1: As the Owner** — log in, open Company Drive, expand into the "Manager" role folder, create a subfolder "Contracts", upload a small file into it, rename the file, confirm it appears with the new name.

- [ ] **Step 2: As a Staff member** (a second browser/incognito session, logged in as the invited Staff user from Task B4's `cd-staffer@test.com`) — open Company Drive. Confirm only the "Staff" folder is visible; "Manager" and "Owner" do not appear anywhere in the list.

- [ ] **Step 3: As the Staff member**, upload a file into their own "Staff" folder, then delete it. Go to `/company-drive/<orgId>/trash` and restore it. Confirm it reappears in the Staff folder.

- [ ] **Step 4: As the Owner**, go to Organization Settings → Hierarchy tab, rename the "Manager" role to "Team Lead" via the Role Hierarchy canvas, and click Save. Return to Company Drive — confirm the folder that was "Manager" now reads "Team Lead", and the "Contracts" subfolder and its file created in Step 1 are still inside it (proving `saveRoles` no longer orphans the folder).

- [ ] **Step 5: No commit for this task** — it's a verification pass only. If any step fails, fix the relevant task above and re-run this walkthrough before considering the feature done.

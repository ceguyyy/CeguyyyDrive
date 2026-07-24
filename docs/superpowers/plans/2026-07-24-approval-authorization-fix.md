# Approval Authorization Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close a real authorization gap where "any member of role X" approval steps (`approval_steps.approver_id IS NULL`) can currently be seen and acted on by *any* authenticated user, regardless of organization membership or role — and where `processStepDecision` performs no authorization check at all.

**Architecture:** Two functions in `backend/src/repositories/approvalRepository.js` change. `findPendingApprovalsForUser` gains a recursive-CTE filter (self role + all descendant roles per organization, same ancestor-manages-descendant shape used elsewhere in this codebase). `processStepDecision` gains an explicit authorization check — using the same recursive shape, scoped to one org — that runs inside the existing transaction before any row is mutated, throwing a `403 AppError` if the caller isn't the assigned approver and doesn't hold the step's role or an ancestor role.

**Tech Stack:** Node/Express/PostgreSQL (`pg`), matching the rest of the backend.

**Spec:** [docs/superpowers/specs/2026-07-24-approval-authorization-fix-design.md](../specs/2026-07-24-approval-authorization-fix-design.md)

**A note on verification steps:** this repository has no automated test framework. Each task's "Verify" step is a `curl`-based manual check with expected output, following the project's existing convention.

---

### Task 1: Fix `findPendingApprovalsForUser` — scope "any role" steps to actual role holders

**Files:**
- Modify: `backend/src/repositories/approvalRepository.js:42-61`

- [ ] **Step 1: Replace the method**

Old:

```javascript
    async findPendingApprovalsForUser(userId) {
        const result = await db.query(
            `SELECT ar.*, st.id as current_step_id, st.step_number, st.role_name,
                    u.full_name as requester_name, u.email as requester_email, u.profile_picture as requester_avatar,
                    f.original_name as file_name, f.size as file_size, f.mime_type,
                    fd.name as folder_name, o.name as organization_name
             FROM approval_requests ar
             JOIN approval_steps st ON ar.id = st.request_id AND st.step_number = ar.current_step_index
             JOIN users u ON ar.requester_id = u.id
             JOIN organizations o ON ar.organization_id = o.id
             LEFT JOIN files f ON ar.file_id = f.id
             LEFT JOIN folders fd ON ar.folder_id = fd.id
             WHERE (st.approver_id = $1 OR st.approver_id IS NULL)
               AND st.status = 'pending'
               AND ar.status = 'pending'
             ORDER BY ar.created_at DESC`,
            [userId]
        );
        return result.rows;
    }
```

New:

```javascript
    async findPendingApprovalsForUser(userId) {
        const result = await db.query(
            `WITH RECURSIVE my_memberships AS (
                SELECT om.organization_id, r.id AS role_id, r.name AS role_name
                FROM organization_members om
                JOIN organization_roles r
                    ON r.organization_id = om.organization_id AND LOWER(r.name) = LOWER(om.role_name)
                WHERE om.user_id = $1 AND om.status = 'accepted'
             ),
             authorized_roles AS (
                SELECT organization_id, role_id, role_name FROM my_memberships
                UNION ALL
                SELECT r.organization_id, r.id, r.name
                FROM organization_roles r
                INNER JOIN authorized_roles ar2 ON r.parent_role_id = ar2.role_id
             )
             SELECT ar.*, st.id as current_step_id, st.step_number, st.role_name,
                    u.full_name as requester_name, u.email as requester_email, u.profile_picture as requester_avatar,
                    f.original_name as file_name, f.size as file_size, f.mime_type,
                    fd.name as folder_name, o.name as organization_name
             FROM approval_requests ar
             JOIN approval_steps st ON ar.id = st.request_id AND st.step_number = ar.current_step_index
             JOIN users u ON ar.requester_id = u.id
             JOIN organizations o ON ar.organization_id = o.id
             LEFT JOIN files f ON ar.file_id = f.id
             LEFT JOIN folders fd ON ar.folder_id = fd.id
             WHERE st.status = 'pending'
               AND ar.status = 'pending'
               AND (
                    st.approver_id = $1
                    OR (st.approver_id IS NULL AND EXISTS (
                        SELECT 1 FROM authorized_roles auth
                        WHERE auth.organization_id = ar.organization_id
                          AND LOWER(auth.role_name) = LOWER(st.role_name)
                    ))
               )
             ORDER BY ar.created_at DESC`,
            [userId]
        );
        return result.rows;
    }
```

- [ ] **Step 2: Verify with three users — unrelated, correct role, and ancestor role**

Start the backend (`cd backend && npm run dev` if not already running):

```bash
# Owner creates an org (also seeds Owner/Manager/Staff roles)
OWNER_TOKEN=$(curl -s -X POST http://localhost:8080/v1/auth/register -H "Content-Type: application/json" \
  -d '{"email":"auth-owner@test.com","password":"password123","fullName":"Auth Owner","ticket":"t","randstr":"r"}' \
  | node -e "process.stdout.write(JSON.parse(require('fs').readFileSync(0,'utf8')).data.accessToken)")

ORG_ID=$(curl -s -X POST http://localhost:8080/v1/organizations -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OWNER_TOKEN" -d '{"name":"Auth Test Org"}' \
  | node -e "process.stdout.write(JSON.parse(require('fs').readFileSync(0,'utf8')).data.organization.id)")

# A Manager (correct role for the step we'll create)
MANAGER_TOKEN=$(curl -s -X POST http://localhost:8080/v1/auth/register -H "Content-Type: application/json" \
  -d '{"email":"auth-manager@test.com","password":"password123","fullName":"Auth Manager","ticket":"t","randstr":"r"}' \
  | node -e "process.stdout.write(JSON.parse(require('fs').readFileSync(0,'utf8')).data.accessToken)")
curl -s -X POST http://localhost:8080/v1/organizations/$ORG_ID/invite -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OWNER_TOKEN" -d '{"email":"auth-manager@test.com","roleName":"Manager"}' > /dev/null
curl -s -X POST http://localhost:8080/v1/organizations/$ORG_ID/respond -H "Content-Type: application/json" \
  -H "Authorization: Bearer $MANAGER_TOKEN" -d '{"accept":true}' > /dev/null

# A Staff member (subordinate role — must NOT be able to act on a Manager step)
STAFF_TOKEN=$(curl -s -X POST http://localhost:8080/v1/auth/register -H "Content-Type: application/json" \
  -d '{"email":"auth-staff@test.com","password":"password123","fullName":"Auth Staff","ticket":"t","randstr":"r"}' \
  | node -e "process.stdout.write(JSON.parse(require('fs').readFileSync(0,'utf8')).data.accessToken)")
curl -s -X POST http://localhost:8080/v1/organizations/$ORG_ID/invite -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OWNER_TOKEN" -d '{"email":"auth-staff@test.com","roleName":"Staff"}' > /dev/null
curl -s -X POST http://localhost:8080/v1/organizations/$ORG_ID/respond -H "Content-Type: application/json" \
  -H "Authorization: Bearer $STAFF_TOKEN" -d '{"accept":true}' > /dev/null

# A totally unrelated user with no membership in this org at all
OUTSIDER_TOKEN=$(curl -s -X POST http://localhost:8080/v1/auth/register -H "Content-Type: application/json" \
  -d '{"email":"auth-outsider@test.com","password":"password123","fullName":"Auth Outsider","ticket":"t","randstr":"r"}' \
  | node -e "process.stdout.write(JSON.parse(require('fs').readFileSync(0,'utf8')).data.accessToken)")

# Submitting for approval requires a fileId or folderId — create a quick personal file record first
FILE_ID=$(curl -s -X POST http://localhost:8080/v1/storage/upload-url -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OWNER_TOKEN" \
  -d '{"fileName":"test.txt","size":10,"mimeType":"text/plain","folderId":null}' \
  | node -e "process.stdout.write(JSON.parse(require('fs').readFileSync(0,'utf8')).data.fileId)")

# Submit for approval with a single "any Manager" step (no specific approver_id)
REQUEST_ID=$(curl -s -X POST http://localhost:8080/v1/approvals -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OWNER_TOKEN" \
  -d "{\"orgId\":\"$ORG_ID\",\"fileId\":\"$FILE_ID\",\"title\":\"Auth test\",\"steps\":[{\"role_name\":\"Manager\",\"approver_id\":\"\"}]}" \
  | node -e "process.stdout.write(JSON.parse(require('fs').readFileSync(0,'utf8')).data.request.id)")

echo "Request: $REQUEST_ID"

# Outsider: must NOT see it
curl -s http://localhost:8080/v1/approvals/pending -H "Authorization: Bearer $OUTSIDER_TOKEN" \
  | node -e "console.log('Outsider pending count:', JSON.parse(require('fs').readFileSync(0,'utf8')).data.pending.length)"

# Staff (subordinate role): must NOT see it
curl -s http://localhost:8080/v1/approvals/pending -H "Authorization: Bearer $STAFF_TOKEN" \
  | node -e "console.log('Staff pending count:', JSON.parse(require('fs').readFileSync(0,'utf8')).data.pending.length)"

# Manager (exact role match): must see it
curl -s http://localhost:8080/v1/approvals/pending -H "Authorization: Bearer $MANAGER_TOKEN" \
  | node -e "console.log('Manager pending count:', JSON.parse(require('fs').readFileSync(0,'utf8')).data.pending.length)"

# Owner (ancestor of Manager): must also see it
curl -s http://localhost:8080/v1/approvals/pending -H "Authorization: Bearer $OWNER_TOKEN" \
  | node -e "console.log('Owner pending count:', JSON.parse(require('fs').readFileSync(0,'utf8')).data.pending.length)"
```

Expected:
- `Outsider pending count: 0`
- `Staff pending count: 0`
- `Manager pending count: 1`
- `Owner pending count: 1`

(Keep `$ORG_ID`, `$REQUEST_ID`, `$OWNER_TOKEN`, `$MANAGER_TOKEN`, `$STAFF_TOKEN`, `$OUTSIDER_TOKEN` around — Task 2's verification reuses them.)

- [ ] **Step 3: Commit**

```bash
git add backend/src/repositories/approvalRepository.js
git commit -m "fix: scope any-role approval steps to actual role holders and their superiors"
```

---

### Task 2: Fix `processStepDecision` — reject unauthorized decisions

**Files:**
- Modify: `backend/src/repositories/approvalRepository.js` (top of file + the `processStepDecision` method)

- [ ] **Step 1: Add the `AppError` import**

Old (line 1):
```javascript
const db = require('../config/db');
```

New:
```javascript
const db = require('../config/db');
const AppError = require('../utils/AppError');
```

- [ ] **Step 2: Add the authorization helper and wire it into `processStepDecision`**

Old:
```javascript
    async processStepDecision(requestId, approverId, decision, comment) {
        const client = await db.getClient();
        try {
            await client.query('BEGIN');

            const reqRes = await client.query(`SELECT * FROM approval_requests WHERE id = $1 FOR UPDATE`, [requestId]);
            const request = reqRes.rows[0];
            if (!request || request.status !== 'pending') {
                throw new Error('Approval request is not pending');
            }

            const currentStepNum = request.current_step_index;
            const now = new Date();

            // Update step status
            await client.query(
                `UPDATE approval_steps 
                 SET status = $1, approver_id = COALESCE(approver_id, $2), comment = $3, action_timestamp = $4
                 WHERE request_id = $5 AND step_number = $6`,
                [decision, approverId, comment || null, now, requestId, currentStepNum]
            );
```

New:
```javascript
    async _isAuthorizedForStep(client, userId, orgId, step) {
        if (step.approver_id) {
            return step.approver_id === userId;
        }

        const result = await client.query(
            `WITH RECURSIVE my_role AS (
                SELECT r.id, r.name FROM organization_members om
                JOIN organization_roles r
                    ON r.organization_id = om.organization_id AND LOWER(r.name) = LOWER(om.role_name)
                WHERE om.organization_id = $1 AND om.user_id = $2 AND om.status = 'accepted'
             ),
             authorized_roles AS (
                SELECT id, name FROM my_role
                UNION ALL
                SELECT r.id, r.name FROM organization_roles r
                INNER JOIN authorized_roles ar2 ON r.parent_role_id = ar2.id
             )
             SELECT 1 FROM authorized_roles WHERE LOWER(name) = LOWER($3) LIMIT 1`,
            [orgId, userId, step.role_name]
        );
        return result.rows.length > 0;
    }

    async processStepDecision(requestId, approverId, decision, comment) {
        const client = await db.getClient();
        try {
            await client.query('BEGIN');

            const reqRes = await client.query(`SELECT * FROM approval_requests WHERE id = $1 FOR UPDATE`, [requestId]);
            const request = reqRes.rows[0];
            if (!request || request.status !== 'pending') {
                throw new Error('Approval request is not pending');
            }

            const currentStepNum = request.current_step_index;

            const stepRes = await client.query(
                `SELECT * FROM approval_steps WHERE request_id = $1 AND step_number = $2`,
                [requestId, currentStepNum]
            );
            const currentStep = stepRes.rows[0];
            if (!currentStep) {
                throw new AppError('Approval step not found', 404);
            }

            const isAuthorized = await this._isAuthorizedForStep(client, approverId, request.organization_id, currentStep);
            if (!isAuthorized) {
                throw new AppError('You are not authorized to act on this approval step', 403);
            }

            const now = new Date();

            // Update step status
            await client.query(
                `UPDATE approval_steps 
                 SET status = $1, approver_id = COALESCE(approver_id, $2), comment = $3, action_timestamp = $4
                 WHERE request_id = $5 AND step_number = $6`,
                [decision, approverId, comment || null, now, requestId, currentStepNum]
            );
```

Everything below this point in `processStepDecision` (the `let newReqStatus = 'pending';` line through the end of the function) stays exactly as it is today — only the code above it changes.

- [ ] **Step 3: Verify unauthorized and authorized decisions**

Reusing `$ORG_ID`, `$REQUEST_ID`, `$STAFF_TOKEN`, `$MANAGER_TOKEN`, `$OUTSIDER_TOKEN` from Task 1's verification (re-run Task 1 Step 2's full script first if starting a new shell):

```bash
# Outsider attempts to approve — must be rejected
curl -s -o /dev/null -w "Outsider decision -> HTTP %{http_code}\n" -X POST \
  http://localhost:8080/v1/approvals/$REQUEST_ID/decision \
  -H "Content-Type: application/json" -H "Authorization: Bearer $OUTSIDER_TOKEN" \
  -d '{"decision":"approved","comment":"should fail"}'

# Staff (subordinate role) attempts to approve — must be rejected
curl -s -o /dev/null -w "Staff decision -> HTTP %{http_code}\n" -X POST \
  http://localhost:8080/v1/approvals/$REQUEST_ID/decision \
  -H "Content-Type: application/json" -H "Authorization: Bearer $STAFF_TOKEN" \
  -d '{"decision":"approved","comment":"should fail"}'

# Manager (correct role) approves — must succeed
curl -s -X POST http://localhost:8080/v1/approvals/$REQUEST_ID/decision \
  -H "Content-Type: application/json" -H "Authorization: Bearer $MANAGER_TOKEN" \
  -d '{"decision":"approved","comment":"looks good"}' \
  | node -e "console.log(JSON.parse(require('fs').readFileSync(0,'utf8')).data.request.status)"
```

Expected:
- `Outsider decision -> HTTP 403`
- `Staff decision -> HTTP 403`
- `approved` (the single-step request is now fully approved)

- [ ] **Step 4: Verify an ancestor role (Owner) can act on a subordinate role's step**

```bash
# Owner submits a second request with an "any Manager" step
FILE_ID_2=$(curl -s -X POST http://localhost:8080/v1/storage/upload-url -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OWNER_TOKEN" \
  -d '{"fileName":"test2.txt","size":10,"mimeType":"text/plain","folderId":null}' \
  | node -e "process.stdout.write(JSON.parse(require('fs').readFileSync(0,'utf8')).data.fileId)")

REQUEST_ID_2=$(curl -s -X POST http://localhost:8080/v1/approvals -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OWNER_TOKEN" \
  -d "{\"orgId\":\"$ORG_ID\",\"fileId\":\"$FILE_ID_2\",\"title\":\"Ancestor test\",\"steps\":[{\"role_name\":\"Manager\",\"approver_id\":\"\"}]}" \
  | node -e "process.stdout.write(JSON.parse(require('fs').readFileSync(0,'utf8')).data.request.id)")

# Owner (ancestor of Manager) approves the Manager-role step directly — must succeed
curl -s -X POST http://localhost:8080/v1/approvals/$REQUEST_ID_2/decision \
  -H "Content-Type: application/json" -H "Authorization: Bearer $OWNER_TOKEN" \
  -d '{"decision":"approved","comment":"owner override"}' \
  | node -e "console.log(JSON.parse(require('fs').readFileSync(0,'utf8')).data.request.status)"
```

Expected: `approved`

- [ ] **Step 5: Commit**

```bash
git add backend/src/repositories/approvalRepository.js
git commit -m "fix: reject approval decisions from users not authorized for the current step"
```

---

### Task 3: Regression check — specific-approver steps still work unchanged

**Files:** none (verification only)

- [ ] **Step 1: Verify a specific-approver step is unaffected by both fixes**

```bash
FILE_ID_3=$(curl -s -X POST http://localhost:8080/v1/storage/upload-url -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OWNER_TOKEN" \
  -d '{"fileName":"test3.txt","size":10,"mimeType":"text/plain","folderId":null}' \
  | node -e "process.stdout.write(JSON.parse(require('fs').readFileSync(0,'utf8')).data.fileId)")

MANAGER_ID=$(curl -s http://localhost:8080/v1/organizations/$ORG_ID/members -H "Authorization: Bearer $OWNER_TOKEN" \
  | node -e "const m=JSON.parse(require('fs').readFileSync(0,'utf8')).data.members; process.stdout.write(m.find(x=>x.role_name==='Manager').user_id)")

REQUEST_ID_3=$(curl -s -X POST http://localhost:8080/v1/approvals -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OWNER_TOKEN" \
  -d "{\"orgId\":\"$ORG_ID\",\"fileId\":\"$FILE_ID_3\",\"title\":\"Specific approver test\",\"steps\":[{\"role_name\":\"Manager\",\"approver_id\":\"$MANAGER_ID\"}]}" \
  | node -e "process.stdout.write(JSON.parse(require('fs').readFileSync(0,'utf8')).data.request.id)")

# Staff must still not see or act on it
curl -s http://localhost:8080/v1/approvals/pending -H "Authorization: Bearer $STAFF_TOKEN" \
  | node -e "console.log('Staff pending count:', JSON.parse(require('fs').readFileSync(0,'utf8')).data.pending.length)"

# The Owner, despite being an ancestor of Manager, is NOT the specific named approver — must be rejected
curl -s -o /dev/null -w "Owner decision on specific-approver step -> HTTP %{http_code}\n" -X POST \
  http://localhost:8080/v1/approvals/$REQUEST_ID_3/decision \
  -H "Content-Type: application/json" -H "Authorization: Bearer $OWNER_TOKEN" \
  -d '{"decision":"approved"}'

# The named Manager approves — must succeed
curl -s -X POST http://localhost:8080/v1/approvals/$REQUEST_ID_3/decision \
  -H "Content-Type: application/json" -H "Authorization: Bearer $MANAGER_TOKEN" \
  -d '{"decision":"approved"}' \
  | node -e "console.log(JSON.parse(require('fs').readFileSync(0,'utf8')).data.request.status)"
```

Expected:
- `Staff pending count: 0`
- `Owner decision on specific-approver step -> HTTP 403` (confirms ancestor-role authorization only applies to "any role" steps, never overrides a specifically named approver)
- `approved`

- [ ] **Step 2: No commit for this task** — verification only. If any expectation fails, fix the relevant code in Task 1 or Task 2 and re-run this check.

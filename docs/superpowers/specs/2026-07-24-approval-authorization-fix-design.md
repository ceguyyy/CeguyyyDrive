# Approval Authorization Fix — Design Spec

Date: 2026-07-24

## Problem

`approvalRepository.js` has a real authorization gap on "any member of role X"
approval steps (created when `SubmitForApprovalModal` leaves "Specific
Approver" as "Any member in role", storing `approval_steps.approver_id = NULL`):

- `findPendingApprovalsForUser(userId)` (line 42-61): when `st.approver_id IS
  NULL`, the `WHERE (st.approver_id = $1 OR st.approver_id IS NULL)` clause
  matches for **every** authenticated user, regardless of organization
  membership or role. Any logged-in user sees these steps in their pending
  approvals.
- `processStepDecision(requestId, approverId, decision, comment)` (line
  106-164): performs **no authorization check at all**. Any authenticated
  user who knows (or guesses/is sent) a `requestId` can call `POST
  /approvals/:id/decision` and approve or reject it, regardless of
  organization membership, role, or whether they were the assigned approver.

This must be fixed at the repository/service layer — the frontend already
only shows what these endpoints return, so no UI changes are required beyond
the endpoints now correctly filtering/rejecting.

## Goals

- A step with a specific `approver_id` set continues to be actionable only by
  that exact user (unchanged, already correct).
- A step with `approver_id IS NULL` ("any member in role X") is actionable by:
  any accepted member of that organization whose role is X, **or** whose role
  is an ancestor of X in the Role Hierarchy (consistent with the
  ancestor-manages-descendant rule already established for Company Drive
  access).
- `processStepDecision` rejects (403) any caller who isn't authorized for the
  request's *current* step before mutating anything.

## Non-goals

- No changes to `submitForApproval`, template steps, or the frontend modal —
  this is purely closing the authorization gap in the existing decision path.
- No change to specific-approver steps' behavior.

## Backend

**`approvalRepository.findPendingApprovalsForUser(userId)`**: rewrite the
query to compute, via a recursive CTE, every `(organization_id, role_name)`
the calling user is authorized to act as — their own memberships' roles plus
every descendant role in each organization's hierarchy — and require
"any member" steps (`approver_id IS NULL`) to match one of those roles for the
step's organization. Specific-approver steps (`approver_id = $1`) are
unaffected.

**`approvalRepository.processStepDecision`**: before mutating, look up the
current step's `organization_id`, `role_name`, and `approver_id`. If
`approver_id` is set, require it equals the caller. If not set, compute the
caller's authorized-role set for that organization (same recursive shape as
above, scoped to one org) and require the step's `role_name` is in it.
Throw `AppError('You are not authorized to act on this approval step', 403)`
otherwise, before any `UPDATE` runs, inside the existing transaction.

## Frontend

No changes. `ApprovalsPage.jsx` already renders whatever `GET
/approvals/pending` returns and calls `POST /approvals/:id/decision` — once
the backend correctly scopes both, the "Pending My Approval" tab stops
showing steps the viewer isn't entitled to act on, and attempting to approve
a step outside one's authority now fails with a clear 403 instead of silently
succeeding.

## Out of scope / follow-ups

- Auditing/logging unauthorized attempt events.
- Any change to how `submitForApproval` assigns steps.

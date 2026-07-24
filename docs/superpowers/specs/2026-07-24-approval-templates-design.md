# Approval Workflow Templates — Design Spec

Date: 2026-07-24

## Problem

Submitting a file for approval requires manually re-building the same
multi-step chain (role + optional specific approver per step) every single
time in `SubmitForApprovalModal.jsx`. Organizations that always use the same
sequence (e.g. "Manager then Owner") have no way to save and reuse it.

## Goals (v1)

- Any accepted member of an organization can create, edit, and delete named
  approval-step templates for that organization, managed from a dedicated tab
  in Organization Settings.
- `SubmitForApprovalModal` gets a "Load Template" dropdown that instantly
  populates the step-builder from a saved template. Loaded steps remain fully
  editable afterward and are not linked back to the template (editing them
  after loading does not modify the saved template).

## Non-goals (v1)

- No permission tiering for template management — any accepted member can
  manage any template in the org (no owner-only or role-hierarchy gate).
- No versioning/history of template changes.
- No "save current steps as a new template" shortcut directly inside
  `SubmitForApprovalModal` — template creation happens only in Organization
  Settings' dedicated tab.

## Data Model

Two new tables:

```sql
CREATE TABLE approval_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE approval_template_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id UUID NOT NULL REFERENCES approval_templates(id) ON DELETE CASCADE,
    step_number INT NOT NULL,
    role_name VARCHAR(100) NOT NULL,
    approver_id UUID REFERENCES users(id) ON DELETE SET NULL
);
```

Mirrors the shape of `approval_requests`/`approval_steps` exactly, minus the
runtime state columns (`status`, `comment`, `action_timestamp`) that only make
sense for an actual in-flight request.

## Backend

New endpoints (any accepted org member, no hierarchy check):

| Method | Path | Purpose |
|---|---|---|
| GET | `/organizations/:orgId/approval-templates` | List all templates for the org, each with its steps |
| POST | `/organizations/:orgId/approval-templates` | Create a template (name + steps array) |
| PUT | `/organizations/:orgId/approval-templates/:id` | Replace a template's name/steps |
| DELETE | `/organizations/:orgId/approval-templates/:id` | Delete a template |

## Frontend

**Organization Settings** ([OrganizationSettings.jsx](../../../frontend/src/pages/OrganizationSettings.jsx)):
new tab "Approval Templates" alongside the existing "Members & Invites" and
"Hierarchy" tabs. Lists templates with Edit/Delete actions, plus a
"+ New Template" form reusing the same step-builder UI pattern already in
`SubmitForApprovalModal.jsx` (role select + optional specific-approver select,
Add/Remove step).

**`SubmitForApprovalModal.jsx`**: a "Load Template" dropdown above the
step-builder, populated from `GET /organizations/:orgId/approval-templates`.
Selecting one replaces the current `steps` state with the template's steps
(deep-copied, not referenced) — the title field and org selection are
untouched.

## Out of scope / follow-ups

- Role-gated template management.
- "Save as template" shortcut from the submit modal itself.

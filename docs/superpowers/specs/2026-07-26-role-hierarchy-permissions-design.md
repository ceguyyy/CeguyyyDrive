# Hierarchy-scoped member role management

**Date:** 2026-07-26
**Status:** Approved

## Problem

Every organization already stores a role tree in `organization_roles`
(`parent_role_id`, edited through the drag-and-drop `RoleHierarchyCanvas`), and
every member carries a `role_name` that names a node in that tree. Nothing
consults it for authorization.

Concretely, today:

- **There is no way to change a member's role at all.** A wrong role at invite
  time is permanent short of removing and re-inviting the person.
  `organizationController.changeMemberRole` exists but is dead code: no
  `organizationService.changeMemberRole` backs it, and no route reaches it.
- **`inviteMember` has no authorization check whatsoever.** Any authenticated
  user who knows an `orgId` can invite anyone into that organization, at any
  role. The only guard is the "not Owner" name check at
  `organizationService.js:57`.
- **`saveRoles` has no authorization check either.** Any authenticated user can
  `POST /organizations/:orgId/roles` and replace the entire hierarchy. Left
  alone, this defeats any permission model built on top of that hierarchy: a
  Staff member could rewrite the tree to place their own role at the root.
- The frontend approximates delegation with a flat heuristic
  (`invitableRoles` in `OrganizationSettings.jsx:188` — exclude `Owner`, exclude
  your own role name). It is client-side only, so it is advisory, and it is
  flat, so a Staff member is offered Manager.

## Goals

- One rule, derived from the role tree, governing who may assign which role to
  whom.
- A member's role can be changed, within that rule.
- `inviteMember` enforces the same rule.
- The hierarchy itself is editable only by the owner, so the rule cannot be
  rewritten by the people it restricts.
- The UI offers exactly the actions the server will accept.

## Non-goals

- **Removing members and setting per-member storage limits stay owner-only.**
  They are deliberately not delegated in this change.
- Reworking the role canvas, storage quota inheritance, or the approval flow.
- Read authorization. `getMembers` and `getRoles` remain readable by any
  authenticated caller; that gap is noted under Risks, not fixed here.

## The rule

> An actor may manage a member whose role is a **descendant** of the actor's
> role, and may assign a role that is a **descendant** of the actor's role.

Strict descendant: never your own role, never upward, never a sibling branch.
On the default `Owner → Manager → Staff` tree this yields exactly the intended
behavior — Owner manages Manager and Staff, Manager manages Staff only, Staff
manages nobody, Manager cannot touch Owner, Staff cannot touch Manager. On a
wider tree it also keeps two sibling Managers out of each other's staff.

### The owner is not expressed through the tree

Two owner properties do not fall out of descendant computation, so they are
handled explicitly:

1. **The owner role is never assignable.** Not by role change, not by
   invitation. Ownership moves only through Transfer Owner. This is already the
   stated policy at `organizationService.js:53-56`; this change enforces it on
   every path rather than just invitation.
2. **The owner can manage members holding an orphan role.** A member whose
   `role_name` matches no node — the `'Member'` column default, or a role
   deleted from the canvas — is a descendant of nothing, so a pure tree
   computation would leave them unmanageable by anyone. The owner must be able
   to repair that state, so the owner bypasses the descendant check for
   *managing* while remaining bound by rule 1 for *assigning*.

`ownerRoleName` is resolved as the `role_name` of the member row whose
`user_id` equals `organizations.owner_id`, falling back to `'Owner'`. Deriving
it from data rather than from the literal `'Owner'` keeps the protection intact
if the canvas renames the root, and stays unambiguous if the canvas produces
more than one parentless node.

### Preconditions on the actor

The actor must be the organization owner, or a member with `status =
'accepted'`. A pending invitee has no authority.

## Prerequisite: role names must be unique per organization

The link between a member and the tree is `organization_members.role_name`
matched by name against `organization_roles.name`. Nothing prevents two nodes
in one organization from both being named `Manager`, and `saveRoles` inserts
whatever it is given. With a duplicate, "whose subtree?" has no answer and the
descendant set is decided by row order.

Migration `017_unique_org_role_name.sql`:

1. Rename collisions — for each `(organization_id, name)` group ordered by
   `created_at`, the first row keeps the name and later rows become
   `name (2)`, `name (3)`, …
2. `ALTER TABLE organization_roles ADD CONSTRAINT unique_org_role_name UNIQUE (organization_id, name)`

Members are deliberately **not** repointed. They keep their existing
`role_name`, which is the name the first (surviving) node retained, so nobody is
silently moved between branches by the migration.

`saveRoles` gains the same check in application code, rejecting a payload with
duplicate names as a 400 before it reaches the constraint, so the canvas
surfaces a readable message instead of a Postgres error.

## Design

### Core module: `backend/src/services/roleHierarchyService.js`

Pure functions over a plain array of role rows. No database access, no
`require` of anything in the project — this is the piece worth testing, and
everything else merely wires it up.

```js
getDescendantNames(roles, actorRoleName) // -> Set<string>
canAssignRole(roles, actorRoleName, targetRoleName)
canManageMemberRole(roles, actorRoleName, memberRoleName)
```

Traversal carries a visited set. `saveRoles` does not validate acyclicity
today, so a hand-crafted or mis-dragged payload can produce a cycle; a naive
walk would hang the request thread rather than fail.

`getDescendantNames` on an unknown `actorRoleName` returns an empty set — an
orphan-role actor manages nobody, which is the safe direction.

### Permission resolution: `organizationService.resolveActorScope(orgId, userId)`

Loads the organization, the actor's member row, and the role list once, and
returns the decision inputs both the enforcement paths and the UI endpoint
consume:

```js
{
  roleName,             // actor's role_name, or null when not an accepted member
  isOwner,              // organizations.owner_id === userId
  ownerRoleName,        // the protected role, resolved as described above
  assignableRoles,      // string[]
  manageableRoleNames,  // string[]
  canManageAnyRole      // true only for the owner; covers orphan-role members
}
```

- owner → `assignableRoles` = every role name except `ownerRoleName`;
  `canManageAnyRole` = true
- accepted member → both lists are `getDescendantNames(roles, roleName)`;
  `canManageAnyRole` = false
- anyone else → both lists empty, `canManageAnyRole` false

### `organizationService.changeMemberRole(orgId, memberId, roleName, requesterId)`

This is the authoritative check. Every rejection is an `AppError` so
`errorHandler` forwards the message rather than collapsing it into a generic
500.

1. Organization exists → else 404.
2. Target member exists and belongs to `orgId` → else 404.
3. `target.user_id !== org.owner_id` → else 403, *"The owner's role cannot be
   changed. Use Transfer Owner to hand over ownership."*
4. Target is not the actor's own member row → else 403, *"You cannot change
   your own role."*
5. `roleName` names a role in this organization → else 400.
6. `roleName !== ownerRoleName` → else 403, same message as step 3.
7. `canManageAnyRole || manageableRoleNames.includes(target.role_name)` → else
   403, naming the actor's role.
8. `assignableRoles.includes(roleName)` → else 403, naming the actor's role.

Steps 3 and 6 are what "the owner can only be transferred" means in practice:
the owner's row is untouchable and the owner role is unassignable, from every
direction including the owner's own.

### `organizationService.inviteMember`, extended

The existing `max_members` check and the existing Owner-name rejection stay.
Added ahead of them:

- Actor must be owner or accepted member → else 403.
- `roleName` must name a role in this organization → else 400.
- `assignableRoles.includes(roleName)` → else 403.

This makes `roleName` effectively required. The current signature defaults it
to `'Member'`, which names no node on a default tree and would now be rejected;
the parameter default is dropped so the omission fails as a clear 400 rather
than as a confusing "role not found in hierarchy". `OrganizationSettings.jsx`
always sends a role, so no UI path regresses.

### `organizationService.saveRoles`, extended

Two additions, both in service of the rule above rather than of the canvas:

- Owner-only (`org.owner_id !== requesterId` → 403). Without this, the
  hierarchy that grants permission is itself editable by anyone the hierarchy
  restricts.
- Reject duplicate role names → 400.

The existing storage-quota validations are unchanged.

### `GET /organizations/:orgId/my-permissions`

Returns `resolveActorScope` minus `ownerRoleName`, under
`data.permissions`. The frontend needs the same tree answers to decide what to
render; serving them from the server keeps one implementation of the rule
instead of a JS copy that can drift from the enforcement.

Enforcement does not depend on this endpoint. It shapes the UI only.

### Repository additions — `organizationRepository.js`

```js
findMemberByUserId(orgId, userId)  // matches user_id OR lower(email), like findUserOrganizations
findMemberById(orgId, memberId)
updateMemberRole(orgId, memberId, roleName)
```

`findMemberByUserId` matches on email as well as `user_id` because
`organization_members.user_id` is null for invitees who had no account when
invited, and the rest of the repository already resolves membership that way.

### Routes — `organization.routes.js`

```js
router.get('/:orgId/my-permissions', organizationController.getMyPermissions);
router.patch('/:orgId/members/:memberId/role', organizationController.changeMemberRole);
```

`changeMemberRole` in the controller already has the right shape and needs no
change. `getMyPermissions` is new and follows the same three-line pattern.

### Frontend — `pages/OrganizationSettings.jsx`

A new React Query entry `['org-permissions', activeOrgId]` fetches
`my-permissions`. The client-side `invitableRoles` heuristic
(`OrganizationSettings.jsx:188`) is deleted; `permissions.assignableRoles`
replaces it in the invite form's role select, and the invite form is hidden when
that list is empty.

The Role column becomes conditional per row:

```js
const canManageRow = (m) =>
    m.user_id !== activeOrg?.owner_id &&
    m.id !== currentUserMember?.id &&
    (permissions.canManageAnyRole || permissions.manageableRoleNames.includes(m.role_name));
```

Manageable rows render a small `<Select>` whose options are
`assignableRoles`; the rest keep the existing `<Chip>`. The select's current
value may be a role absent from `assignableRoles` — an orphan role seen by the
owner — so the current value is appended as a disabled option rather than
letting MUI render an out-of-range value as blank.

`changeRoleMutation` issues the `PATCH` and invalidates
`['org-members', activeOrgId]`. Its `onError` writes to the same inline error
state the invite form uses, so a server rejection is visible rather than
silent.

The Storage Limit and Actions columns keep their existing `isOwner` gate,
unchanged.

## Testing

`backend/package.json` has no test runner. Add `"test": "node --test"` — the
Node built-in, no new dependency — and
`backend/src/services/roleHierarchyService.test.js`. The module is pure, so
these run without a database.

Cases that matter:

- Default `Owner → Manager → Staff`: descendants of `Owner` are
  `{Manager, Staff}`; of `Manager`, `{Staff}`; of `Staff`, empty.
- `canManageMemberRole(roles, 'Staff', 'Manager')` is false — the upward case
  from the request.
- `canAssignRole(roles, 'Manager', 'Owner')` is false — the sideways-and-up
  case.
- Sibling branches: with `Owner → {ManagerA → StaffA, ManagerB → StaffB}`,
  `canManageMemberRole(roles, 'ManagerA', 'StaffB')` is false.
- An unknown `actorRoleName` yields an empty descendant set.
- A cyclic `parent_role_id` chain terminates instead of hanging.

Service-level behavior is verified manually against the running app, matching
how the rest of this codebase is currently verified:

- Manager changes a Staff member's role — succeeds.
- Manager attempts to change a Manager or the Owner — 403 with a readable
  message.
- Owner attempts to assign the Owner role — 403 pointing at Transfer Owner.
- Owner changes the role of a member whose `role_name` is `'Member'` — succeeds
  (the orphan case).
- A non-member `POST`s to `/invite` — 403 where it previously succeeded.

## Risks

**`inviteMember`'s tightened signature.** Dropping the `'Member'` default turns
any caller that omitted `roleName` from a silent success into a 400. The
frontend always sends one, but every server-side caller must be checked during
implementation — particularly the license-redemption path, which constructs
organizations programmatically.

**Migration `017` renames data.** Organizations that already contain duplicate
role names will see the second and later nodes renamed. Members keep pointing at
the surviving original, so no one changes branch, but the canvas will show a
`Manager (2)` node whose folder still carries the old name. Acceptable: the
alternative is leaving the permission model resting on an ambiguous key.

**`saveRoles` becoming owner-only is a behavior change**, not only a fix. Any
non-owner currently editing the canvas loses that ability. That is the intent —
the alternative is a permission model its own subjects can rewrite — but it will
be visible to existing users.

**Read authorization remains open.** `getMembers`, `getRoles`, and the new
`my-permissions` endpoint check authentication but not membership, so any
authenticated user can enumerate any organization's members by `orgId`. This
predates the change and is not addressed here; `my-permissions` returns empty
lists for a non-member, so it grants nothing, but it does confirm an
organization's existence. Worth a separate fix.

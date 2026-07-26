# Surface the organization-creation limit in the UI

**Date:** 2026-07-26
**Status:** Approved

## Problem

The backend caps each user at 3 owned organizations
(`MAX_ORGANIZATIONS_PER_USER` in `backend/src/services/organizationService.js`),
but nothing in the UI says so. A user types a name, submits, and only then
learns they are blocked.

Two defects make this worse:

1. **The message never arrives.** `createOrganization` throws a plain `Error`.
   In production `errorHandler.js` forwards `message` only when `isOperational`
   is set, which `Error` lacks, so the user sees a generic 500 "Something went
   very wrong!" instead of the limit explanation.
2. **The obvious frontend fix is wrong.** The cap counts *owned* orgs
   (`owner_id = $1`), but the list the frontend already holds contains every org
   the user is a *member* of. A user owning 1 org and invited to 4 others would
   see "5 of 3" and be blocked, while the backend would allow another.

## Goals

- Show remaining capacity before the user invests effort in the form.
- Disable the create action at the cap, with a reason.
- Make the backend's rejection message actually reach the client.

## Non-goals

- Making the cap configurable per plan or per user. It stays a constant.
- Changing the cap's value.
- Any Super Admin / Monetization Hub surface.

## Design

### Backend: return count and cap with the list

`organizationService.getUserOrganizations` returns an object instead of a bare
array:

```js
async getUserOrganizations(userId) {
    const [organizations, ownedCount] = await Promise.all([
        organizationRepository.findUserOrganizations(userId),
        organizationRepository.countOwnedOrganizations(userId),
    ]);
    return { organizations, ownedCount, maxOwnedOrganizations: MAX_ORGANIZATIONS_PER_USER };
}
```

No repository change. `countOwnedOrganizations` already exists and is the same
query `createOrganization` enforces against, so the number shown cannot
disagree with the gate that blocks.

`organizationController.getUserOrganizations` spreads the result into `data`.
`data.organizations` keeps its current shape, so the change is additive and no
existing consumer breaks.

### Backend: operational errors

Both throws in `createOrganization` become `AppError`:

- name missing → `AppError(..., 400)`
- cap reached → `AppError(..., 403)`

`AppError` sets `isOperational`, so `errorHandler` forwards the real message.
The frontend's existing `err.response?.data?.message` read then resolves.

### Frontend: normalize the shared query cache

Five components fetch `GET /organizations`, and all five use the same React
Query key `['organizations']` — so they share one cache entry:

- `components/layout/Sidebar.jsx`
- `pages/CompanyDrivePage.jsx`
- `pages/OrganizationSettings.jsx`
- `components/modals/ProfileModal.jsx`
- `components/modals/SubmitForApprovalModal.jsx`

Changing only `OrganizationSettings` to return the full payload would corrupt
that shared entry: whichever component mounts first decides the cached shape,
and the others would read the wrong one. The Sidebar renders on nearly every
page and would usually win, leaving `OrganizationSettings` with an array and an
undefined `organizations` property.

So all five `queryFn`s change together to `return res.data.data`, and each
consumer reads `orgsData?.organizations ?? []`. One cache entry, one request,
one shape.

### Frontend: `OrganizationSettings.jsx`

Beyond the shared-shape change, it destructures `ownedCount` and
`maxOwnedOrganizations` from the same payload.

The header "Create Organization" button gains `disabled={atLimit}`, an adjacent
caption reading `2 of 3 organizations used`, and a Tooltip giving the reason.
MUI disabled buttons do not emit hover events, so the Tooltip must wrap the
button in a `<span>` or it will silently never render.

### Deliberately unchanged

- **The empty-state button.** It renders only when `userOrgs.length === 0`.
  Owning 3 orgs implies membership in at least 3, so that branch is unreachable
  at the cap.
- **The create modal.** With the button disabled it is not reachable at the
  cap; duplicating the notice inside is speculative.

## Testing

- `getUserOrganizations` reports the correct `ownedCount` for a user who owns 1
  org and is a member of 4. This is the case a naive list-length count gets
  wrong.
- `createOrganization` past the cap rejects with an `AppError` carrying status
  403 and a message naming the limit.
- The header button is disabled and the caption reads `3 of 3` when
  `ownedCount` equals `maxOwnedOrganizations`.

## Risks

The backend response change is additive — `data.organizations` keeps its
current shape — so no consumer breaks on the server side.

The frontend risk is the shared `['organizations']` cache described above. It
is handled by changing all five `queryFn`s in the same commit; changing them
piecemeal would leave the cache shape dependent on mount order.

One pre-existing oddity is worth noting but not fixing here:
`OrganizationSettings.jsx` performs a side effect (`setActiveOrgId`) inside its
`queryFn`. Because the cache is shared, that function may not run at all when
another component has already populated the entry. This bug exists today and is
out of scope.

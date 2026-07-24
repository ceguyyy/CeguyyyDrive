# Password-Protected Public Share Links — Design Spec

Date: 2026-07-24

## Problem

`shares.password_hash` already exists in the schema, and the backend already
fully implements password protection end-to-end:

- `shareService.generateShareLink` hashes an optional `password` with bcrypt
  and stores it ([shareService.js:45-47](../../../backend/src/services/shareService.js)).
- `shareService.accessSharedResource` requires and verifies it — throwing
  `401 "Password required for this share"` when missing and `401 "Incorrect
  password"` when wrong ([shareService.js:90-98](../../../backend/src/services/shareService.js)).
- `POST /shares` already accepts `password` in its body; `GET
  /shares/public/:token` already reads it from `?password=` or the
  `x-share-password` header ([shareController.js](../../../backend/src/controllers/shareController.js)).

Nothing on the frontend uses any of this: `ShareModal.jsx` has no password
field when creating a public link, and `PublicShare.jsx` never sends a
password and has no handling for the 401s above — a password-protected link
would currently just show the generic "Link Invalid or Expired" error card to
every visitor, permanently.

## Goals

- `ShareModal.jsx`'s "Public Link Access" tab gets an optional password field;
  when filled, it's sent as `password` when calling `POST /shares`.
- `PublicShare.jsx` sends whatever password the visitor has entered (initially
  none) as a query param, detects the two password-related 401s, and shows a
  password-entry gate instead of the generic error card — distinct from the
  404/410 "invalid or expired" case, which keeps its current UI.
- Wrong password shows an inline error and lets the visitor retry with no
  attempt limit (matches this app's existing lack of rate-limiting-per-form
  elsewhere, e.g. login already has org-level rate limiting instead).

## Non-goals

- No backend changes — it is already correct and complete.
- No rate limiting or lockout on repeated wrong-password attempts.
- No password field for email-based sharing (`ShareModal`'s "Share by Email"
  tab) — passwords only apply to public links, matching the schema (personal
  email shares are already access-controlled by recipient identity).

## Frontend

**`ShareModal.jsx`** (Public Link Access tab): add a `TextField`
(`type="password"`, label "Password (optional)", helper text "Leave blank
for no password") between the expiration `Select` and the "Create Public
Share Link" button. Its value is included in `handleGeneratePublicLink`'s
`POST /shares` payload as `password` (omitted/undefined when blank, matching
the existing `expiresAt` omission pattern already used in that handler).

**`PublicShare.jsx`**:
- New local state: `passwordInput` (what the visitor is typing) and
  `submittedPassword` (what was last sent to the server — starts as `''`).
- The `useQuery` call passes `{ params: { password: submittedPassword } }` to
  `api.get('/shares/public/${token}', ...)` and includes `submittedPassword`
  in its `queryKey` so re-submitting a new password re-fetches.
- When `error.response?.status === 401`, render a dedicated "password
  required" card (lock icon, password `TextField`, "Unlock" button) instead
  of the current generic error card. If `error.response.data.message ===
  'Incorrect password'`, additionally show an inline `Alert` under the field.
  Submitting the form sets `submittedPassword` to `passwordInput`, triggering
  the re-fetch.
- All other error statuses (404, 410) keep today's existing generic "Link
  Invalid or Expired" card unchanged.

## Out of scope / follow-ups

- Rate limiting repeated password guesses on a single share link.

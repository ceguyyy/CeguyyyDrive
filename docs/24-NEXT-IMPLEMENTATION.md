# Next Implementation

**Status:** Backlog. Nothing here is designed or approved yet.
**Recorded:** 2026-07-26

Two products are requested here, plus a thin layer over both:

| | What it is | Depends on |
|---|---|---|
| **B. CRM** | Boards, rows, columns, views, formulas, webhooks | Nothing — the largest piece by far |
| **C. Reporting** | Widgets, charts, pivots, PDF analytics | **B** — nothing to report on until CRM exists |
| **A. AI** | Summaries and suggestions, sprinkled across features | Deliberately last |

**AI is minor throughout** — a small enhancement layered onto features that
already work, never a feature in its own right. Summaries on files and folders,
suggestions inside a board. Everything must be fully usable with it switched
off, which it is by default.

Treating it that way has a practical payoff: the one genuinely unresolved
question in this whole document is which AI provider, and demoting AI means that
question blocks nothing. Build B, then C, then sprinkle A wherever it helps.

C is meaningless without B, so they are not built in parallel.

---

## A. AI — minor, everywhere

A thin enhancement layer, built last and switched off by default. Nothing here
is on any feature's critical path: a file is still a file and a board is still a
board with all of it disabled.

Where it appears:

- **Drive** — summaries for a file, a folder, or a set of metadata (below).
- **CRM** — suggested rows, column values, and next actions inside a board.
- Anywhere later that benefits, on the same terms.

Shared rules across all of them:

- Off unless the organization's Billing toggle enables it, which is also the
  moment the customer consents to content leaving the platform.
- Bounded by the per-organization call quota, so the bill cannot run away.
- Every result is advisory. Nothing may auto-apply a suggestion, and no
  authoritative value — a quota, an approval, a total — may come from a model.
- Failure is silent and non-blocking. If the provider is down, the feature is
  absent, not broken.

### Scope

- Per-file summary, generated on demand and cached.
- Per-folder summary, composed from its files' summaries.
- Metadata summary (owner, size, type, activity) as structured output.

### Design notes

- **Summaries are derived data and must be invalidated.** A cached summary that
  survives a file replacement is worse than no summary — it states something
  false with authority. Key the cache on the file's storage key plus a version
  counter bumped on upload.
- **A summary inherits the source's permissions.** It contains the document's
  content, so anyone who cannot read the file must not read its summary. Route
  every read through the same check as `generateDownloadUrl`.
- **Text extraction is per format.** `utils/pdfService.js` already handles PDF.
  Office formats need a converter that does not exist yet.
- **This needs a job queue.** Generation is too slow for a request cycle and
  the codebase has no queue today — see Cross-cutting below.

### Open decisions

- Which model provider, and is the cost per summary billed to the organization
  or absorbed?
- A hard ceiling on document size, or chunk-and-reduce for large files?
- Is summarising a customer's documents acceptable under the deployment's data
  terms? Content leaves the platform for a third party.

---

## B. CRM

Boards with configurable columns, multiple views, formulas, and webhooks.
Scoped to an organization.

### Data model

```
crm_boards        (id, organization_id, name, visibility, created_by, …)
crm_groups        (id, board_id, name, colour, position)
crm_columns       (id, board_id, name, type, position, config JSONB)
crm_rows          (id, board_id, group_id, position, created_by, …)
crm_cells         (row_id, column_id, value JSONB)
crm_webhooks      (id, board_id, url, events[], secret, …)
crm_webhook_deliveries (id, webhook_id, status, attempts, response, …)
crm_row_dependencies   (predecessor_row_id, successor_row_id, type)  -- Gantt only
crm_row_links     (id, source_row_id, target_row_id, relation_column_id)
```

**Groups are structure, not a view setting.** A board is a list of groups
("To-Do", "Completed"), each holding ordered rows. That is different from
"group by a column", which is a rendering choice applied to a flat list — a row
belongs to exactly one group and stays there until moved. Modelling groups as a
saved group-by would break as soon as a row's grouping column is empty, or two
groups want the same status.

Groups carry their own colour, ordering, collapse state, and per-group
aggregation footers (sum, average, status distribution) computed over the rows
inside them.

**Cell storage is EAV** — one `crm_cells` row per value. Decided; see Decisions
below for the four consequences to design around (reads are a pivot, filters
mean joins, an empty cell is an absent row, and writes multiply).

### Column types

Text · Long text · Number · Date · Timestamp · Time · **Timeline** · Checkbox ·
Select · Dropdown · Label · Pipeline · **Person** · Checklist · File ·
Drive file reference · Formula · **Relation** · **Lookup** · **Rollup**

- **Drive file reference** points at an existing file in the Personal or Company
  Drive rather than uploading a copy. It must store the file id and resolve the
  URL at read time, so a moved or deleted file does not leave a dead link, and
  so drive permissions still apply.
- **Pipeline** is a Select with ordered stages; Kanban groups by it.
- **Timeline** holds a start and an end in one value, so the pair can be
  validated together and dragged as a single bar. Two separate Date columns
  cannot do either. Timeline and Gantt views read this column.
- **Person** references an organization member. It must resolve through the
  membership table, so someone removed from the organization stops appearing as
  an assignee rather than lingering as a stale name.

### Cross-board relations

Pull data from one board into another: link a row to rows in another board, then
display or aggregate their values.

Three column types, and they are not interchangeable:

- **Relation** — stores links to rows in another board. The only one that holds
  data; the other two derive from it.
- **Lookup** — displays a column from the linked rows. Read-only.
- **Rollup** — aggregates over the linked rows (sum, count, min, max).

```
crm_row_links (id, source_row_id, target_row_id, relation_column_id)
```

**The permission question is the one to get right first.** A Lookup shows values
from a board the viewer may have no access to — a Staff member could otherwise
read a restricted board's contents through a Relation someone else configured.
Resolve permissions against the *source* board at read time, per viewer, and
return a redacted placeholder rather than the value when it fails. Checking only
the board being viewed is the obvious implementation and the wrong one.

Also needed:

- **Same-organization only.** A Relation must never cross organizations, or one
  customer's board becomes readable from another's.
- **Deletion behaviour.** What a link does when its target row or board is
  deleted — dangle, null out, or block the delete. Answer before shipping, not
  after the first support ticket.
- **Batched reads.** A board with lookups turns one query into one per row
  unless links are fetched in a single pass. This is where a naive
  implementation stops being usable at a few hundred rows.
- **Rollups interact with formulas.** A formula referencing a rollup referencing
  a formula is a cycle across boards, which the existing per-board cycle check
  will not catch.

This also raises the stakes on the still-open cell storage decision: lookups and
rollups need to filter and sort on values that live in another board's rows,
which a per-row JSONB blob makes considerably harder than an indexed EAV table.

### Views

- **Table** (default)
- **Kanban**, grouped by a Select/Pipeline column
- **Calendar**, driven by a Date/Timestamp column
- **Card**, a gallery of rows rendered as cards — same data as Table, different
  density. The cheapest view to add.
- **Timeline**, rows laid out on a horizontal date axis. Needs a **Timeline**
  column type holding a start and an end together, not two loose Date columns:
  a pair of unrelated columns cannot be validated (end before start) or dragged
  as one bar.
- **Gantt**, Timeline plus dependencies between rows.

Gantt is the only view that adds data, not just presentation. Dependencies mean
a `crm_row_dependencies` table (predecessor, successor, type), and with it:

- **Cycle detection.** A depends on B depends on A must be rejected at write
  time, or rendering the chart never terminates. The same class of check the
  role hierarchy already needs — see `roleHierarchyService.hasCycle`.
- **A rescheduling rule.** When a predecessor moves, do successors shift with
  it or merely show as violated? This is a product decision, and building the
  drag interaction before answering it means rewriting it.

Table, Card, Kanban, and Calendar are all one query with different rendering.
Timeline and Gantt are not — treat them as a second phase.

### Formulas

Excel-style: `SUM`, `IF`, `=`, arithmetic, cross-column references.

**Decided: evaluated client-side, result saved to the server.** See Decisions
below for the two consequences that must be designed around — a persisted
client-computed value is user-controllable, and it goes stale when the rows it
references change.

**Never `eval`, on either side.** A formula is user input that other members of
the organization will trigger. `eval` or `new Function` is remote code execution
on the server, and cross-site scripting in the browser. This needs a real parser
with a fixed function allowlist — evaluate `formulajs` or `hot-formula-parser`
for licence and maintenance before committing.

Also needs cycle detection (A references B references A).

### Webhooks

Events: `row.created`, `row.updated`, `row.deleted`.

- Sign each delivery with a per-webhook secret so the receiver can verify it.
- Retry with backoff and record failures. A webhook that silently drops events
  is worse than none, because the receiving system diverges without anyone
  noticing.
- Delivery must not run inside the request that triggered it.

### Board templates

Predefined boards a user can start from — groups, columns, and their config,
without rows.

- Platform templates ship with the product; an organization can also save one of
  its own boards as a template for reuse.
- A template is a snapshot, not a link. Editing the template must not reach into
  boards already created from it, and a board created from a template must keep
  working after the template is deleted.
- Templates referencing a Person column cannot carry the people — those resolve
  to nobody in a different organization.

### Toolbar and table behaviour

Visible in the reference UI and worth listing so they are not discovered as
"missing" late: search, filter, sort, hide columns, group by, pin columns, item
height, conditional colouring, default values for new rows, and per-group
aggregation footers.

Conditional colouring and default values are stored per board, so they belong in
the board config rather than in each user's local state — two people looking at
the same board should see the same colours.

### AI suggestions

Suggested rows, column values, or next actions, offered in-board. Covered by
section A — minor, last, off by default, and quota-bounded. CRM ships complete
without it.

### Import / export

- Export: CSV and XLSX, current view and filters applied.
- Import: CSV and XLSX, with a column-mapping step and a dry-run preview.
  Silent partial imports are the usual failure here — report per-row errors
  rather than aborting or half-writing.
- Bulk delete and bulk export over the current selection.

### Sharing

Share a board by link, and invite by link, the way the drive already does.
Reuse the existing share mechanism rather than building a second one — the
`shares` table, token generation, and the `/s/:token` public route all exist,
and password-protected links were already designed in
[superpowers/specs/2026-07-24-share-link-password-design.md](superpowers/specs/2026-07-24-share-link-password-design.md).

**Required on every board link: a password option and an expiry.** Both are
decided, not optional extras. A board link exposes far more than a single file —
every row, every column, and whatever the Person and Drive-reference columns
resolve to — so a link that never expires and asks for nothing is a standing
leak of the whole board. Revocation is needed alongside them: expiry handles
the link nobody remembered, revocation handles the one that was sent to the
wrong person five minutes ago.

Three things a board share needs that a file share does not:

- **A link bypasses the role-subtree rule.** That is what a link is for, but it
  means the board's visibility setting no longer governs who reads it. Sharing
  must be an explicit act, not a checkbox that quietly turns a restricted board
  public.
- **A shared board leaks its columns' references.** Person columns carry
  members' names and emails; Drive file references resolve to organization
  files. A public view has to redact or refuse those, or a link handed to an
  outsider hands over the member directory with it.
- **Invite-by-link adds a member to the organization**, so it must run through
  the same hierarchy rule as `inviteMember` — a link cannot grant a role its
  creator could not assign directly.

Read-only and comment-only link modes are the obvious split; editable links
should wait until the redaction question above is answered.

### Permissions

**Decided: a per-board setting — public, or restricted to a role subtree.**

Public means the whole organization. Restricted reuses `roleHierarchyService`,
the same subtree rule already enforced for members and drive folders, rather
than inventing a second model. Default to restricted, so a board cannot leak by
omission.

---

## C. Reporting

A sidebar entry rendering analytics over CRM data.

- Customisable widgets on a grid.
- Chart types: bar, column, line, pie, pivot table.
- Advanced filtering and search across boards.
- Export the whole report to PDF, charts included.

### Design notes

- **PDF with charts — decided: client capture.** The browser captures its
  canvases and uploads them with the report request; the server composes the PDF
  from those images. No headless browser in the deployment. The cost is that a
  report cannot be produced by a scheduled job, since there is no browser to
  capture from — scheduled reports would be a second rendering path.
- Pivot tables need their own aggregation query builder; they are not a chart
  type with different styling.
- Reports read across an organization's boards, so the same permission rule as
  B applies, and a report must never aggregate rows its viewer cannot see.

---

## Cross-cutting, needed before A or B

**A job queue.** There is none today. AI summarisation, webhook delivery, and
large imports and exports all need work that outlives a request. Adding it once,
first, is cheaper than three ad-hoc `setTimeout` implementations.

**Billing.** Decided: **every CRM capability is configurable per organization
through the Billing service**, not just CRM as a whole. Follows the pattern
already in place for Integration — columns on `organizations`, `org_licenses`,
and `subscription_tiers`, enforced server-side and not merely hidden in the UI.

Individually switchable, so a tier can sell a subset:

| | |
|---|---|
| `crm_enabled` | the module at all |
| `crm_max_boards`, `crm_max_rows` | quotas |
| `crm_views_enabled` | which views — Gantt and Timeline are the natural premium ones |
| `crm_formulas_enabled` | formula columns |
| `crm_webhooks_enabled` | outbound webhooks |
| `crm_ai_enabled` | AI suggestions |
| `crm_import_export_enabled` | CSV/XLSX in and out |
| `crm_public_sharing_enabled` | share and invite by link |
| `reporting_enabled` | section C |

That is a lot of flags. Store them as one `crm_features JSONB` column rather
than a dozen boolean columns across three tables, or every new capability
becomes another migration on `organizations`, `org_licenses`, and
`subscription_tiers` at once.

Settle whether the CRM quota counts rows, the bytes of attached files, or both.
Attached files already consume drive storage, so counting them again would
overstate what an organization is using.

---

## Decisions made (2026-07-26)

**Cell storage — EAV.** One row per value in `crm_cells (row_id, column_id,
value)`, not a JSONB document per row. This was the decision everything else in
B rested on; it is now settled.

It is the right call for Lookups, Rollups, and cross-column filtering, which all
want to query a single column's values without unpacking every row. The costs
come with it and should be designed for from the start rather than discovered:

- **Reading a board is a pivot.** Rows × columns cells come back flat and have to
  be assembled. Fetch all cells for the visible rows in one query and pivot in
  memory; a query per row is the failure mode here.
- **Filtering on N columns means N joins or a semi-join per predicate.** Index
  `(column_id, row_id)` and add expression indexes on the value for the types
  actually filtered on — numbers and dates first.
- **An empty cell is an absent row, not a null value.** Every read path has to
  treat "no cell" and "cell containing null" identically, or a board will show
  gaps where a filter expected blanks.
- **Writes multiply.** Creating a row with twenty columns is twenty inserts, and
  a CSV import of a thousand rows is twenty thousand. Batch them; do not loop.

**AI enablement — a per-organization Billing toggle.** `crm_ai_enabled`, and the
equivalent for file summaries, alongside the other capability flags.

This settles the consent boundary: nothing is sent anywhere for an organization
that has not had the feature switched on, so enabling it is the moment the
customer opts in. **It does not settle the provider** — see Still open.

**AI usage quota — also set per organization in Billing.** A call ceiling, not
just an on/off switch, since every request costs real money and an unbounded
feature is an unbounded bill.

What it needs to be usable rather than merely present:

- **A period.** A quota with no reset is a lifetime allowance; monthly, aligned
  to the billing cycle, is the expected meaning.
- **Counted at the point of spend.** Increment when the provider call is made,
  not when the user clicks — a failed or cached request must not consume quota,
  and a retried one must not double-count.
- **A refusal that explains itself.** Hitting the ceiling should say the
  organization's AI quota is exhausted and when it resets, not fail as a generic
  error. This is the difference between a support ticket and a plan upgrade.
- **Visible before it runs out.** Remaining calls belong on the Billing screen
  and near the AI action itself; a limit a user cannot see is one they only
  learn about by hitting it.

**Formula evaluation — client-side, result persisted to the server.**
The browser computes; saving sends the computed value up.

Two consequences to design around, not to discover later:

- A persisted value the client computed is user-controllable. Anyone can post
  an arbitrary number to the cell that a formula claims produced it. The server
  must therefore never trust a formula result for anything that grants or bills
  — quota, entitlement, approval thresholds. If a formula ever needs to be
  authoritative, it has to be recomputed server-side at that moment.
- Values go stale. A formula referencing another row does not recompute when
  that row changes elsewhere, so a cell can display a figure that no longer
  follows from its inputs. Either recompute on board load, or store the inputs'
  version alongside the result and mark it stale.

Keep the evaluator's function allowlist shared between client and any future
server recomputation, so the two cannot disagree about what `SUM` means.

**PDF chart rendering — client capture.**
Canvases are captured in the browser and uploaded with the report request; the
server composes the PDF from images. Avoids a headless browser in the
deployment. Means a report cannot be generated by a scheduled job with no
browser attached — if scheduled reports are ever wanted, that is a second
rendering path, not a setting.

**Board visibility — per-board setting: public or role-subtree restricted.**
"Public" means the whole organization. "Restricted" reuses the existing subtree
rule from `roleHierarchyService`, the same one governing members and drive
folders. Stored on the board, defaulting to restricted — a board that leaks by
omission is worse than one that has to be opened deliberately.

**CRM storage quota — configurable in the Billing service.**
Follows the pattern already in place for Integration: a column on
`organizations`, `org_licenses`, and `subscription_tiers`, enforced server-side.
Decide whether it is a row count, a byte count over attached files, or both —
attached files already consume drive storage, so counting them twice would
overstate usage.

## Still open

1. **Which AI provider.** Enablement, consent, and spend are settled — a
   per-organization Billing toggle plus a call quota. The provider itself is
   not, and it carries a question the toggle does not answer: whether that
   vendor's terms permit customer documents to be sent at all, and what they may
   retain.

   **Not blocking.** AI is minor and built last, so this can stay open through
   all of B and C.

2. **What a Relation does when its target row or board is deleted** — dangle,
   null out, or block the delete. Small next to the storage question that was
   just settled, but it needs an answer before cross-board relations ship rather
   than after the first support ticket.

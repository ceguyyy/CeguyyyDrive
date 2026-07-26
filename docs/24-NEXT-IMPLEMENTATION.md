# Next Implementation

**Status:** Backlog. Nothing here is designed or approved yet.
**Recorded:** 2026-07-26

Three separate products are requested here, not one feature:

| | What it is | Depends on |
|---|---|---|
| **A. AI Summary** | Summarise files, folders, and metadata | Nothing — shippable alone |
| **B. CRM** | Boards, rows, columns, views, formulas, webhooks | Nothing — the largest piece |
| **C. Reporting** | Widgets, charts, pivots, PDF analytics | **B** — it has nothing to report on until CRM exists |

They should not be built in parallel or released together. C is meaningless
without B, and A shares no code with either.

---

## A. AI Summary

Summaries for a file, a folder, or a set of metadata.

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
crm_boards        (id, organization_id, name, created_by, …)
crm_columns       (id, board_id, name, type, position, config JSONB)
crm_rows          (id, board_id, position, created_by, …)
crm_cells         (row_id, column_id, value JSONB)
crm_webhooks      (id, board_id, url, events[], secret, …)
crm_webhook_deliveries (id, webhook_id, status, attempts, response, …)
```

**The cell storage model is the decision that is expensive to reverse.** A
`crm_cells` row-per-value (EAV) keeps columns flexible but makes filtering and
sorting across many columns slow; a single JSONB blob per row is fast to read
but awkward to index per column. Postgres `jsonb_path_ops` on a per-row JSONB
document is the likely answer, but it must be settled before any UI is written.

### Column types

Text · Long text · Number · Date · Timestamp · Time · Checkbox · Select ·
Dropdown · Label · Pipeline · Checklist · File · Drive file reference · Formula

- **Drive file reference** points at an existing file in the Personal or Company
  Drive rather than uploading a copy. It must store the file id and resolve the
  URL at read time, so a moved or deleted file does not leave a dead link, and
  so drive permissions still apply.
- **Pipeline** is a Select with ordered stages; Kanban groups by it.

### Views

- Table (default)
- Kanban, grouped by a Select/Pipeline column
- Calendar, driven by a Date/Timestamp column

### Formulas

Excel-style: `SUM`, `IF`, `=`, arithmetic, cross-column references.

**Never `eval`.** A formula is user input that other members of the
organization will trigger; `eval` or `new Function` on it is remote code
execution against the server. This needs a real parser with a fixed function
allowlist — evaluate `formulajs` or `hot-formula-parser` for licence and
maintenance before committing.

Also needs: cycle detection (A references B references A), and a decision on
whether formulas evaluate server-side on write or client-side on read.

### Webhooks

Events: `row.created`, `row.updated`, `row.deleted`.

- Sign each delivery with a per-webhook secret so the receiver can verify it.
- Retry with backoff and record failures. A webhook that silently drops events
  is worse than none, because the receiving system diverges without anyone
  noticing.
- Delivery must not run inside the request that triggered it.

### Import / export

- Export: CSV and XLSX, current view and filters applied.
- Import: CSV and XLSX, with a column-mapping step and a dry-run preview.
  Silent partial imports are the usual failure here — report per-row errors
  rather than aborting or half-writing.
- Bulk delete and bulk export over the current selection.

### Permissions

Reuse `roleHierarchyService`. A board belongs to an organization, so visibility
should follow the same subtree rule already enforced for members and drive
folders rather than inventing a second model.

---

## C. Reporting

A sidebar entry rendering analytics over CRM data.

- Customisable widgets on a grid.
- Chart types: bar, column, line, pie, pivot table.
- Advanced filtering and search across boards.
- Export the whole report to PDF, charts included.

### Design notes

- **PDF with charts is the hard part.** Charts render in the browser; a PDF is
  produced on the server. Either render server-side with a headless browser, or
  capture the client canvases and send images up. Decide before building the
  widget layer — it constrains how charts are drawn.
- Pivot tables need their own aggregation query builder; they are not a chart
  type with different styling.
- Reports read across an organization's boards, so the same permission rule as
  B applies, and a report must never aggregate rows its viewer cannot see.

---

## Cross-cutting, needed before A or B

**A job queue.** There is none today. AI summarisation, webhook delivery, and
large imports and exports all need work that outlives a request. Adding it once,
first, is cheaper than three ad-hoc `setTimeout` implementations.

**Billing.** CRM and Reporting are billable surfaces. They should follow the
pattern already in place for Integration: a `feature_*_enabled` column on
`organizations`, `org_licenses`, and `subscription_tiers`, enforced server-side
and not merely hidden in the sidebar.

---

## Open questions to settle before any of this starts

1. Cell storage: JSONB per row, or EAV? Everything in B is built on the answer.
2. Formula evaluation: server-side on write, or client-side on read?
3. AI provider, cost model, and whether customer content may leave the platform.
4. PDF chart rendering: headless browser server-side, or client capture?
5. Does CRM data count against the organization's storage quota?
6. Is a board visible to the whole organization, or scoped by role subtree?

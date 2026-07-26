# Backlog

## Next Implementation (not yet designed)

Recorded in [24-NEXT-IMPLEMENTATION.md](24-NEXT-IMPLEMENTATION.md). Build in
this order — Reporting has nothing to report on until CRM exists, and AI is a
thin layer over features that must already work without it.

- [ ] **Prerequisite: a job queue.** None exists. Webhook delivery, bulk
      import/export, and later AI all need it.
- [ ] **B. CRM** — boards, groups, columns, rows; table/card/kanban/calendar
      views, then timeline/gantt; cross-board relations, lookups and rollups;
      formulas, webhooks, templates, link sharing, CSV/XLSX import and export.
      Every capability billable individually. By far the largest piece.
- [ ] **C. Reporting** — widgets, charts, pivots, PDF analytics. **Depends on B.**
- [ ] **A. AI** — summaries on drive files and folders, suggestions inside a
      board. **Minor and last.** Off by default, quota-bounded, advisory only;
      every feature ships complete without it.

Design decisions are settled — cell storage (EAV), formula evaluation, PDF
rendering, board visibility, sharing, and billing. **Nothing is blocking:**

- [ ] Which AI provider, and whether its terms permit sending customer
      documents. Can stay open through all of B and C.
- [ ] What a cross-board Relation does when its target row or board is deleted.
      Needed before relations ship, not before work starts.

## High Priority
- [ ] Implement Neon DB Connection Pool in Node.js.
- [ ] Set up Zod schemas for all request payloads.
- [ ] Create generic Repository class for CRUD.
- [ ] Configure Vite for Neubrutalism (Tailwind config with bold colors and shadows).

## Medium Priority
- [ ] Design the `FilePreview` component (supporting images, PDF, Video).
- [ ] Build the Drag-and-Drop Dropzone overlay for the frontend.
- [ ] Implement the `upload_sessions` sweeper (cron job) to clean up orphaned uploads.

## Low Priority (Post-Launch)
- [ ] Advanced file previews (Word/Excel conversion).
- [ ] Multi-region bucket support.
- [ ] Granular bandwidth throttling for specific users.

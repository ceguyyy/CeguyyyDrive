# Backlog

## Next Implementation (not yet designed)

Three products, recorded in [24-NEXT-IMPLEMENTATION.md](24-NEXT-IMPLEMENTATION.md).
Build order matters — Reporting has nothing to report on until CRM exists.

- [ ] **A. AI Summary** — per file, folder, and metadata. Independent of B and C.
- [ ] **B. CRM** — boards, groups, columns, rows; table/card/kanban/calendar
      views, then timeline/gantt; formulas, webhooks, templates, AI suggestions,
      CSV/XLSX import and export. Every capability billable individually.
      The largest piece.
- [ ] **C. Reporting** — widgets, charts, pivots, PDF analytics. **Depends on B.**
- [ ] **Prerequisite: a job queue.** None exists. AI summarisation, webhook
      delivery, and bulk import/export all need it.

Four of the six open decisions are settled (formula evaluation, PDF rendering,
board visibility, CRM quota). **Two remain, both blocking:**

- [ ] **Cell storage model** — JSONB per row or EAV. The most expensive to
      reverse; everything in B is built on it.
- [ ] **AI provider, cost model, and whether customer content may leave the
      platform.** A legal and commercial call before a technical one, and it
      determines whether A is viable at all.

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

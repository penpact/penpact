# Multi-Document Envelopes Implementation Plan

> REQUIRED SUB-SKILL: superpowers:test-driven-development. Checkbox steps.

**Goal:** Let one envelope hold several source PDFs; fields target a specific document; on completion all source documents are merged into one sealed final PDF with signatures at the correct pages.

**Architecture:** Add `documents.position`; `uploadDocument` appends instead of replacing; `placeFields` takes an optional `documentId` (defaults to the sole document, errors if ambiguous). The signing session exposes a `documents[]` list and the signer document endpoint serves a doc by id. Sealing merges every source doc (in position order) into one PDF, flattening each field onto `pageOffset[documentId] + field.page`. Single-document envelopes are a special case (offset 0), so existing behavior is unchanged.

**Tech Stack:** Drizzle/Postgres, pdf-lib (copyPages), Hono, R2, Vitest.

---

## File structure
- `packages/db/src/schema.ts` — `documents.position`.
- `packages/db/drizzle/0007_document_position.sql` + journal.
- `apps/api/src/services/documents.ts` — append + return position; download by id helper.
- `apps/api/src/services/fields.ts` — resolve documentId per field.
- `apps/api/src/schemas.ts` — placeFieldsSchema: optional documentId.
- `apps/api/src/services/pdf.ts` — `buildMergedFinalPdf(sources, fields)` (reuse field-draw logic).
- `apps/api/src/services/sealing.ts` — merge all sources.
- `apps/api/src/services/signing.ts` — session `documents[]`; getSignerDocument(token, documentId?).
- `apps/api/src/routes/v1.ts` — signer document route accepts `?documentId`.
- `apps/api/src/web/sign-page.ts` + `packages/signing-ui/src/{controller,Sign}.tsx` — render the documents list.
- Tests: `tests/api/pdf.test.ts` (merge unit), `tests/api/multidoc.int.test.ts`.

## Tasks

### Task 1: documents.position + migration 0007
Add `position` integer default 0; migration + journal; build db. Commit.

### Task 2: buildMergedFinalPdf (unit, pdf.test)
- RED: merge two 1-page PDFs with a field on each (page 1 of doc A, page 1 of doc B) → output has 2 pages and reloads; a PNG field on doc B lands on page 2.
- GREEN: copyPages in order, offset map, draw each field on offset+page (extract drawField helper reused by buildFinalPdf). Commit.

### Task 3: uploadDocument append + placeFields documentId (int)
- RED: two uploads → two source docs with position 0,1; placeFields with explicit documentId binds to it; placeFields without documentId when 2 docs → 422; page validated against the chosen doc.
- GREEN. Commit.

### Task 4: session documents[] + getSignerDocument(byId) + sealing merge (int)
- RED: 2-doc envelope, 1 field per doc, send + sign → completed; session.documents has 2 entries; the sealed final has (pagesA+pagesB) pages.
- GREEN: sealing loads all sources ordered by position, merges, flattens. Commit.

### Task 5: UIs render documents[] + routes + SDK + live verify
- Hosted page + React iterate session.documents (one viewer each). Signer route `?documentId`. SDK uploadDocument returns position. Build + tests green. Deploy; live: 2-doc envelope → sign → download merged final shows both docs. (verification-before-completion)

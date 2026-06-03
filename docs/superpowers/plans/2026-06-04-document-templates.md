# Document Templates Implementation Plan

> REQUIRED SUB-SKILL: superpowers:test-driven-development. Checkbox steps.

**Goal:** Let an integrator save a reusable template (a document + field placements + signer roles) and instantiate it into a normal draft envelope by mapping roles to real signers.

**Architecture:** Three additive tables (`templates`, `template_roles`, `template_fields`); the template's PDF lives in R2 like envelope docs. Instantiation copies the template's bytes to a fresh envelope document and creates a standard draft envelope (signers from role mapping, fields with the right signerId), so send/sign/seal/certificate are unchanged. API-key auth, owner-scoped.

**Tech Stack:** Drizzle/Postgres, Hono, R2 storage, Vitest. No new deps.

---

## File structure
- `packages/db/src/schema.ts` — add `templates`, `template_roles`, `template_fields` + relations.
- `packages/db/drizzle/0006_templates.sql` + journal.
- `apps/api/src/services/templates.ts` — create/list/get/delete, uploadTemplateDocument, placeTemplateFields, instantiateTemplate.
- `apps/api/src/routes/v1.ts` — `/v1/templates` routes.
- `apps/api/src/schemas.ts` — templateCreateSchema, placeTemplateFieldsSchema, instantiateSchema.
- `packages/sdk/src/index.ts` — template client methods.
- Tests: `tests/api/templates.int.test.ts`.

## Data model
- `templates`: id, user_id (cascade), name, document_name, storage_key (null until upload), content_hash, page_count, byte_size, created_at, updated_at.
- `template_roles`: id, template_id (cascade), name, routing_order (default 1), created_at.
- `template_fields`: id, template_id (cascade), role_id (cascade), type (fieldType enum), page, x, y, width, height (double), required (bool), created_at. CHECK geometry like `fields`.

## Endpoints (/v1/templates, API-key auth, owner-scoped)
1. `POST /v1/templates` `{name, documentName, roles:[{name, routingOrder?}]}` → template + role ids.
2. `PUT /v1/templates/:id/document` (PDF) → R2 `templates/{id}/source.pdf`, sets meta.
3. `POST /v1/templates/:id/fields` `{fields:[{type, roleId, page, x,y,width,height, required?}]}` → validates role membership + page bounds.
4. `GET /v1/templates`, `GET /v1/templates/:id`, `DELETE /v1/templates/:id`.
5. `POST /v1/templates/:id/envelopes` `{signers:[{roleId,name,email}], documentName?, expiresAt?}` → instantiate → draft envelope.

## Tasks (inline TDD; integration tests since flow is DB+R2 heavy)

### Task 1: Schema + migration 0006
- Add tables + relations + CHECK; hand-author SQL + journal idx 6; `pnpm --filter @penpact/db build`. Commit.

### Task 2: create/list/get/delete + roles (int test)
- RED: createTemplate returns template + roles; listTemplates shows it; getTemplate includes roles+fields; deleteTemplate removes it; cross-user get → 404.
- GREEN. Commit.

### Task 3: uploadTemplateDocument + placeTemplateFields (int test)
- RED: upload a PDF → storage_key/page_count set; placeTemplateFields validates roleId belongs to template (422 otherwise) and page bounds; lists fields.
- GREEN (reuse pdf-lib validation + getStorage). Commit.

### Task 4: instantiateTemplate (int test)
- RED: with a template (doc + 1 role + 1 signature field), POST envelopes mapping the role to {name,email} → a draft envelope with 1 signer, 1 document (bytes copied from the template), 1 field bound to that signer; sending + signing it completes (reuse existing flow). Missing-role mapping → 422.
- GREEN: copy R2 bytes to envelope key; create envelope+doc+signers+fields in a tx. Commit.

### Task 5: Routes + SDK + verify live
- Wire `/v1/templates` routes + schemas; add SDK methods. Build + tests green. Deploy; live: create template → upload → fields → instantiate → send → drawn/typed sign → completed. (verification-before-completion)

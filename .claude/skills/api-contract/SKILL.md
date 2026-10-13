---
name: api-contract
description: Design, change, or review the API contract for an intermediary service (frame-bridge and later ones) that feeds the dashboard. Use when adding or changing an endpoint, field, or event, when writing docs/api/*.openapi.yaml, or when a plan doc and the dashboard disagree on a shape.
---

# API contract

This repo owns the contracts. The services live in their own repos and implement them.

## Files

- `docs/api/<service>.openapi.yaml`: OpenAPI 3.1, the source of truth.
- `docs/<service>.md` (for frame-bridge: `docs/apple-integration.md`): the reasoning, decisions,
  open questions and setup. It links to the spec. It does not repeat the schemas.

## Steps

1. **Read what the dashboard consumes.** For every field you add or change, find the reads:
   ```sh
   grep -n "e\.loc\|\.travel\|\.notes" dashboard/js/app.js dashboard/js/views/*.js   # example
   ```
   The mock objects in `dashboard/js/data.js` show the current shapes. The views are the
   authority: if a mock has a field no view reads, it doesn't belong in the contract.
2. **Map source → dashboard names in the prose doc**, not in the spec. For example, EventKit
   `location` → `loc`, `notes` → `notes`, Hue `dimming.brightness` → `level`.
3. **Edit the spec.** Conventions:
   - `components/schemas` holds one schema per dashboard object (`Event`, `ShoppingItem`, `Light`,
     `Room`). Endpoints `$ref` them.
   - Times: `type: string, format: date-time`, always with an offset. Say this in the description.
   - IDs: opaque strings. Document which source identifiers they come from, and how recurring
     occurrences get unique IDs.
   - Optional fields are left out of `required` and omitted from responses, never `null`.
   - Every operation has an `operationId`, a 2xx response with an `example`, and an `Error`
     response (`{ "error": string, "detail"?: string }`).
   - Read-only feeds have no write operations at all.
   - SSE (`/api/events`): `text/event-stream`. List each event name and its `data` schema in the
     description and in `components/schemas`.
   - `GET /healthz` reports per-feed `status`, `updatedAt` and `staleAfterSeconds`.
   - Security: describe the Cloudflare Access service-token headers as a `securityScheme`. Never put
     real tokens, hosts or keys in examples.
4. **Version.** A non-breaking addition bumps the minor version of `info.version`. Removing,
   renaming or retyping a field is breaking: bump the major version, and add a "Breaking changes"
   entry in the prose doc listing what the service repo must change.
5. **Lint**, and fix everything it reports:
   ```sh
   npx @redocly/cli lint docs/api/<service>.openapi.yaml
   ```
   Optional preview: `npx @redocly/cli build-docs docs/api/<service>.openapi.yaml -o /tmp/<service>.html`.
6. **Update the prose doc**: link to the spec, record the decision, close or add open questions.
7. **Report**: summarize what changed per endpoint, and whether the service repo or the dashboard
   (`wire-feed` skill) needs follow-up work.

## Checks before done

- [ ] Every field in a response schema is read by some view, or is explicitly marked as for a
      planned feature in the prose doc.
- [ ] No field name comes from the source system when the dashboard uses a different one.
- [ ] Redocly lint passes with no errors.
- [ ] No secrets, real hostnames, or personal identifiers in examples.

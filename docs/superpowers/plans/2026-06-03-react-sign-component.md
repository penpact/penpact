# React `<Sign/>` Component Implementation Plan

> REQUIRED SUB-SKILL: superpowers:test-driven-development. Checkbox steps.

**Goal:** Ship `@penpact/signing-ui` exporting a native React `<Sign/>` that renders the signing experience inside the host app (not a Penpact-branded iframe), driving the existing `/v1/sign/:token` API.

**Architecture:** A pure, dependency-injected controller (`controller.ts`) holds all logic — load/classify session, build field values from the typed name, post consent/complete/decline — and is unit-tested in node. `Sign.tsx` is a thin React view that calls the controller and renders consent + typed-signature steps (the PDF itself is shown via the browser's native PDF viewer in an `<iframe>` to the document endpoint). The host styles around it.

**Tech Stack:** React 18+ (peer dep), TypeScript (jsx: react-jsx), Vitest for the controller, a live browser demo for the component.

---

## File structure
- `packages/signing-ui/package.json` — react peerDep, build `tsc -b`.
- `packages/signing-ui/tsconfig.json` — jsx react-jsx, lib ES2023+DOM.
- `packages/signing-ui/src/controller.ts` — pure logic (TDD).
- `packages/signing-ui/src/Sign.tsx` — thin React view.
- `packages/signing-ui/src/index.ts` — exports.
- `tests/signing-ui/controller.test.ts` — controller unit tests.

## Task 1: initialsOf + buildFieldValues (pure)
- [ ] RED: `initialsOf('Ada Lovelace')==='AL'`; `buildFieldValues` maps signature/name→fullName, initials→initials, date/text/email→provided value, skips empty optional, errors on missing required.
- [ ] GREEN minimal. Commit.

## Task 2: loadSession classifies responses (injected fetch)
- [ ] RED: 200→{kind:'ok',session}; 410→{kind:'gone'}; 404→{kind:'notfound'}; network throw→{kind:'error'}.
- [ ] GREEN. Commit.

## Task 3: postConsent / postComplete / postDecline (injected fetch)
- [ ] RED: each posts to the right path with JSON body; 2xx→ok, else→error.
- [ ] GREEN. Commit.

## Task 4: Sign.tsx view + index exports
- [ ] Build the component using the controller (loading→consent→sign→done/declined; onComplete/onDecline/onError callbacks). `tsc -b` clean. Commit.

## Task 5: Live browser verification
- [ ] Build dist, render `<Sign token apiBase>` against a real sent envelope in Chrome via an importmap demo; click consent→sign→observe onComplete + envelope completed in DB. (verification-before-completion)

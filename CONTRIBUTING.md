# Contributing to Penpact

Thanks for your interest! Penpact is in early development, so the most useful contributions right
now are **issues**: bug reports, use-case feedback, and integration pain points.

## Development setup

Requirements: Node ≥ 22 and [pnpm](https://pnpm.io).

```bash
pnpm install
pnpm check        # Biome lint + format
pnpm typecheck    # TypeScript (project references)
pnpm test         # Vitest
```

## Before opening a pull request

- Keep changes focused; one logical change per PR.
- Run `pnpm check:fix`, `pnpm typecheck`, and `pnpm test` — all green.
- Add or update tests for behavior changes.
- Use clear, imperative commit messages (`Add envelope create route`, not `added route`).

## Licensing of contributions

Penpact is licensed under **AGPL-3.0-only**. By contributing, you agree your contributions are
licensed under the same terms.

## Code of conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). Be kind.

# Working in this repo

2me2u reads and writes Allen & Heath ME-1 (`.ME1`) and ME-U (`.meu`) files
through one model of a monitoring system (`@mcmillan/2me2u-core`), and offers a
browser editor on top of it (`@mcmillan/2me2u-web`). The root `README.md` introduces the
repo and each package's own `README.md` documents its API; this file is for
anyone (human or agent) changing the code.

## Commands

Node 26 (`.nvmrc`) and pnpm. Run `pnpm check` (lint, typecheck, test) before
calling anything done, and `pnpm lint:fix` to let Biome format. A Husky
pre-commit hook runs Biome on staged files and fixes what it can, so a commit
never lands unformatted; don't bypass it with `--no-verify`.

## Keep the docs true

Documentation is part of a change, not a follow-up. When you change behaviour,
update the docs in the same change, and check them even when you think the
change is internal:

- **`packages/core/README.md`** describes the public API, the data model, the
  checked rules, the file formats and the source layout. If you add, rename or
  remove anything exported from `packages/core/src/index.ts`, change a type's
  fields, change a default, add or relax a validation rule, or move a file, that
  README must say so. Its code samples must run as written against the current
  API. The root `README.md` only lists the packages and how to develop; update
  it when a package is added or the toolchain changes.
- **`packages/core/src/formats/me1/schema.ts`** carries the binary format
  description in its header comment. It is the only write-up of the format, so
  anything new about the layout (a flag, a settings field, a range) goes there,
  and the core README's "not modelled" list is trimmed to match.
- **Doc comments** on the exported functions and types are what editors show
  users. Keep them accurate and short.
- The core README's "not modelled" list and the `unknown` key type mark the
  edges of the model. Don't present a guess as a fact anywhere.

A quick check before finishing: read `index.ts` and the core README side by side and
make sure every export is described and nothing described is gone.

## Design constraints

- **One model, two formats.** The `.meu` and `.ME1` both serialise the same
  `System`. Don't add format-specific fields to the model; put them in
  `source`, which carries what the model doesn't cover.
- **Byte-exact rewrites.** Encoding writes the model over the records a file
  was read from and touches only what the model covers. Every fixture must
  re-encode identically; the tests enforce it. New knowledge about the format
  should widen the model, not break this.
- **Plain data, Results for failure.** The model is readonly plain objects
  with optional fields for defaults, no wrapper types. Fallible operations
  return a true-myth `Result` whose error is `Issue[]`, reporting every issue
  found, each with a property path. Don't throw.
- **1-based channels** in the model, as the hardware displays them. The
  conversion to the ME-1's 0-based bytes happens only in `formats/me1`.
- **Small public surface.** Only `index.ts` is public. Export from a module
  only what another module uses; users need only the parse and build functions
  and the model types.
- **Naming.** The public API is plain functions: `parse<Format>Config` and
  `build<Format>Config`, plus `parseConfig` for both files. The system type is
  `System`. The formats are spelled `ME1` and `MEU` in identifiers
  (`parseME1Config`, `ME1.decode`) and `ME-1` / `ME-U` in prose. Lowercase
  `me1` / `meu` are only object keys, issue paths and directory names.
- **No presets.** The ME-1's preset slots are not part of the model or the
  API. The `.ME1` schema still describes and carries their pages so files
  rewrite byte for byte; don't surface them above `formats/me1/schema.ts`.
- **No CLI** in the core package.

## The web package

- React 19 and Vite. Styling is Tamagui with the stock v6 config: use its
  house style, which means shorthand props only (`items`, `justify`, `p`, `bg`,
  `rounded`, …) and its flat token names (`gap="3"`, `color="color-10"`). Don't
  loosen the config to allow long-hand props.
- State is Jotai: one `systemAtom` holds the editable system, and exports and
  validation issues are derived atoms. Edits are pure functions in
  `lib/edit.ts`, applied through `editAtom`.
- Everything runs in the browser; nothing is uploaded.
- Use `Action` (`components/ui.tsx`) for every button and the colours in
  `lib/theme.ts` (`ACCENT`, `KEY_TYPE_THEME`), so a key type looks the same
  everywhere. The orange accent is generated in `tamagui.config.ts` from the
  stock yellow themes, including their `_level` variants; a new colour theme
  needs those variants too, or nested buttons fall back to grey.
- Tamagui 3 has no `hoverStyle`/`pressStyle`: use conditional values
  (`bg={{ default: 'color-2', hover: 'color-3' }}`). Breakpoints go in values
  the same way.
- Typed edits pass a merge key to `editAtom` (the field's issue path, e.g.
  `keys[3].name`) so they undo in one step. Editable controls carry
  `data-issue-path` with the core's issue path, so the Problems list can focus
  them.
- Exports must stay byte-exact for unedited values: controls such as the fader
  only report a change when the user actually changed something.
- `pnpm-workspace.yaml` hoists `@tamagui/*`, because the Tamagui compiler
  evaluates `tamagui` from the project root and its sibling packages must
  resolve from there. Keep it when changing pnpm settings.
- `packages/web/README.md` describes what the editor does; keep it in step with
  the UI the same way the core README tracks the API.

## Tests

Fixtures in `packages/core/test/fixtures` are real files; don't edit them. Add
a fixture when you get a file showing something new (an Aux Input key, a
non-centre pan, a decoded settings field) and add an assertion for what it shows. Snapshot
tests cover the decoded keys; update snapshots only when the model's shape
changes on purpose.

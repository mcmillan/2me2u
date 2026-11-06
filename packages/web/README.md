# @mcmillan/2me2u-web

A browser editor for ME-1 configs (`.ME1`) and ME-U channel setups (`.meu`),
built on [`@mcmillan/2me2u-core`](../core). Everything runs in the browser;
files never leave the machine.

Live at <https://mcmillan.github.io/2me2u/>, deployed by
`.github/workflows/pages.yml` on every push to `main`.

- **Load**: drop an `.ME1`, a `.meu`, or both onto the page (or click to
  choose). Files can arrive together or one after the other.
- **Edit**: channel names and stereo pairs; each of the 16 keys' type,
  channel or group members, label and level.
- **Create**: _New system_ starts from a blank system.
- **Export**: _Export .ME1_ saves the config under the config name;
  _Export .meu_ saves `ChannelSetup.meu`. Export is disabled while the system
  breaks an ME-1 rule, and the problems are listed with their paths.

Editing a loaded file changes only what you edit: the export is written over
the original, so everything the editor doesn't show is kept.

## Develop

```sh
pnpm dev        # from the repo root, or `pnpm --filter @mcmillan/2me2u-web dev`
pnpm build      # production build into packages/web/dist
BASE_PATH=/2me2u/ pnpm build   # as deployed to GitHub Pages
```

## Stack

React 19 and Vite, [Tamagui](https://tamagui.dev) for styling (v6 config,
shorthand props only), and [Jotai](https://jotai.org) for state.

```
src
├── main.tsx             Tamagui provider, follows the system colour scheme
├── App.tsx              toolbar, status and layout
├── components/          DropZone, Channels, KeyEditor, LevelInput, Issues, Panel
└── lib
    ├── store.ts         Jotai atoms: the system, loaded files, derived exports
    ├── edit.ts          pure edits on a system
    └── files.ts         reading dropped files, downloading exports
```

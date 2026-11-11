# @mcmillan/2me2u-web

A browser editor for ME-1 configs (`.ME1`) and ME-U channel setups (`.meu`),
built on [`@mcmillan/2me2u-core`](../core). Everything runs in the browser;
files never leave the machine.

Live at <https://mcmillan.github.io/2me2u/>, deployed by
`.github/workflows/pages.yml` on every push to `main`.

- **Start**: the first screen offers two paths: open your files (drop an
  `.ME1`, a `.meu`, or both anywhere in the window, or click to choose) or
  start from scratch. If you were editing before, it offers to pick up where
  you left off.
- **Keys**: the 16 keys laid out like the ME-1's, two rows of eight, each
  showing its label, type, what it plays and its level. Select one (click or
  arrow keys, which follow the layout on screen) to edit it below: its type, channel or group members, label and
  levels, with a fader for each level.
- **Channels**: the 40 channel names, laid out by stereo pair, with a link
  toggle per pair and chips showing which keys use each channel.
- **Problems**: anything the ME-1 would reject is explained in plain English
  under the field (once you leave it, and announced to screen readers),
  counted in the top bar, and one click away.
- **Export**: the Export menu saves `{CONFIG}.ME1` (for the ME1CFG folder on
  the ME-1's USB stick) and `ChannelSetup.meu` (for the ME-U), and says why
  when it can't.
- **Safety**: undo and redo (⌘Z / ⇧⌘Z), an unsaved-changes marker, a
  confirmation before New or a drop replaces unsaved work, and autosave in the
  browser, so a reload or closed tab doesn't lose work. Notifications about
  errors stay until dismissed.

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
├── App.tsx              welcome screen or editor; Keys and Channels views
├── components/
│   ├── TopBar.tsx       config name, view switch, undo/redo, problems, export
│   ├── KeyGrid.tsx      the 16 keys in the ME-1's 2×8 layout
│   ├── KeyDetail.tsx    editor for the selected key
│   ├── Fader.tsx        level fader (a native range input on the fader law)
│   ├── MemberPicker.tsx a group's channels
│   ├── ChannelList.tsx  channel names by stereo pair
│   ├── Welcome.tsx, WindowDrop.tsx, ExportMenu.tsx, RestorePrompt.tsx
│   ├── FieldError.tsx, ProblemsButton.tsx, Toasts.tsx
│   ├── Menu.tsx         popover menu shared by Export and Problems
│   ├── ConfirmDialog.tsx modal confirmation (native <dialog>)
│   └── ui.tsx           Action, the shared button
└── lib
    ├── store.ts         Jotai atoms: the system, history, selection, toasts
    ├── edit.ts          pure edits on a system
    ├── files.ts         reading dropped files, downloading exports
    ├── messages.ts      plain-English problems
    ├── session.ts       autosave and restore
    ├── shortcuts.ts     undo/redo keys
    └── theme.ts         accent and key-type colours
```

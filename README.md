# 2me2u

Read, build and write the files behind an Allen & Heath ME personal monitoring
system: ME-1 configs (`.ME1`) and ME-U channel setups (`.meu`).

The ME-1 is a 40-channel personal mixer; the ME-U is the hub that feeds up to
ten of them. This library reads and writes both files, and writes every file it
has read back byte for byte. The [ME-1 Getting Started Guide][guide] describes
the mixer itself.

[guide]: https://support.allen-heath.com/hc/en-gb/articles/40901208174481-ME-1-Getting-Started-Guide

## Packages

| Package                  | What it is                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------- |
| [`2me2u`](packages/core) | The library: one model of a monitoring system, read from and written to both formats. |

Each package's README covers its API. `AGENTS.md` is for anyone changing the code.

## Develop

Requires Node 26 and pnpm (`corepack enable` picks up the pinned version).

```sh
pnpm install
pnpm check      # lint, typecheck, test
pnpm build
```

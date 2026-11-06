/**
 * The operations on a system: parse it from files, and build files from a
 * draft of it. `.meu` files carry the channels; `.ME1` files carry the keys
 * and also record which channels they treat as stereo pairs.
 */

import { ME1, type ME1Document } from './formats/me1/index.ts';
import type { ConfigFile } from './formats/me1/schema.ts';
import { MEU, type MEUDocument, type MEUFile } from './formats/meu/index.ts';
import { combine, issueUnless, unlessIssues, type Validated } from './issues.ts';
import { CHANNEL_COUNT, type Channel, isStereo, KEY_COUNT, type Key, pairStart } from './model.ts';
import { validate } from './validate.ts';

/** The files a system was read from. Opaque: it carries what the model doesn't cover so a rewrite keeps it. */
export interface Source {
  readonly me1?: ConfigFile;
  readonly meu?: MEUFile;
}

/** A complete system: 40 channels and 16 keys. */
export interface System {
  readonly channels: readonly Channel[];
  readonly keys: readonly Key[];
  readonly source?: Source;
}

/**
 * A system with some parts left to defaults: missing channels are unnamed and
 * unlinked, missing keys unassigned.
 */
export interface SystemDraft {
  readonly channels?: readonly Channel[];
  readonly keys?: readonly Key[];
  readonly source?: Source;
}

// ---- defaults ------------------------------------------------------------

const padTo = <T>(items: readonly T[], count: number, fill: (i: number) => T): T[] =>
  Array.from({ length: Math.max(count, items.length) }, (_, i) => items[i] ?? fill(i));

const fillKeys = (keys: readonly Key[] = []): Key[] =>
  padTo(keys, KEY_COUNT, () => ({ type: 'unassigned' }));

/** Complete a draft with defaults. Lists longer than the ME-1 allows are left for validation to report. */
export const fill = (draft: SystemDraft): System => {
  const given = draft.channels ?? [];
  const channels = padTo(given, CHANNEL_COUNT, (): Channel => ({})).map((c, i) => {
    const start = pairStart(i + 1);
    const stereo = given[start - 1]?.stereo === true || given[start]?.stereo === true;
    return stereo ? { ...c, stereo: true } : c;
  });
  return {
    channels,
    keys: fillKeys(draft.keys),
    ...(draft.source ? { source: draft.source } : {}),
  };
};

// ---- parse ---------------------------------------------------------------

/** Channels with no names, stereo wherever the config says so. */
const channelsFromLinks = (me1: ME1Document | undefined): Channel[] => {
  const starts = new Set(
    (me1?.links ?? []).filter((l) => l.linked).map((l) => pairStart(l.channel)),
  );
  return Array.from(
    { length: CHANNEL_COUNT },
    (_, i): Channel => (starts.has(pairStart(i + 1)) ? { stereo: true } : {}),
  );
};

const assemble = (
  me1: ME1Document | undefined,
  meu: MEUDocument | undefined,
): Validated<System> => {
  const channels = meu?.channels ?? channelsFromLinks(me1);
  return unlessIssues([
    ...issueUnless(
      channels.length === CHANNEL_COUNT,
      'meu.Channels',
      `must have ${CHANNEL_COUNT} channels, got ${channels.length}`,
    ),
    ...(me1?.links ?? []).flatMap((l) =>
      issueUnless(
        isStereo(channels, l.channel) === l.linked,
        l.path,
        `the config has channel ${l.channel} ${l.linked ? 'stereo' : 'mono'}, but the setup has it ${l.linked ? 'mono' : 'stereo'}`,
      ),
    ),
  ]).map(() =>
    fill({
      channels,
      ...(me1 ? { keys: me1.keys } : {}),
      source: { ...(me1 ? { me1: me1.file } : {}), ...(meu ? { meu: meu.file } : {}) },
    }),
  );
};

/** An ME-1 config and the ME-U setup it was built on. */
export interface ConfigFiles {
  /** A 72 KB `.ME1` file. */
  readonly me1: Uint8Array | ArrayBuffer;
  /** A `.meu` file (JSON). */
  readonly meu: string | Uint8Array;
}

/**
 * Parse a 72 KB ME-1 config on its own. The channels are unnamed, but stereo
 * pairs are known from the config.
 */
export const parseME1Config = (me1: Uint8Array | ArrayBuffer): Validated<System> =>
  ME1.decode(me1).andThen((doc) => assemble(doc, undefined));

/** Parse an ME-U channel setup on its own. The keys are unassigned. */
export const parseMEUConfig = (meu: string | Uint8Array): Validated<System> =>
  MEU.decode(meu).andThen((doc) => assemble(undefined, doc));

/**
 * Parse an ME-1 config together with the ME-U setup it was built on. Fails if
 * either can't be read, or if they disagree about which channels are stereo.
 */
export const parseConfig = (files: ConfigFiles): Validated<System> =>
  combine([ME1.decode(files.me1), MEU.decode(files.meu)]).andThen(([me1, meu]) =>
    assemble(me1, meu),
  );

// ---- build ---------------------------------------------------------------

/** Complete a draft with defaults and check it against the ME-1's rules. */
const complete = (draft: SystemDraft): Validated<System> => validate(fill(draft));

/**
 * Build a 72 KB ME-1 config. Missing parts get the ME-1's defaults; a system
 * parsed from a config keeps everything the model doesn't cover.
 */
export const buildME1Config = (draft: SystemDraft = {}): Validated<Uint8Array> =>
  complete(draft).andThen(ME1.encode);

/** Build an ME-U channel setup from a system's channels. */
export const buildMEUConfig = (draft: SystemDraft = {}): Validated<string> =>
  complete(draft).map((s) => MEU.encode(s.channels, s.source?.meu));

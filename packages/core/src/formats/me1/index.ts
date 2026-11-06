/**
 * The `.ME1` format: meaning for the records in `schema.ts`. Decoding turns them
 * into the model; encoding writes the model back over the records a file was
 * read from (or blank ones), replacing only what the model covers, so unknown
 * bits, unknown blocks and stale bytes are kept.
 */

import Result from 'true-myth/result';
import { check, collect, combine, invalid, type Validated } from '../../issues.ts';
import {
  type Channel,
  isStereo,
  KEY_COUNT,
  type Key,
  type Level,
  type Member,
  pairStart,
} from '../../model.ts';
import type { System } from '../../system.ts';
import { KEY_NAME_PATTERN } from '../../validate.ts';
import {
  ConfigFile,
  type KeyRecord,
  KeyRecord as KeyRecords,
  LEVEL_NOMINAL,
  LEVEL_OFF,
  NAME_SIZE,
  NO_SOURCE,
  type SendRecord,
  type StatePage,
} from './schema.ts';

const KEY_STEREO = 0x01;
const KEY_CUSTOM_NAME = 0x10;
const KEY_GROUP = 0x20;
const KEY_AUTO = 0x40;
const KEY_KNOWN = KEY_STEREO | KEY_CUSTOM_NAME | KEY_GROUP | KEY_AUTO;

const SEND_LINKED = 0x01;
const SEND_FIRST = 0x02;
const SEND_MEMBER = 0x04;
const SEND_KNOWN = SEND_LINKED | SEND_FIRST | SEND_MEMBER;

/** Something a file says about a channel's stereo link, and where it says it. */
export interface Link {
  readonly channel: number;
  readonly linked: boolean;
  readonly path: string;
}

/** What a config holds. */
export interface ME1Document {
  readonly keys: readonly Key[];
  readonly links: readonly Link[];
  readonly file: ConfigFile;
}

// ---- levels and names ----------------------------------------------------

const levelFromRaw = (raw: number): Level =>
  raw === LEVEL_OFF ? 'off' : (raw - LEVEL_NOMINAL) / 256;

const rawFromLevel = (level: Level = 0): number =>
  level === 'off' ? LEVEL_OFF : Math.round(level * 256) + LEVEL_NOMINAL;

const textOf = (raw: Uint8Array): string | undefined => {
  if (raw[0] === 0) return undefined;
  const end = raw.indexOf(0);
  return new TextDecoder('latin1').decode(end === -1 ? raw : raw.subarray(0, end)).trimEnd();
};

const ascii = (s: string): Uint8Array =>
  Uint8Array.from({ length: NAME_SIZE }, (_, i) => s.charCodeAt(i) || 0);

/** Name bytes for `text`: the base bytes if they already say it, else a fresh encoding. */
const nameBytes =
  (pattern: RegExp, rule: string, pad: (t: string) => string) =>
  (text: string | undefined, base: Uint8Array, path: string): Validated<Uint8Array> =>
    textOf(base) === text
      ? Result.ok(base)
      : text === undefined
        ? Result.ok(new Uint8Array(NAME_SIZE))
        : pattern.test(text)
          ? Result.ok(ascii(pad(text)))
          : invalid(path, `invalid name ${JSON.stringify(text)}: ${rule}`);

/** Key names are stored space-padded to 7 characters, then NUL. */
const keyName = nameBytes(KEY_NAME_PATTERN, 'use 1–6 of 0-9, A-Z, a-z, space', (t) =>
  t.padEnd(NAME_SIZE - 1, ' '),
);

const named = (name: string | undefined) => (name === undefined ? {} : { name });

// ---- decode --------------------------------------------------------------

const keyFromRecord = (r: KeyRecord, path: string): [Key, Link[]] => {
  const name = textOf(r.name);
  const level = levelFromRaw(r.level);

  if (r.source !== NO_SOURCE) {
    const channel = r.source + 1;
    const linked = (r.flags & KEY_STEREO) !== 0;
    return [
      { type: 'channel', channel, ...named(name), level, pan: r.pan },
      (linked ? [channel, channel + 1] : [channel]).map((ch) => ({ channel: ch, linked, path })),
    ];
  }
  if (r.flags & KEY_GROUP) {
    const memberSends = r.sends
      .map((send, i) => ({ send, channel: i + 1 }))
      .filter(({ send }) => send.flags & SEND_MEMBER);
    const isPairSecond = (s: SendRecord) => s.flags & SEND_LINKED && !(s.flags & SEND_FIRST);
    return [
      {
        type: 'group',
        ...named(name),
        level,
        members: memberSends
          .filter(({ send }) => !isPairSecond(send))
          .map(({ send, channel }) => ({
            channel,
            level: levelFromRaw(send.level),
            pan: send.pan,
          })),
      },
      memberSends.map(({ send, channel }) => ({
        channel,
        linked: (send.flags & SEND_LINKED) !== 0,
        path: `${path}.members`,
      })),
    ];
  }
  if (r.flags & KEY_AUTO) return [{ type: 'auto', level }, []];
  if (r.flags === 0) return [{ type: 'unassigned' }, []];
  return [
    { type: 'unknown', flags: r.flags, source: r.source, ...named(name), level, pan: r.pan },
    [],
  ];
};

const keysFromPage = (page: StatePage, path: string): { keys: Key[]; links: Link[] } => {
  const decoded = page.keys.map((r, i) => keyFromRecord(r, `${path}[${i}]`));
  return { keys: decoded.map(([key]) => key), links: decoded.flatMap(([, links]) => links) };
};

const documentFrom = (file: ConfigFile): ME1Document => ({
  ...keysFromPage(file.state, 'me1.keys'),
  file,
});

// ---- encode --------------------------------------------------------------

const sendsFor = (
  base: readonly SendRecord[],
  members: readonly Member[],
  channels: readonly Channel[],
): SendRecord[] => {
  const byChannel = new Map(members.map((m) => [m.channel, m]));
  return base.map((send, i) => {
    const ch = i + 1;
    const stereo = isStereo(channels, ch);
    const start = stereo ? pairStart(ch) : ch;
    const member = byChannel.get(start);
    const kept = send.flags & ~SEND_KNOWN;
    if (member === undefined) return { ...send, flags: kept };
    const link = stereo ? SEND_LINKED | (ch === start ? SEND_FIRST : 0) : 0;
    return {
      flags: kept | SEND_MEMBER | link,
      level: rawFromLevel(member.level),
      pan: member.pan ?? send.pan,
    };
  });
};

const recordFromKey = (
  key: Key,
  base: KeyRecord,
  channels: readonly Channel[],
  path: string,
): Validated<KeyRecord> => {
  const kept = base.flags & ~KEY_KNOWN;
  const plain = { ...base, sends: sendsFor(base.sends, [], channels) };
  const customName = (name: string | undefined) => (name === undefined ? 0 : KEY_CUSTOM_NAME);

  switch (key.type) {
    case 'unassigned':
      return keyName(undefined, base.name, `${path}.name`).map((name) => ({
        ...plain,
        flags: kept,
        source: NO_SOURCE,
        name,
      }));
    case 'auto':
      return keyName(undefined, base.name, `${path}.name`).map((name) => ({
        ...plain,
        flags: kept | KEY_AUTO,
        source: NO_SOURCE,
        level: rawFromLevel(key.level),
        name,
      }));
    case 'channel':
      return keyName(key.name, base.name, `${path}.name`).map((name) => ({
        ...plain,
        flags: kept | (isStereo(channels, key.channel) ? KEY_STEREO : 0) | customName(key.name),
        source: key.channel - 1,
        level: rawFromLevel(key.level),
        pan: key.pan ?? base.pan,
        name,
      }));
    case 'group':
      return keyName(key.name, base.name, `${path}.name`).map((name) => ({
        ...base,
        flags: kept | KEY_GROUP | customName(key.name),
        source: NO_SOURCE,
        sends: sendsFor(base.sends, key.members, channels),
        level: rawFromLevel(key.level),
        name,
      }));
    case 'unknown':
      return keyName(key.name, base.name, `${path}.name`).map((name) => ({
        ...base,
        flags: key.flags,
        source: key.source,
        level: rawFromLevel(key.level),
        pan: key.pan ?? base.pan,
        name,
      }));
  }
};

const pageFromKeys = (
  keys: readonly Key[],
  base: StatePage,
  channels: readonly Channel[],
  path: string,
): Validated<StatePage> =>
  combine([
    check(keys.length === KEY_COUNT, path, `must have ${KEY_COUNT} keys, got ${keys.length}`),
    collect(
      keys.map((key, i) =>
        recordFromKey(key, base.keys[i] ?? KeyRecords.blank, channels, `${path}[${i}]`),
      ),
    ),
  ]).map(([, records]) => ({ ...base, keys: records }));

/** A config holding `system`'s keys, written over `base`. Preset pages pass through untouched. */
const configFrom = (system: System, base: ConfigFile): Validated<ConfigFile> =>
  pageFromKeys(system.keys, base.state, system.channels, 'keys').map((state) => ({
    ...base,
    state,
  }));

export const ME1 = {
  /** Decode a 72 KB config. */
  decode: (data: Uint8Array | ArrayBuffer): Validated<ME1Document> =>
    ConfigFile.decode(data)
      .mapErr((e) => [
        { path: 'me1', reason: `a config is ${e.expected[0]} bytes, got ${e.actual}` },
      ])
      .map(documentFrom),

  /** Encode a complete system's mix as a config, over the config it was read from (if any). */
  encode: (system: System): Validated<Uint8Array> =>
    configFrom(system, system.source?.me1 ?? ConfigFile.blank()).andThen(ConfigFile.encode),
};

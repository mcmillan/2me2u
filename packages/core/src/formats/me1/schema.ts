/**
 * The `.ME1` binary schema: an exact, uninterpreted mapping between bytes and
 * plain records. Meaning is assigned in `mapping.ts`.
 *
 * The layout follows the files in `test/fixtures` and the ME-1 Getting Started
 * Guide. Two kinds of file share the extension
 * and are told apart by size ("Preset = 4KB, Config = 72KB"):
 *
 *   Config (18 × 4 KiB flash pages), saved to `ME1CFG/` on USB:
 *     Page 0      state page (below)
 *     Page 1      preset table: 16 × 10-byte entries, then zeros
 *     Pages 2–17  preset snapshots, one state page each (all 0xff = blank)
 *   Preset (one 4 KiB page), saved to `ME1PST/` on USB: a state page.
 *
 * The config name isn't stored in the file: it *is* the 8.3 file name.
 *
 * State page (multi-byte values big-endian):
 *   0x0000  7-byte header (constant: 1d 1c 02 00 00 0c da)
 *   0x0007  16 × 205-byte key records
 *   0x0cd7  1 unknown byte (0 or 1)
 *   0x0cd8  unknown block, presumably global settings (master EQ, limiter, mic
 *           mute, key preset modes …); not modelled
 *
 * Key record (205 bytes):
 *   +0    flags     bit0 stereo pair, bit4 custom name, bit5 group, bit6 Auto Mode
 *   +1    source    0-based channel for a single-channel key, 0xff otherwise
 *   +2    48 × send [flags, level (int16), pan]; flags: bit2 group member,
 *                   bit0 stereo linked, bit1 first (odd) channel of the pair
 *   +194  level     int16
 *   +196  pan
 *   +197  name      8 bytes ASCII; first byte 0 = default name (rest is stale)
 *
 * Preset table entry (10 bytes): [flag, name × 8, status]. The flag is 1 on
 * preset 1 and 0 elsewhere, and the status is 2, in every (blank) sample.
 */

import Maybe from 'true-myth/maybe';
import type Result from 'true-myth/result';
import {
  at,
  encodeAll,
  exactly,
  type FileCodec,
  fill,
  type InvalidSize,
  i16,
  join,
  type RecordCodec,
  records,
  sized,
  u8,
  viewOf,
} from '../../codec.ts';
import { KEY_COUNT, PAN_CENTRE } from '../../model.ts';

/** Preset slots in a config. Presets aren't modelled; their pages are carried through untouched. */
const PRESET_COUNT = 16;

const PAGE_SIZE = 0x1000;
export const CONFIG_SIZE = 18 * PAGE_SIZE;
/** Send slots per key. Only the first 40 have been seen in use. */
const SEND_COUNT = 48;
export const NAME_SIZE = 8;
/** Byte value of erased flash. */
const ERASED = 0xff;
export const NO_SOURCE = 0xff;
/** Raw level meaning fully off (0x8001 as int16). */
export const LEVEL_OFF = -0x7fff;
/**
 * Raw level at the `0` marker on the level bar (0xf600). Levels are int16 in
 * what appear to be 1/256 dB steps: new groups default to this value, no level
 * goes above raw 0, and the guide gives +10 dB of headroom above the marker.
 */
export const LEVEL_NOMINAL = -2560;

const HEADER_SIZE = 7;
const KEYS_OFFSET = HEADER_SIZE;
const KEY_SIZE = 205;
const KEYS_END = KEYS_OFFSET + KEY_COUNT * KEY_SIZE;
const SETTINGS_SIZE = PAGE_SIZE - KEYS_END - 1;
const ENTRY_SIZE = 10;
const TABLE_TAIL_SIZE = PAGE_SIZE - PRESET_COUNT * ENTRY_SIZE;

const ascii = (s: string, size: number): Uint8Array =>
  Uint8Array.from({ length: size }, (_, i) => s.charCodeAt(i) || 0);

const hex = (s: string, size: number): Uint8Array =>
  Uint8Array.from({ length: size }, (_, i) =>
    i * 2 < s.length ? Number.parseInt(s.slice(i * 2, i * 2 + 2), 16) : 0,
  );

export interface SendRecord {
  readonly flags: number;
  readonly level: number;
  readonly pan: number;
}

export const SendRecord = {
  size: 4,
  decode: (b: Uint8Array): SendRecord => {
    const v = viewOf(b);
    return { flags: v.getUint8(0), level: v.getInt16(1), pan: v.getUint8(3) };
  },
  encode: (s: SendRecord, path: string) =>
    join([u8(s.flags, `${path}.flags`), i16(s.level, `${path}.level`), u8(s.pan, `${path}.pan`)]),
  blank: { flags: 0, level: LEVEL_OFF, pan: PAN_CENTRE },
} satisfies RecordCodec<SendRecord> & { blank: SendRecord };

export interface KeyRecord {
  readonly flags: number;
  readonly source: number;
  readonly sends: readonly SendRecord[];
  readonly level: number;
  readonly pan: number;
  readonly name: Uint8Array;
}

const SENDS_OFFSET = 2;
const LEVEL_OFFSET = SENDS_OFFSET + SEND_COUNT * SendRecord.size;

export const KeyRecord = {
  size: KEY_SIZE,
  decode: (b: Uint8Array): KeyRecord => {
    const v = viewOf(b);
    return {
      flags: v.getUint8(0),
      source: v.getUint8(1),
      sends: records(SendRecord, b, SENDS_OFFSET, SEND_COUNT),
      level: v.getInt16(LEVEL_OFFSET),
      pan: v.getUint8(LEVEL_OFFSET + 2),
      name: at(b, LEVEL_OFFSET + 3, NAME_SIZE).slice(),
    };
  },
  encode: (k: KeyRecord, path: string) =>
    join([
      u8(k.flags, `${path}.flags`),
      u8(k.source, `${path}.source`),
      encodeAll(SendRecord, k.sends, SEND_COUNT, `${path}.sends`),
      i16(k.level, `${path}.level`),
      u8(k.pan, `${path}.pan`),
      exactly(k.name, NAME_SIZE, `${path}.name`),
    ]),
  blank: {
    flags: 0,
    source: NO_SOURCE,
    sends: Array.from({ length: SEND_COUNT }, () => SendRecord.blank),
    level: LEVEL_OFF,
    pan: PAN_CENTRE,
    name: new Uint8Array(NAME_SIZE),
  },
} satisfies RecordCodec<KeyRecord> & { blank: KeyRecord };

export interface StatePage {
  readonly header: Uint8Array;
  readonly keys: readonly KeyRecord[];
  readonly unknownByte: number;
  readonly settings: Uint8Array;
}

export const StatePage = {
  size: PAGE_SIZE,
  decode: (b: Uint8Array): StatePage => ({
    header: at(b, 0, HEADER_SIZE).slice(),
    keys: records(KeyRecord, b, KEYS_OFFSET, KEY_COUNT),
    unknownByte: viewOf(b).getUint8(KEYS_END),
    settings: at(b, KEYS_END + 1, SETTINGS_SIZE).slice(),
  }),
  encode: (p: StatePage, path: string) =>
    join([
      exactly(p.header, HEADER_SIZE, `${path}.header`),
      encodeAll(KeyRecord, p.keys, KEY_COUNT, `${path}.keys`),
      u8(p.unknownByte, `${path}.unknownByte`),
      exactly(p.settings, SETTINGS_SIZE, `${path}.settings`),
    ]),
  /** A page of blank keys, with the header and settings every config carries. */
  blank: {
    header: hex('1d1c0200000cda', HEADER_SIZE),
    keys: Array.from({ length: KEY_COUNT }, () => KeyRecord.blank),
    unknownByte: 0,
    settings: hex(
      '225538cf010000002d0100000000539600000200000000000099e9000002000200000000b92d0000020000000054df',
      SETTINGS_SIZE,
    ),
  },
} satisfies RecordCodec<StatePage> & { blank: StatePage };

export interface PresetEntry {
  readonly flag: number;
  readonly name: Uint8Array;
  readonly status: number;
}

export const PresetEntry = {
  size: ENTRY_SIZE,
  decode: (b: Uint8Array): PresetEntry => ({
    flag: viewOf(b).getUint8(0),
    name: at(b, 1, NAME_SIZE).slice(),
    status: viewOf(b).getUint8(1 + NAME_SIZE),
  }),
  encode: (e: PresetEntry, path: string) =>
    join([
      u8(e.flag, `${path}.flag`),
      exactly(e.name, NAME_SIZE, `${path}.name`),
      u8(e.status, `${path}.status`),
    ]),
  /** The entry every config carries: `PRESET<n>`, NUL-padded, status 2, flag set on the first. */
  blank: (index: number): PresetEntry => ({
    flag: index === 0 ? 1 : 0,
    name: ascii(`PRESET${index + 1}`, NAME_SIZE),
    status: 2,
  }),
} satisfies RecordCodec<PresetEntry> & { blank: (index: number) => PresetEntry };

export interface PresetSlotRecord {
  readonly entry: PresetEntry;
  /** The snapshot page; nothing if erased. */
  readonly page: Maybe<StatePage>;
}

export interface ConfigFile {
  readonly state: StatePage;
  readonly presets: readonly PresetSlotRecord[];
  /** The rest of the preset table page (zeros). */
  readonly tableTail: Uint8Array;
}

const page = (b: Uint8Array, n: number) => at(b, n * PAGE_SIZE, PAGE_SIZE);

const decodeConfig = (b: Uint8Array): ConfigFile => ({
  state: StatePage.decode(page(b, 0)),
  presets: records(PresetEntry, page(b, 1), 0, PRESET_COUNT).map((entry, i) => {
    const snapshot = page(b, 2 + i);
    return {
      entry,
      page: snapshot.every((x) => x === ERASED)
        ? Maybe.nothing<StatePage>()
        : Maybe.just(StatePage.decode(snapshot)),
    };
  }),
  tableTail: at(page(b, 1), PRESET_COUNT * ENTRY_SIZE, TABLE_TAIL_SIZE).slice(),
});

export const ConfigFile = {
  decode: (data: Uint8Array | ArrayBuffer): Result<ConfigFile, InvalidSize> =>
    sized(CONFIG_SIZE)(data).map(decodeConfig),
  encode: (c: ConfigFile) =>
    join([
      StatePage.encode(c.state, 'state'),
      encodeAll(
        PresetEntry,
        c.presets.map((p) => p.entry),
        PRESET_COUNT,
        'presets',
      ),
      exactly(c.tableTail, TABLE_TAIL_SIZE, 'tableTail'),
      ...c.presets.map((p, i) =>
        p.page.match({
          Just: (pg) => StatePage.encode(pg, `presets[${i}].page`),
          Nothing: () => fill(PAGE_SIZE, ERASED),
        }),
      ),
    ]),
  blank: (): ConfigFile => ({
    state: StatePage.blank,
    presets: Array.from({ length: PRESET_COUNT }, (_, i) => ({
      entry: PresetEntry.blank(i),
      page: Maybe.nothing<StatePage>(),
    })),
    tableTail: new Uint8Array(TABLE_TAIL_SIZE),
  }),
} satisfies FileCodec<ConfigFile, InvalidSize> & { blank: () => ConfigFile };

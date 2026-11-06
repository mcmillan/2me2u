import { unwrap, unwrapErr } from 'true-myth/test-support';
import { describe, expect, it } from 'vitest';
import {
  buildME1Config,
  buildMEUConfig,
  type Channel,
  type Key,
  parseConfig,
  parseME1Config,
  parseMEUConfig,
  type SystemDraft,
} from '../src/index.ts';
import { channelName } from '../src/model.ts';
import { fill } from '../src/system.ts';
import { validate } from '../src/validate.ts';
import { bytes, joseph, text } from './helpers.ts';

describe('reading JOSEPH from its .ME1 and .meu together', () => {
  const system = joseph();
  const name = (ch: number) => channelName(system.channels, ch);

  it('derives the same stereo pairs from the .ME1 alone as the .meu declares', () => {
    const stereo = (channels: readonly Channel[]) =>
      channels.flatMap((c, i) => (c.stereo ? [i + 1] : []));
    const fromME1 = unwrap(parseME1Config(bytes('JOSEPH.ME1')));
    const fromMEU = unwrap(parseMEUConfig(text('JOSEPH.meu')));
    expect(stereo(fromME1.channels)).toEqual([7, 8, 15, 16, 29, 30, 31, 32, 33, 34, 37, 38]);
    expect(stereo(fromME1.channels)).toEqual(stereo(fromMEU.channels));
    expect(stereo(system.channels)).toEqual(stereo(fromMEU.channels));
  });

  it('maps groups and channel keys onto the ME-U channel names', () => {
    const summary = system.keys.map((k) =>
      k.type === 'group'
        ? `${k.name}: ${k.members.map((m) => name(m.channel)).join(', ')}`
        : k.type === 'channel'
          ? `${k.name ?? name(k.channel)} (${k.channel})`
          : k.type,
    );
    expect(summary).toEqual([
      'Kit: Kick, Snare, FlTom, RkTom, HiHat, OH, KitPad',
      'Perc: XylGlk, Vibes, Crtles, SusCym, Congas, OrchBD, PrcPad, Toys',
      'Bass (18)',
      'Guit 1: Guit1E, Guit1A',
      'Guit 2 (21)',
      'Wind: Wind1, Wind2',
      'Horn (24)',
      'Strngs: Violn1, Violn2, Viola, Cello',
      'Keys 1 (29)',
      'Keys 2 (31)',
      'Piano (33)',
      'MD T/B (35)',
      'Track (37)',
      'Click (40)',
      'Vox: Sweets, Vox',
      'auto',
    ]);
  });

  it('writes both files back byte for byte', () => {
    expect(unwrap(buildME1Config(system))).toEqual(bytes('JOSEPH.ME1'));
    expect(unwrap(buildMEUConfig(system))).toBe(text('JOSEPH.meu'));
  });

  it('rejects files that disagree about stereo pairs', () => {
    const mono = text('JOSEPH.meu').replaceAll(
      '"UserStereoLink" : true',
      '"UserStereoLink" : false',
    );
    const issues = unwrapErr(parseConfig({ me1: bytes('JOSEPH.ME1'), meu: mono }));
    expect(issues[0]).toEqual({
      path: 'me1.keys[0].members',
      reason: 'the config has channel 7 stereo, but the setup has it mono',
    });
  });
});

/** What the build functions do before encoding. */
const create = (draft: SystemDraft = {}) => validate(fill(draft));

describe('building a system from scratch', () => {
  const draft: SystemDraft = {
    channels: [
      { name: 'Kick' },
      { name: 'Snare' },
      { name: 'KeysL', stereo: true },
      { name: 'KeysR' },
      { name: 'Vox' },
    ],
    keys: [
      {
        type: 'group',
        name: 'Drums',
        members: [{ channel: 1 }, { channel: 2, level: -3 }],
        level: 2,
      },
      { type: 'channel', channel: 3, name: 'Keys' },
      { type: 'channel', channel: 5, level: 'off' },
      { type: 'auto' },
    ],
  };

  it('fills in the defaults', () => {
    const system = unwrap(create(draft));
    expect(system.channels).toHaveLength(40);
    expect(system.channels[3]).toEqual({ name: 'KeysR', stereo: true }); // linked with KeysL
    expect(system.keys).toHaveLength(16);
    expect(system.keys[15]).toEqual({ type: 'unassigned' });
  });

  it('survives a trip through both files', () => {
    const system = unwrap(create(draft));
    const back = unwrap(
      parseConfig({ me1: unwrap(buildME1Config(system)), meu: unwrap(buildMEUConfig(system)) }),
    );
    expect(back.channels).toEqual(system.channels);
    const explicit = (k: Key): Key =>
      k.type === 'channel' || k.type === 'group' || k.type === 'auto'
        ? { ...k, level: k.level ?? 0, ...(k.type === 'channel' ? { pan: k.pan ?? 37 } : {}) }
        : k;
    expect(back.keys.slice(0, 4)).toEqual([
      {
        ...draft.keys?.[0],
        members: [
          { channel: 1, level: 0, pan: 37 },
          { channel: 2, level: -3, pan: 37 },
        ],
      },
      ...(draft.keys?.slice(1).map(explicit) ?? []),
    ]);
  });

  it('writes a 72 KB config with the defaults found in real files', () => {
    const encoded = unwrap(buildME1Config({}));
    expect(encoded).toHaveLength(bytes('CFA.ME1').length);
    expect(encoded.slice(0, 7)).toEqual(bytes('CFA.ME1').slice(0, 7));
    expect(encoded.slice(0xcd8, 0x1000)).toEqual(bytes('CFA.ME1').slice(0xcd8, 0x1000));
    expect(encoded.slice(0x1000, 0x2000)).toEqual(bytes('CFA.ME1').slice(0x1000, 0x2000));
  });

  it('writes stereo pairs as linked, whichever channel marks them', () => {
    const system = unwrap(
      create({
        channels: [{}, {}, {}, { stereo: true }],
        keys: [
          { type: 'group', name: 'Keys', members: [{ channel: 3 }] },
          { type: 'channel', channel: 3 },
        ],
      }),
    );
    const back = unwrap(parseME1Config(unwrap(buildME1Config(system))));
    expect(back.channels.slice(0, 4)).toEqual([{}, {}, { stereo: true }, { stereo: true }]);
  });

  it('reports every issue at once, by path', () => {
    const issues = unwrapErr(
      create({
        channels: [{ stereo: true }, { name: 'Far too long' }],
        keys: [
          { type: 'channel', channel: 99, level: 50 },
          { type: 'channel', channel: 2 },
          { type: 'group', name: 'Way too long', members: [{ channel: 5 }, { channel: 5 }] },
          { type: 'group', members: [{ channel: 5, pan: 300 }] },
        ],
      }),
    );
    expect(issues.map((i) => i.path)).toEqual([
      'channels[1].name',
      'keys[0].channel',
      'keys[0].level',
      'keys[1].channel',
      'keys[2].name',
      'keys[3].members[0].pan',
      'keys[2].members[1].channel',
      'keys[3].members[0].channel',
    ]);
  });

  it('rejects too many of anything', () => {
    const issues = unwrapErr(
      create({ keys: Array.from({ length: 17 }, () => ({ type: 'unassigned' })) }),
    );
    expect(issues).toEqual([{ path: 'keys', reason: 'must have 16 keys, got 17' }]);
  });
});

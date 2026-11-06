import { unwrap, unwrapErr } from 'true-myth/test-support';
import { describe, expect, it } from 'vitest';
import { buildME1Config, parseME1Config } from '../src/index.ts';
import { bytes, ME1_FIXTURES, systemFromME1 } from './helpers.ts';

describe('reading .ME1 configs', () => {
  it('rejects input of the wrong size, as data', () => {
    expect(unwrapErr(parseME1Config(new Uint8Array(100)))).toEqual([
      { path: 'me1', reason: 'a config is 73728 bytes, got 100' },
    ]);
  });

  it.each(ME1_FIXTURES)('%s: keys match their snapshot', (name) => {
    expect(systemFromME1(name).keys).toMatchSnapshot();
  });

  it('reads groups, with stereo pairs listed by their first channel', () => {
    const drums = systemFromME1('CFA.ME1').keys[0];
    expect(drums?.type === 'group' && drums.members.map((m) => m.channel)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 11,
    ]);
    const kit = systemFromME1('BEAUTIFL.ME1').keys[0];
    expect(kit).toMatchObject({ type: 'group', name: 'Kit', level: 0 });
  });

  it('reads channel keys, with a name only when it is custom', () => {
    const { keys } = systemFromME1('JOSEPH.ME1');
    expect(keys[2]).toEqual({ type: 'channel', channel: 18, level: -0.37890625, pan: 37 });
    expect(keys[4]).toMatchObject({ type: 'channel', channel: 21, name: 'Guit 2' });
    expect(keys[15]).toEqual({ type: 'auto', level: 0 });
  });

  it('marks stereo pairs on the channels when there is no setup file', () => {
    const { channels } = systemFromME1('JOSEPH.ME1');
    const stereo = channels.flatMap((c, i) => (c.stereo ? [i + 1] : []));
    expect(stereo).toEqual([7, 8, 15, 16, 29, 30, 31, 32, 33, 34, 37, 38]);
    expect(channels.every((c) => c.name === undefined)).toBe(true);
  });
});

describe('writing .ME1 configs', () => {
  it.each(ME1_FIXTURES)('%s: re-encodes byte for byte', (name) => {
    expect(unwrap(buildME1Config(systemFromME1(name)))).toEqual(bytes(name));
  });

  it('changes only what was edited', () => {
    const system = systemFromME1('JOSEPH.ME1');
    const kit = system.keys[0];
    if (kit?.type !== 'group') throw new Error('expected a group');
    const encoded = unwrap(
      buildME1Config({ ...system, keys: system.keys.with(0, { ...kit, name: 'Drums' }) }),
    );
    const original = bytes('JOSEPH.ME1');
    const changed = [...encoded.keys()].filter((i) => encoded[i] !== original[i]);
    // key 1's name field: "Kit    " → "Drums  "
    expect(changed).toEqual([0xcc, 0xcd, 0xce, 0xcf, 0xd0]);
  });

  it('reports invalid names as data, with a path', () => {
    const system = systemFromME1('CFA.ME1');
    const keys = system.keys.with(0, { type: 'group', name: 'Far too long', members: [] });
    expect(unwrapErr(buildME1Config({ ...system, keys }))).toEqual([
      expect.objectContaining({ path: 'keys[0].name' }),
    ]);
  });
});

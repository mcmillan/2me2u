import { unwrap, unwrapErr } from 'true-myth/test-support';
import { describe, expect, it } from 'vitest';
import { buildMEUConfig, parseMEUConfig } from '../src/index.ts';
import { channelName } from '../src/model.ts';
import { text } from './helpers.ts';

describe('.meu setups', () => {
  const system = unwrap(parseMEUConfig(text('JOSEPH.meu')));

  it('read 40 channels; a channel named by its number is unnamed', () => {
    expect(system.channels).toHaveLength(40);
    expect(system.channels[0]).toEqual({ name: 'Kick' });
    expect(system.channels[29]).toEqual({ stereo: true }); // stored as "30"
    expect(system.channels[6]).toEqual({ name: 'KitPad', stereo: true });
    expect(channelName(system.channels, 30)).toBe('30');
  });

  it('leave the keys unassigned', () => {
    expect(system.keys.every((k) => k.type === 'unassigned')).toBe(true);
  });

  it('re-encode byte for byte', () => {
    expect(unwrap(buildMEUConfig(system))).toBe(text('JOSEPH.meu'));
  });

  it('report bad input as data', () => {
    expect(unwrapErr(parseMEUConfig('nope'))).toEqual([expect.objectContaining({ path: 'meu' })]);
    expect(unwrapErr(parseMEUConfig('{}'))).toEqual([
      { path: 'meu.Channels', reason: 'missing "Channels" array' },
    ]);
    expect(
      unwrapErr(parseMEUConfig('{"Channels":[{"UserChannelName":1}]}')).map((i) => i.path),
    ).toEqual([
      'meu.Channels[0].UserChannelName',
      'meu.Channels[0].UserStereoLink',
      'meu.Channels[0].UseReceivedNameAndStereo',
    ]);
  });
});

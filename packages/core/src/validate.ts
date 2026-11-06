/** The ME-1's rules, checked on a complete system. Every issue is reported. */

import { type Issues, isByte, issue, issueUnless, unlessIssues, type Validated } from './issues.ts';
import {
  CHANNEL_COUNT,
  type Channel,
  isStereo,
  KEY_COUNT,
  type Key,
  LEVEL_MAX,
  LEVEL_MIN,
  type Level,
  pairStart,
} from './model.ts';
import type { System } from './system.ts';

/** Key and channel names: 1–6 of 0–9, A–Z, a–z and space. */
export const KEY_NAME_PATTERN = /^[0-9A-Za-z ]{1,6}$/;

const nameIssues = (name: string | undefined, pattern: RegExp, rule: string, at: string): Issues =>
  name === undefined ? [] : issueUnless(pattern.test(name), at, rule);

const levelIssues = (level: Level | undefined, at: string): Issues =>
  issueUnless(
    level === undefined ||
      level === 'off' ||
      (Number.isFinite(level) && level >= LEVEL_MIN && level <= LEVEL_MAX),
    at,
    `level must be 'off' or ${LEVEL_MIN.toFixed(2)}…${LEVEL_MAX} dB`,
  );

const panIssues = (pan: number | undefined, at: string): Issues =>
  issueUnless(pan === undefined || isByte(pan), at, 'pan must be 0–255');

const channelIssues = (channels: readonly Channel[], ch: number, at: string): Issues =>
  !(Number.isInteger(ch) && ch >= 1 && ch <= CHANNEL_COUNT)
    ? issue(at, `channel must be 1–${CHANNEL_COUNT}`)
    : issueUnless(
        !(isStereo(channels, ch) && ch % 2 === 0),
        at,
        `channel ${ch} is the second of a stereo pair; use channel ${ch - 1}`,
      );

const keyIssues = (key: Key, channels: readonly Channel[], at: string): Issues => {
  switch (key.type) {
    case 'unassigned':
      return [];
    case 'auto':
      return levelIssues(key.level, `${at}.level`);
    case 'channel':
      return [
        ...channelIssues(channels, key.channel, `${at}.channel`),
        ...nameIssues(
          key.name,
          KEY_NAME_PATTERN,
          'key names are 1–6 of 0-9, A-Z, a-z, space',
          `${at}.name`,
        ),
        ...levelIssues(key.level, `${at}.level`),
        ...panIssues(key.pan, `${at}.pan`),
      ];
    case 'group':
      return [
        ...nameIssues(
          key.name,
          KEY_NAME_PATTERN,
          'key names are 1–6 of 0-9, A-Z, a-z, space',
          `${at}.name`,
        ),
        ...levelIssues(key.level, `${at}.level`),
        ...key.members.flatMap((m, j) => [
          ...channelIssues(channels, m.channel, `${at}.members[${j}].channel`),
          ...levelIssues(m.level, `${at}.members[${j}].level`),
          ...panIssues(m.pan, `${at}.members[${j}].pan`),
        ]),
      ];
    case 'unknown':
      return [
        ...issueUnless(isByte(key.flags), `${at}.flags`, 'flags must be a byte'),
        ...issueUnless(isByte(key.source), `${at}.source`, 'source must be a byte'),
        ...nameIssues(
          key.name,
          KEY_NAME_PATTERN,
          'key names are 1–6 of 0-9, A-Z, a-z, space',
          `${at}.name`,
        ),
        ...levelIssues(key.level, `${at}.level`),
        ...panIssues(key.pan, `${at}.pan`),
      ];
  }
};

/** A channel (or pair) can be in only one group. */
const overlapIssues = (keys: readonly Key[], channels: readonly Channel[], at: string): Issues => {
  const uses = keys.flatMap((key, i) =>
    key.type === 'group'
      ? key.members.flatMap((m, j) =>
          (isStereo(channels, m.channel)
            ? [pairStart(m.channel), pairStart(m.channel) + 1]
            : [m.channel]
          ).map((channel) => ({ channel, path: `${at}[${i}].members[${j}].channel` })),
        )
      : [],
  );
  return uses
    .filter((u, n) => uses.findIndex((v) => v.channel === u.channel) !== n)
    .flatMap((u) => issue(u.path, `channel ${u.channel} is already in another group`));
};

const keysIssues = (keys: readonly Key[], channels: readonly Channel[], at: string): Issues => [
  ...issueUnless(keys.length === KEY_COUNT, at, `must have ${KEY_COUNT} keys, got ${keys.length}`),
  ...keys.flatMap((key, i) => keyIssues(key, channels, `${at}[${i}]`)),
  ...overlapIssues(keys, channels, at),
];

export const validate = (system: System): Validated<System> => {
  const { channels, keys } = system;
  return unlessIssues([
    ...issueUnless(
      channels.length === CHANNEL_COUNT,
      'channels',
      `must have ${CHANNEL_COUNT} channels, got ${channels.length}`,
    ),
    ...channels.flatMap((c, i) => [
      ...issueUnless(
        c.name === undefined || c.name.length <= 6,
        `channels[${i}].name`,
        'channel names are up to 6 characters',
      ),
      ...issueUnless(
        i % 2 === 0 || (c.stereo === true) === (channels[i - 1]?.stereo === true),
        `channels[${i}].stereo`,
        `channels ${i} and ${i + 1} are a pair and must both be stereo or neither`,
      ),
    ]),
    ...keysIssues(keys, channels, 'keys'),
  ]).map(() => system);
};

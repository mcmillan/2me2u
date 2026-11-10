/**
 * Pure edits on a system. The model from `2me2u` is readonly plain data, so
 * every edit returns a new system and React state stays immutable.
 */

import {
  CHANNEL_COUNT,
  type Channel,
  KEY_COUNT,
  type Key,
  type Level,
  type System,
} from '@mcmillan/2me2u-core';

/** A complete system as the editor holds it. */
export type Editable = Pick<System, 'channels' | 'keys' | 'source'>;

export type EditableKeyType = 'unassigned' | 'auto' | 'channel' | 'group';

export const blank = (): Editable => ({
  channels: Array.from({ length: CHANNEL_COUNT }, (): Channel => ({})),
  keys: Array.from({ length: KEY_COUNT }, (): Key => ({ type: 'unassigned' })),
});

export const fromSystem = (system: System): Editable => ({
  channels: system.channels,
  keys: system.keys,
  ...(system.source ? { source: system.source } : {}),
});

const without = <T extends object, K extends keyof T>(obj: T, key: K): Omit<T, K> => {
  const { [key]: _, ...rest } = obj;
  return rest;
};

/** The system as the library wants it: blank names dropped rather than sent as empty strings. */
export const clean = (system: Editable): Editable => ({
  ...system,
  channels: system.channels.map((c) => (c.name === '' ? without(c, 'name') : c)),
  keys: system.keys.map((k) => ('name' in k && k.name === '' ? (without(k, 'name') as Key) : k)),
});

export const isStereo = (system: Editable, channel: number): boolean =>
  system.channels[channel - 1]?.stereo === true;

export const pairStart = (channel: number): number => (channel % 2 === 1 ? channel : channel - 1);

// ---- channels ------------------------------------------------------------

export const setChannelName = (system: Editable, channel: number, name: string): Editable => ({
  ...system,
  channels: system.channels.map((c, i) => (i === channel - 1 ? { ...c, name } : c)),
});

/** Link or unlink the pair `channel` belongs to; both channels carry the flag. */
export const setStereo = (system: Editable, channel: number, stereo: boolean): Editable => {
  const first = pairStart(channel);
  return {
    ...system,
    channels: system.channels.map((c, i) =>
      i + 1 === first || i + 1 === first + 1
        ? stereo
          ? { ...c, stereo: true }
          : without(c, 'stereo')
        : c,
    ),
  };
};

// ---- keys ----------------------------------------------------------------

export const setKey = (system: Editable, index: number, key: Key): Editable => ({
  ...system,
  keys: system.keys.map((k, i) => (i === index ? key : k)),
});

/** Channels a key may refer to: every channel except the second of a stereo pair. */
export const selectableChannels = (system: Editable): number[] =>
  system.channels.flatMap((c, i) => (c.stereo && i % 2 === 1 ? [] : [i + 1]));

const firstFreeChannel = (system: Editable, except: number): number => {
  const used = new Set(
    system.keys.flatMap((k, i) =>
      i === except
        ? []
        : k.type === 'channel'
          ? [k.channel]
          : k.type === 'group'
            ? k.members.map((m) => m.channel)
            : [],
    ),
  );
  return selectableChannels(system).find((n) => !used.has(n)) ?? 1;
};

/** Change a key's type, keeping the name and level where the new type has them. */
export const setKeyType = (system: Editable, index: number, type: EditableKeyType): Editable => {
  const old = system.keys[index];
  if (!old) return system;
  const name = old.type === 'channel' || old.type === 'group' ? old.name : undefined;
  const level = old.type === 'unassigned' ? undefined : old.level;
  const named = name === undefined ? {} : { name };
  const levelled = level === undefined ? {} : { level };
  const next: Key =
    type === 'unassigned'
      ? { type }
      : type === 'auto'
        ? { type, ...levelled }
        : type === 'channel'
          ? { type, channel: firstFreeChannel(system, index), ...named, ...levelled }
          : { type, members: [], ...named, ...levelled };
  return setKey(system, index, next);
};

export const setKeyName = (system: Editable, index: number, name: string): Editable => {
  const key = system.keys[index];
  return key?.type === 'channel' || key?.type === 'group'
    ? setKey(system, index, { ...key, name })
    : system;
};

export const setKeyLevel = (system: Editable, index: number, level: Level): Editable => {
  const key = system.keys[index];
  return key && key.type !== 'unassigned' ? setKey(system, index, { ...key, level }) : system;
};

export const setKeyChannel = (system: Editable, index: number, channel: number): Editable => {
  const key = system.keys[index];
  return key?.type === 'channel' ? setKey(system, index, { ...key, channel }) : system;
};

export const toggleMember = (system: Editable, index: number, channel: number): Editable => {
  const key = system.keys[index];
  if (key?.type !== 'group') return system;
  const has = key.members.some((m) => m.channel === channel);
  const members = has
    ? key.members.filter((m) => m.channel !== channel)
    : [...key.members, { channel }].sort((a, b) => a.channel - b.channel);
  return setKey(system, index, { ...key, members });
};

// ---- labels --------------------------------------------------------------

/** What the ME-1 shows for a channel, with its number(s). */
export const channelLabel = (system: Editable, channel: number): string => {
  const c = system.channels[channel - 1];
  const name = c?.name || String(channel);
  return c?.stereo ? `${name} (${channel}+${channel + 1})` : `${name} (${channel})`;
};

/** The label a key shows on the ME-1: its own name, else its channel's. */
export const keyLabel = (system: Editable, key: Key): string => {
  switch (key.type) {
    case 'unassigned':
      return '—';
    case 'auto':
      return 'Auto';
    case 'channel':
      return key.name || system.channels[key.channel - 1]?.name || String(key.channel);
    case 'group':
      return key.name || 'Group';
    case 'unknown':
      return key.name || 'Unknown';
  }
};

/** Set one group member's level; returns the system unchanged if it isn't a member or the level is the same. */
export const setMemberLevel = (
  system: Editable,
  index: number,
  channel: number,
  level: Level,
): Editable => {
  const key = system.keys[index];
  if (key?.type !== 'group') return system;
  const member = key.members.find((m) => m.channel === channel);
  if (!member || member.level === level) return system;
  return setKey(system, index, {
    ...key,
    members: key.members.map((m) => (m.channel === channel ? { ...m, level } : m)),
  });
};

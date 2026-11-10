/**
 * The core library's issues in plain English, naming each field the way the
 * editor shows it ("Key 2's label", "Channel 7's name"), and where to go to
 * fix them.
 */

import { type Issue, KEY_COUNT, type Key, LEVEL_MAX, LEVEL_MIN } from '@mcmillan/2me2u-core';
import { useAtomValue } from 'jotai';
import type { Editable } from './edit.ts';
import { issuesAtom, systemAtom } from './store.ts';

/** `keys[3].members[1].channel` → key 3 (0-based), member 1, field `channel`. */
const KEY_PATH = /^keys\[(\d+)\](?:\.members\[(\d+)\])?(?:\.(\w+))?/;
const CHANNEL_PATH = /^channels\[(\d+)\](?:\.(\w+))?/;

const levelRange = `between ${Math.round(LEVEL_MIN)} and +${LEVEL_MAX} dB`;

const sentence = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** "Kick (ch 1)", "OH (ch 7+8)", or "channel 1" when it has no name. */
const channelName = (system: Editable | undefined, channel: number): string => {
  const c = system?.channels[channel - 1];
  const numbers = c?.stereo && channel % 2 === 1 ? `${channel}+${channel + 1}` : String(channel);
  return c?.name ? `${c.name} (ch ${numbers})` : `channel ${numbers}`;
};

const groupName = (key: Key | undefined, index: number): string =>
  key?.type === 'group' && key.name
    ? `the ${key.name} group (key ${index + 1})`
    : `key ${index + 1}'s group`;

const memberChannel = (key: Key | undefined, member: number): number | undefined =>
  key?.type === 'group' ? key.members[member]?.channel : undefined;

/** The earlier group key (other than `except`) that already holds `channel` or its pair. */
const groupHolding = (system: Editable, channel: number, except: number): number =>
  system.keys.findIndex(
    (k, i) =>
      i !== except &&
      k.type === 'group' &&
      k.members.some((m) => {
        const pair = system.channels[m.channel - 1]?.stereo;
        return m.channel === channel || (pair === true && m.channel + 1 === channel);
      }),
  );

const nameProblem = (subject: string, name: string | undefined): string =>
  name !== undefined && name.length > 6
    ? `${subject} is too long: use up to 6 characters`
    : `${subject} can only use letters A–Z, numbers and spaces`;

const describeKeyIssue = (
  issue: Issue,
  system: Editable | undefined,
  index: number,
  member: number | undefined,
  field: string | undefined,
): string => {
  const n = index + 1;
  const key = system?.keys[index];
  const reason = issue.reason;

  if (member !== undefined) {
    const channel = memberChannel(key, member);
    const who = channel === undefined ? 'a channel' : channelName(system, channel);
    const second = reason.match(/^channel (\d+) is the second of a stereo pair/);
    if (second) {
      const ch = Number(second[1]);
      return `Key ${n}'s group includes channel ${ch}, but ${ch - 1} and ${ch} are a stereo pair: choose channel ${ch - 1}`;
    }
    const taken = reason.match(/^channel (\d+) is already in another group/);
    if (taken) {
      const reported = Number(taken[1]);
      // A stereo pair is reported once per channel; name it by its first.
      const ch =
        reported % 2 === 0 && system?.channels[reported - 1]?.stereo ? reported - 1 : reported;
      const other = system ? groupHolding(system, ch, index) : -1;
      const where = other >= 0 ? groupName(system?.keys[other], other) : 'another group';
      return `${sentence(channelName(system, ch))} is already in ${where}; a channel can be in only one group`;
    }
    if (field === 'channel') return `Key ${n}'s group has a channel that doesn't exist`;
    if (field === 'level') return `Key ${n}'s level for ${who} must be off or ${levelRange}`;
    if (field === 'pan') return `Key ${n}'s pan for ${who} is out of range`;
    return `Key ${n}: ${reason}`;
  }

  switch (field) {
    case 'name':
      return nameProblem(`Key ${n}'s label`, key && 'name' in key ? key.name : undefined);
    case 'channel': {
      const second = reason.match(/^channel (\d+) is the second of a stereo pair/);
      if (second) {
        const ch = Number(second[1]);
        return `Key ${n} uses channel ${ch}, but ${ch - 1} and ${ch} are a stereo pair: choose channel ${ch - 1}`;
      }
      return `Key ${n}'s channel doesn't exist`;
    }
    case 'level':
      return `Key ${n}'s level must be off or ${levelRange}`;
    case 'pan':
      return `Key ${n}'s pan is out of range`;
    case 'flags':
    case 'source':
      return `Key ${n} has a setting the ME-1 can't store; change its type to reset it`;
    default:
      return `Key ${n}: ${reason}`;
  }
};

/**
 * A short plain-English sentence for an issue from the core library. Pass the
 * system so channels and groups can be named; unrecognised issues fall back to
 * the library's own reason.
 */
export const describeIssue = (issue: Issue, system?: Editable): string => {
  const { path, reason } = issue;

  const key = path.match(KEY_PATH);
  if (key) {
    return describeKeyIssue(
      issue,
      system,
      Number(key[1]),
      key[2] === undefined ? undefined : Number(key[2]),
      key[3],
    );
  }

  const channel = path.match(CHANNEL_PATH);
  if (channel) {
    const n = Number(channel[1]) + 1;
    if (channel[2] === 'name') return `Channel ${n}'s name is too long: use up to 6 characters`;
    if (channel[2] === 'stereo') {
      const first = n % 2 === 0 ? n - 1 : n;
      return `Channels ${first} and ${first + 1} are a pair: make both stereo or both mono`;
    }
    return `Channel ${n}: ${reason}`;
  }

  if (path === 'keys') return `The config must have ${KEY_COUNT} keys`;
  if (path === 'channels' || path === 'meu.Channels')
    return 'The channel setup must have 40 channels';

  const link = reason.match(/^the config has channel (\d+) (stereo|mono), but the setup has it/);
  if (link) {
    const other = link[2] === 'stereo' ? 'mono' : 'stereo';
    return `The ME-1 file has channel ${link[1]} as ${link[2]}, but the ME-U file has it ${other}`;
  }

  return sentence(reason);
};

/** Where an issue can be fixed. */
export interface IssueLocation {
  readonly view: 'keys' | 'channels';
  /** The key to select, 0-based like `selectedKeyAtom`. */
  readonly key?: number;
  /** The channel, 1-based as the model and hardware number it. */
  readonly channel?: number;
}

/** The view, and key or channel, where an issue can be fixed. */
export const issueLocation = (issue: Issue): IssueLocation => {
  const key = issue.path.match(/^keys\[(\d+)\]/);
  if (key) return { view: 'keys', key: Number(key[1]) };
  const channel = issue.path.match(/^channels\[(\d+)\]/);
  if (channel) return { view: 'channels', channel: Number(channel[1]) + 1 };
  return { view: issue.path.startsWith('channels') ? 'channels' : 'keys' };
};

/** Whether an issue at `issuePath` belongs to the field at `path` (or something inside it). */
export const issueIsAt = (issuePath: string, path: string): boolean =>
  issuePath === path || issuePath.startsWith(`${path}.`) || issuePath.startsWith(`${path}[`);

/** The first problem for a field path (or anything inside it), described in plain English. */
export const useFieldIssue = (path: string): string | undefined => {
  const issues = useAtomValue(issuesAtom);
  const system = useAtomValue(systemAtom);
  const found = issues.find((i) => issueIsAt(i.path, path));
  return found && describeIssue(found, system);
};

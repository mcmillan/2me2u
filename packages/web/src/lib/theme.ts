/**
 * Visual vocabulary shared by every component, so a key type looks the same on
 * its tile, in the editor and in legends.
 */

import type { Key } from '@mcmillan/2me2u-core';

/** The app's accent theme: primary actions, the selected key, focus. */
export const ACCENT = 'orange' as const;

/** The Tamagui theme for each key type; unassigned keys use the base theme. */
export const KEY_TYPE_THEME = {
  unassigned: undefined,
  auto: 'yellow',
  channel: 'accent',
  group: 'green',
  unknown: 'red',
} as const satisfies Record<Key['type'], string | undefined>;

export const KEY_TYPE_LABEL: Record<Key['type'], string> = {
  unassigned: 'Unassigned',
  auto: 'Auto',
  channel: 'Channel',
  group: 'Group',
  unknown: 'Unknown',
};

/** Monospace face for labels shown the way the ME-1 shows them. */
export const DISPLAY_FONT = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';

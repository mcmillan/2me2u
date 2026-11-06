/**
 * The model: a monitoring system as a sound engineer sees it. An ME-U hub
 * sends up to 40 channels; each ME-1 on it builds a personal mix from them
 * with 16 keys.
 *
 * Everything here is plain, readonly data, so a system can be written as a
 * literal, edited with spreads, and compared with `toEqual`. Channels are
 * numbered 1–40 as the ME-1 and ME-U display them. Optional fields have the
 * ME-1's own defaults; reading a file sets every level and pan explicitly.
 */

export const CHANNEL_COUNT = 40;
export const KEY_COUNT = 16;

/**
 * A fader level in dB relative to the `0` marker on the ME-1's level bar, or
 * `'off'`. The bar runs from off through `0` to +10 dB of headroom. The ME-1
 * stores levels in 1/256 dB steps; other values are rounded to the nearest step.
 */
export type Level = number | 'off';
/** The lowest level above `'off'`, in dB. */
export const LEVEL_MIN = (-0x7fff + 1 + 2560) / 256;
/** The highest level, in dB. */
export const LEVEL_MAX = 10;

/**
 * The pan value for centre. Pan is kept as the ME-1 stores it: a byte, which
 * the range isn't modelled.
 */
export const PAN_CENTRE = 0x25;

/** A channel as the hub sends it. The ME-1 shows an unnamed channel by its number. */
export interface Channel {
  /** Up to 6 characters. */
  readonly name?: string;
  /**
   * Stereo-linked with its partner: channels 1+2, 3+4, … pair up. Setting it on
   * either channel of a pair links both.
   */
  readonly stereo?: boolean;
}

/**
 * A member of a group. A stereo pair is one member, listed by its first (odd)
 * channel, and shares a level and pan.
 */
export interface Member {
  readonly channel: number;
  /** Default `0`. */
  readonly level?: Level;
  /** Default {@link PAN_CENTRE}. */
  readonly pan?: number;
}

export type Key =
  /** No source. */
  | { readonly type: 'unassigned' }
  /** Auto Mode: the key takes the first channel no other key or group uses. */
  | { readonly type: 'auto'; readonly level?: Level }
  /** One channel, or a stereo pair by its first (odd) channel. */
  | {
      readonly type: 'channel';
      readonly channel: number;
      /** A custom name of up to 6 characters; omit to show the channel's name. */
      readonly name?: string;
      readonly level?: Level;
      /** For a pair, balance. */
      readonly pan?: number;
    }
  /** Several channels mixed under one master level. A channel can be in only one group. */
  | {
      readonly type: 'group';
      readonly name?: string;
      /** Group master, default `0`. */
      readonly level?: Level;
      readonly members: readonly Member[];
    }
  /**
   * A source the model doesn't cover (the guide's Aux Input and 1kHz Sine). It
   * keeps the raw codes so a file survives a rewrite.
   */
  | {
      readonly type: 'unknown';
      readonly flags: number;
      readonly source: number;
      readonly name?: string;
      readonly level?: Level;
      readonly pan?: number;
    };

/** The first (odd) channel of the pair `channel` belongs to. */
export const pairStart = (channel: number): number => channel - ((channel + 1) % 2);

/** Whether `channel` is stereo-linked, in a complete system. */
export const isStereo = (channels: readonly Channel[], channel: number): boolean =>
  channels[channel - 1]?.stereo === true;

/** The name the ME-1 shows for a channel: its name, else its number. */
export const channelName = (channels: readonly Channel[], channel: number): string =>
  channels[channel - 1]?.name || String(channel);

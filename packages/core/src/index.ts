/**
 * Parse and build Allen & Heath ME-1 configs (`.ME1`) and ME-U channel setups
 * (`.meu`), through one model of the monitoring system.
 *
 * ```ts
 * const system = parseConfig({ me1: bytes, meu: json });          // Result<System, Issue[]>
 * const edited = system.map((s) => ({ ...s, keys: s.keys.with(0, { type: 'channel', channel: 18 }) }));
 * edited.andThen(buildME1Config);                                 // Result<Uint8Array, Issue[]>
 * buildMEUConfig({ channels: [{ name: 'Kick' }, { name: 'Snare' }] });
 * ```
 */

export type { Issue, Issues } from './issues.ts';
export {
  CHANNEL_COUNT,
  type Channel,
  KEY_COUNT,
  type Key,
  LEVEL_MAX,
  LEVEL_MIN,
  type Level,
  type Member,
  PAN_CENTRE,
} from './model.ts';
export {
  buildME1Config,
  buildMEUConfig,
  type ConfigFiles,
  parseConfig,
  parseME1Config,
  parseMEUConfig,
  type Source,
  type System,
  type SystemDraft,
} from './system.ts';

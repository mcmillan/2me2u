/**
 * The `.meu` format: ME-U hub channel setups. JSON with one entry per channel
 * holding the name and stereo link the hub sends to the ME-1s. The encoder
 * reproduces the hub's own formatting exactly.
 */

import { tryOrElse } from 'true-myth/result';
import { check, collect, combine, invalid, under, type Validated } from '../../issues.ts';
import { type Channel, channelName } from '../../model.ts';

interface MEUChannelRecord {
  /** Unnamed channels hold their number, e.g. "30". */
  readonly name: string;
  readonly stereoLink: boolean;
  /**
   * `UseReceivedNameAndStereo`. True in every file, even with user names set;
   * presumably prefers names and links from upstream when there are any.
   */
  readonly useReceivedNameAndStereo: boolean;
}

/** The file as stored. */
export interface MEUFile {
  readonly channels: readonly MEUChannelRecord[];
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const recordFrom = (c: unknown, index: number): Validated<MEUChannelRecord> => {
  const path = `Channels[${index}]`;
  if (!isRecord(c)) return invalid(path, 'not an object');
  const { UserChannelName: name, UserStereoLink: link, UseReceivedNameAndStereo: received } = c;
  return combine([
    check(typeof name === 'string', `${path}.UserChannelName`, 'not a string'),
    check(typeof link === 'boolean', `${path}.UserStereoLink`, 'not a boolean'),
    check(typeof received === 'boolean', `${path}.UseReceivedNameAndStereo`, 'not a boolean'),
  ]).map(() => ({
    name: String(name),
    stereoLink: link === true,
    useReceivedNameAndStereo: received === true,
  }));
};

export const MEUFile = {
  decode: (data: string | Uint8Array): Validated<MEUFile> =>
    tryOrElse(
      (e) => [{ path: '', reason: `not JSON: ${e instanceof Error ? e.message : String(e)}` }],
      (): unknown => JSON.parse(typeof data === 'string' ? data : new TextDecoder().decode(data)),
    )
      .andThen((json): Validated<MEUFile> => {
        const channels = isRecord(json) ? json.Channels : undefined;
        return Array.isArray(channels)
          ? collect(channels.map(recordFrom)).map((cs) => ({ channels: cs }))
          : invalid('Channels', 'missing "Channels" array');
      })
      .mapErr((issues) => under('meu', issues)),

  encode: (file: MEUFile): string =>
    `{\n"Channels" : [\n${file.channels
      .map(
        (c) =>
          `{ "UserChannelName" : ${JSON.stringify(c.name)}, "UserStereoLink" : ${c.stereoLink}, "UseReceivedNameAndStereo" : ${c.useReceivedNameAndStereo} }`,
      )
      .join(', \n')}\n]\n}\n`,
};

/** What a setup holds. */
export interface MEUDocument {
  readonly channels: readonly Channel[];
  readonly file: MEUFile;
}

export const MEU = {
  decode: (data: string | Uint8Array): Validated<MEUDocument> =>
    MEUFile.decode(data).map((file) => ({
      channels: file.channels.map(
        (c, i): Channel => ({
          ...(c.name === String(i + 1) ? {} : { name: c.name }),
          ...(c.stereoLink ? { stereo: true } : {}),
        }),
      ),
      file,
    })),

  /** Encode channels as a setup, keeping settings from the setup they were read from (if any). */
  encode: (channels: readonly Channel[], base?: MEUFile): string =>
    MEUFile.encode({
      channels: channels.map((c, i) => ({
        name: channelName(channels, i + 1),
        stereoLink: c.stereo === true,
        useReceivedNameAndStereo: base?.channels[i]?.useReceivedNameAndStereo ?? true,
      })),
    }),
};

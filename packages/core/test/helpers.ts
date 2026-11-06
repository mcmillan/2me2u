import { readFileSync } from 'node:fs';
import { unwrap } from 'true-myth/test-support';
import { parseConfig, parseME1Config } from '../src/index.ts';

export const ME1_FIXTURES = ['BEAUTIFL.ME1', 'CFA.ME1', 'JOSEPH.ME1'] as const;

export const bytes = (name: string): Uint8Array =>
  new Uint8Array(readFileSync(new URL(`./fixtures/${name}`, import.meta.url)));
export const text = (name: string): string =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

/** A system read from an `.ME1` fixture alone. */
export const systemFromME1 = (name: string) => unwrap(parseME1Config(bytes(name)));

/** JOSEPH's `.ME1` with the ME-U setup it was built from. */
export const joseph = () =>
  unwrap(parseConfig({ me1: bytes('JOSEPH.ME1'), meu: text('JOSEPH.meu') }));

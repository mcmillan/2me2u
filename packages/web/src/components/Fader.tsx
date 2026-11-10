import type { Level } from '@mcmillan/2me2u-core';

export interface FaderProps {
  readonly value: Level | undefined;
  readonly onChange: (level: Level) => void;
  /** Accessible name, e.g. "Key 3 level". */
  readonly label: string;
}

/** A level fader with the 0 marker and off at the bottom of travel. Owned by the fader agent. */
export const Fader = (_props: FaderProps) => null;

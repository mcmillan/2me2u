import { LEVEL_MAX, LEVEL_MIN, type Level } from '@mcmillan/2me2u-core';
import {
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { Input, SizableText, Theme, XStack, YStack } from 'tamagui';
import { ACCENT, DISPLAY_FONT } from '../lib/theme.ts';

export interface FaderProps {
  readonly value: Level | undefined;
  readonly onChange: (level: Level) => void;
  /** Accessible name, e.g. "Key 3 level". */
  readonly label: string;
  /** A shorter track without tick labels, for group member rows. */
  readonly compact?: boolean;
}

/**
 * The fader law: travel position (0 at the left, 1 at the right) against level
 * in dB, as piecewise-linear segments between these points. `off` sits at 0;
 * the long tail from `off` through LEVEL_MIN to -40 dB gets the first fifth of
 * the travel, and -40…+10 dB gets the rest, with 0 dB at 78% like a mixer.
 */
const LAW: readonly (readonly [position: number, db: number])[] = [
  [0.03, LEVEL_MIN],
  [0.1, -60],
  [0.2, -40],
  [0.42, -20],
  [0.6, -10],
  [0.78, 0],
  [1, LEVEL_MAX],
];

/** Below this position a drag or click means off. */
const OFF_BELOW = 0.015;

const clamp = (db: number) => Math.min(LEVEL_MAX, Math.max(LEVEL_MIN, db));

/** The law's segments, each from one point to the next. */
const SEGMENTS = LAW.slice(1).map((end, i) => [LAW[i] ?? end, end] as const);

/** Where a level sits on the travel, 0…1. */
const toPosition = (level: Level): number => {
  if (level === 'off') return 0;
  const db = clamp(level);
  for (const [[p0, d0], [p1, d1]] of SEGMENTS) {
    if (db <= d1) return p0 + ((db - d0) / (d1 - d0)) * (p1 - p0);
  }
  return 1;
};

/** The level at a travel position, rounded to 0.1 dB. */
const fromPosition = (position: number): Level => {
  if (position < OFF_BELOW) return 'off';
  if (position <= (LAW[0]?.[0] ?? 0)) return LEVEL_MIN;
  for (const [[p0, d0], [p1, d1]] of SEGMENTS) {
    if (position <= p1) {
      const db = d0 + ((position - p0) / (p1 - p0)) * (d1 - d0);
      return clamp(Math.round(db * 10) / 10);
    }
  }
  return LEVEL_MAX;
};

/** A level to 0.1 dB with its sign, or OFF. */
const format = (level: Level): string => {
  if (level === 'off') return 'OFF';
  const text = (Math.round(level * 10) / 10).toFixed(1);
  return level > 0 && text !== '0.0' ? `+${text}` : text === '-0.0' ? '0.0' : text;
};

/** What the user typed, or undefined if it isn't a level. */
const parse = (text: string): Level | undefined => {
  const t = text.trim().toLowerCase();
  if (t === 'off' || t === '-inf' || t === '-∞') return 'off';
  const n = Number.parseFloat(t.replace(/db$/, ''));
  return Number.isFinite(n) ? clamp(n) : undefined;
};

/** The next level a key press moves to: up or down onto the next multiple of `step`. */
const stepped = (level: Level, step: number): Level => {
  if (level === 'off') return step > 0 ? LEVEL_MIN : 'off';
  if (step < 0 && level <= LEVEL_MIN) return 'off';
  const size = Math.abs(step);
  const grid =
    step > 0
      ? (Math.floor(level / size + 1e-9) + 1) * size
      : (Math.ceil(level / size - 1e-9) - 1) * size;
  return clamp(grid);
};

const TICKS: readonly (readonly [db: Level, label: string])[] = [
  ['off', 'off'],
  [-40, '-40'],
  [-20, '-20'],
  [-10, '-10'],
  [0, '0'],
  [LEVEL_MAX, '+10'],
];

const THUMB_W = 12;

/** The native range's integer steps across the travel; positions map onto these. */
const STEPS = 1000;

const stepOf = (level: Level) => Math.round(toPosition(level) * STEPS);

/**
 * The native range keeps its semantics, focus and pointer handling; only its
 * track and thumb are restyled (the groove, fill and ticks are drawn behind it).
 * WebKit and Firefox pseudo-elements stay in separate rules, since a browser
 * drops a whole rule over a pseudo-element it doesn't know.
 */
const CSS = `
.fader {
  -webkit-appearance: none; appearance: none; position: absolute; top: 0;
  left: ${-THUMB_W / 2}px; width: calc(100% + ${THUMB_W}px); height: 100%;
  margin: 0; padding: 0; border: 0; border-radius: 4px; background: transparent;
  cursor: pointer; touch-action: pan-y;
}
.fader:focus { outline: none; }
.fader:focus-visible { outline: 2px solid var(--fader-ring); outline-offset: 2px; }
.fader::-webkit-slider-runnable-track { height: 100%; border: 0; background: transparent; }
.fader::-webkit-slider-thumb {
  -webkit-appearance: none; appearance: none; box-sizing: border-box;
  width: ${THUMB_W}px; height: var(--fader-thumb-h);
  margin-top: calc((var(--fader-track-h) - var(--fader-thumb-h)) / 2);
  border: 1px solid var(--fader-thumb-border); border-radius: 2px;
  background: linear-gradient(var(--fader-grip), var(--fader-grip)) center / ${THUMB_W - 4}px 2px no-repeat, var(--fader-thumb);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
}
.fader::-moz-range-track { height: 100%; border: 0; background: transparent; }
.fader::-moz-range-thumb {
  box-sizing: border-box; width: ${THUMB_W}px; height: var(--fader-thumb-h);
  border: 1px solid var(--fader-thumb-border); border-radius: 2px;
  background: linear-gradient(var(--fader-grip), var(--fader-grip)) center / ${THUMB_W - 4}px 2px no-repeat, var(--fader-thumb);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
}
`;

/**
 * A horizontal level fader: off at the far left, the 0 marker, +10 dB at the
 * right, on a law that gives -40…+10 dB most of the travel. It is a native
 * range input over integer steps of the travel: drag or click the track, use
 * the arrow keys (0.5 dB, 3 dB with Shift or Page Up/Down; Home is off, End
 * +10, 0 the marker), or type into the readout. `onChange` fires only when the
 * user changes the level, so focusing or tabbing through never rounds a stored
 * value. A drag commits once, on release.
 */
export const Fader = ({ value, onChange, label, compact = false }: FaderProps) => {
  const level: Level = value ?? 0;
  const input = useRef<HTMLInputElement>(null);
  /** The pointer press in progress; `armed` once it has really moved the fader. */
  const press = useRef<{ startX: number; armed: boolean } | null>(null);
  const lastThumbDown = useRef(0);
  const [dragLevel, setDragLevel] = useState<Level | null>(null);
  const dragged = useRef<Level | null>(null);
  const shown = dragLevel ?? level;

  const [text, setText] = useState(format(level));
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (!editing) setText(format(shown));
  }, [shown, editing]);

  // The range is uncontrolled so React never echoes its value back as a change;
  // keep it on the shown level.
  const sync = () => {
    if (input.current) input.current.value = String(stepOf(dragged.current ?? level));
  };
  useLayoutEffect(sync);

  const change = (next: Level) => {
    if (next !== level) onChange(next);
  };

  const setDrag = (next: Level | null) => {
    dragged.current = next;
    setDragLevel(next);
  };

  const onPointerDown = (e: PointerEvent<HTMLInputElement>) => {
    if (e.button !== 0) return;
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const thumbX = rect.left + THUMB_W / 2 + (stepOf(level) / STEPS) * (rect.width - THUMB_W);
    const onThumb = Math.abs(e.clientX - thumbX) <= THUMB_W / 2 + 2;
    if (onThumb && e.timeStamp - lastThumbDown.current < 400) {
      // A double-click on the thumb snaps to 0.
      lastThumbDown.current = 0;
      e.preventDefault();
      el.focus();
      press.current = null;
      change(0);
      return;
    }
    lastThumbDown.current = onThumb ? e.timeStamp : 0;
    // A press on the thumb has to travel a few pixels before it moves anything,
    // so a click on it never nudges the level; a press on the track jumps there.
    press.current = { startX: e.clientX, armed: !onThumb };
  };

  const onPointerMove = (e: PointerEvent<HTMLInputElement>) => {
    const p = press.current;
    if (p && !p.armed && Math.abs(e.clientX - p.startX) >= 3) p.armed = true;
  };

  const endPress = () => {
    // The range's change event follows pointerup; let it commit first.
    window.setTimeout(() => {
      press.current = null;
      setDrag(null);
      sync();
    });
  };

  const onInput = () => {
    const el = input.current;
    if (!el || !press.current) return; // Not a pointer: wait for the change event.
    if (!press.current.armed) sync();
    else setDrag(fromPosition(el.valueAsNumber / STEPS));
  };

  // The native change event (React's onChange is the input event): a drag
  // commits once here, on release. Without a pointer it's assistive tech
  // stepping the range, which moves the level as an arrow key does.
  const onCommit = useRef(() => {});
  onCommit.current = () => {
    const el = input.current;
    if (!el) return;
    if (press.current) {
      if (dragged.current !== null) change(dragged.current);
      return;
    }
    const direction = Math.sign(el.valueAsNumber - stepOf(level));
    if (direction !== 0) change(stepped(level, direction * 0.5));
    sync();
  };
  useEffect(() => {
    const el = input.current;
    const listener = () => onCommit.current();
    el?.addEventListener('change', listener);
    return () => el?.removeEventListener('change', listener);
  }, []);

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const big = e.shiftKey ? 3 : 0.5;
    const next: Level | undefined = (() => {
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowUp':
          return stepped(level, big);
        case 'ArrowLeft':
        case 'ArrowDown':
          return stepped(level, -big);
        case 'PageUp':
          return stepped(level, 3);
        case 'PageDown':
          return stepped(level, -3);
        case 'Home':
          return 'off';
        case 'End':
          return LEVEL_MAX;
        case '0':
          return 0;
        default:
          return undefined;
      }
    })();
    if (next === undefined) return;
    e.preventDefault();
    change(next);
  };

  const commitText = () => {
    setEditing(false);
    if (text === format(level)) return;
    const next = parse(text);
    if (next === undefined) setText(format(level));
    else {
      change(next);
      setText(format(next));
    }
  };

  const position = toPosition(shown);
  const trackH = compact ? 22 : 26;
  const thumbH = compact ? 18 : 22;
  const groove = 4;

  return (
    <XStack items="center" gap="2" w="100%">
      <YStack
        flex={1}
        minW={compact ? 96 : 140}
        maxW={compact ? 220 : undefined}
        px={THUMB_W / 2}
        style={
          {
            // Resolved here, in the neutral theme, before the accent theme below.
            '--fader-thumb': 'var(--color-1)',
            '--fader-thumb-border': 'var(--color-8)',
            '--fader-grip': 'var(--color-11)',
            '--fader-ring': 'var(--color-9)',
            '--fader-track-h': `${trackH}px`,
            '--fader-thumb-h': `${thumbH}px`,
          } as CSSProperties
        }
      >
        <style href="fader" precedence="default">
          {CSS}
        </style>
        <YStack position="relative" h={trackH}>
          {/* Groove, with the travel left of the thumb filled in the accent colour. */}
          <YStack
            position="absolute"
            l={0}
            r={0}
            t={(trackH - groove) / 2}
            h={groove}
            rounded="full"
            bg="color-4"
            pointerEvents="none"
          />
          <Theme name={ACCENT}>
            <YStack
              position="absolute"
              l={0}
              t={(trackH - groove) / 2}
              h={groove}
              w={`${position * 100}%`}
              rounded="full"
              bg="color-8"
              pointerEvents="none"
            />
          </Theme>
          {TICKS.map(([db]) => {
            const nominal = db === 0;
            return (
              <YStack
                key={String(db)}
                position="absolute"
                l={`${toPosition(db) * 100}%`}
                ml={nominal ? -1 : -0.5}
                t={nominal ? 0 : (trackH - groove) / 2 - 4}
                h={nominal ? trackH : groove + 8}
                w={nominal ? 2 : 1}
                bg={nominal ? 'color-11' : 'color-7'}
                pointerEvents="none"
              />
            );
          })}
          <Theme name={ACCENT}>
            <input
              ref={input}
              type="range"
              className="fader"
              min={0}
              max={STEPS}
              step={1}
              defaultValue={stepOf(level)}
              aria-label={label}
              aria-valuetext={shown === 'off' ? 'Off' : `${format(shown)} dB`}
              style={{ accentColor: 'var(--color-8)' }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={endPress}
              onPointerCancel={endPress}
              onInput={onInput}
              onKeyDown={onKeyDown}
            />
          </Theme>
        </YStack>
        {compact ? null : (
          <YStack position="relative" h={16} aria-hidden>
            {TICKS.map(([db, tick]) => (
              <SizableText
                key={tick}
                position="absolute"
                l={`${toPosition(db) * 100}%`}
                w={32}
                ml={db === 'off' ? -THUMB_W / 2 : db === LEVEL_MAX ? -32 + THUMB_W / 2 : -16}
                text={db === 'off' ? 'left' : db === LEVEL_MAX ? 'right' : 'center'}
                size="xs"
                color={db === 0 ? 'color' : 'color-10'}
                fontWeight={db === 0 ? '700' : '400'}
                fontFamily={DISPLAY_FONT}
                select="none"
              >
                {tick}
              </SizableText>
            ))}
          </YStack>
        )}
      </YStack>
      <XStack items="center" gap="1" self={compact ? 'center' : 'flex-start'}>
        <Input
          size="sm"
          w={compact ? 72 : 80}
          text="right"
          fontFamily={DISPLAY_FONT}
          inputMode="decimal"
          aria-label={`${label} in dB`}
          value={text}
          onFocus={() => setEditing(true)}
          onChangeText={(t) => {
            setEditing(true);
            setText(t);
          }}
          onBlur={commitText}
          onSubmitEditing={commitText}
          onKeyPress={(e) => {
            if (e.nativeEvent.key === 'Escape') {
              setText(format(level));
              setEditing(false);
            }
          }}
        />
        <SizableText size="xs" color="color-10" aria-hidden>
          dB
        </SizableText>
      </XStack>
    </XStack>
  );
};

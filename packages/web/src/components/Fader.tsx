import { LEVEL_MAX, LEVEL_MIN, type Level } from '@mcmillan/2me2u-core';
import { type KeyboardEvent, type PointerEvent, useEffect, useRef, useState } from 'react';
import { Input, SizableText, type TamaguiElement, Theme, XStack, YStack } from 'tamagui';
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

/**
 * A horizontal level fader: off at the far left, the 0 marker, +10 dB at the
 * right, on a law that gives -40…+10 dB most of the travel. Drag or click the
 * track, use the arrow keys, or type into the readout. `onChange` fires only
 * when the user changes the level, so focusing or tabbing through never rounds
 * a stored value. A drag commits once, on release.
 */
export const Fader = ({ value, onChange, label, compact = false }: FaderProps) => {
  const level: Level = value ?? 0;
  const rail = useRef<TamaguiElement>(null);
  const drag = useRef<{ offset: number; startX: number; moved: boolean } | null>(null);
  const lastThumbDown = useRef(0);
  const [dragLevel, setDragLevel] = useState<Level | null>(null);
  const shown = dragLevel ?? level;

  const [text, setText] = useState(format(level));
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (!editing) setText(format(shown));
  }, [shown, editing]);

  const change = (next: Level) => {
    if (next !== level) onChange(next);
  };

  const positionAt = (clientX: number) => {
    const rect = (rail.current as HTMLElement | null)?.getBoundingClientRect();
    if (!rect || rect.width === 0) return 0;
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).focus();
    e.currentTarget.setPointerCapture(e.pointerId);
    const onThumb = (e.target as HTMLElement).closest('[data-fader-thumb]') !== null;
    const at = positionAt(e.clientX);
    if (onThumb) {
      // A double-click on the thumb snaps to 0. Detected here because pointer
      // capture retargets the browser's dblclick away from the thumb.
      if (e.timeStamp - lastThumbDown.current < 400) {
        lastThumbDown.current = 0;
        drag.current = null;
        change(0);
        return;
      }
      lastThumbDown.current = e.timeStamp;
      // Grab the thumb where it is, so a click on it doesn't move it.
      drag.current = { offset: at - toPosition(level), startX: e.clientX, moved: false };
      setDragLevel(level);
    } else {
      lastThumbDown.current = 0;
      drag.current = { offset: 0, startX: e.clientX, moved: true };
      setDragLevel(fromPosition(at));
    }
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    if (!drag.current.moved && Math.abs(e.clientX - drag.current.startX) < 3) return;
    drag.current.moved = true;
    setDragLevel(fromPosition(positionAt(e.clientX) - drag.current.offset));
  };

  const endDrag = (commit: boolean) => {
    const d = drag.current;
    drag.current = null;
    if (commit && d?.moved && dragLevel !== null) change(dragLevel);
    setDragLevel(null);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
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
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={LEVEL_MIN}
        aria-valuemax={LEVEL_MAX}
        aria-valuenow={shown === 'off' ? LEVEL_MIN : shown}
        aria-valuetext={shown === 'off' ? 'Off' : `${format(shown)} dB`}
        flex={1}
        minW={compact ? 96 : 140}
        maxW={compact ? 220 : undefined}
        px={THUMB_W / 2}
        rounded="sm"
        cursor="pointer"
        outlineStyle="solid"
        outlineWidth={2}
        outlineOffset={2}
        outlineColor={{ default: 'transparent', 'focus-visible': 'color-9' }}
        style={{ touchAction: 'none', userSelect: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => endDrag(true)}
        onPointerCancel={() => endDrag(false)}
        onKeyDown={onKeyDown}
      >
        <YStack ref={rail} position="relative" h={trackH}>
          {/* Groove, with the travel left of the thumb filled in the accent colour. */}
          <YStack
            position="absolute"
            l={0}
            r={0}
            t={(trackH - groove) / 2}
            h={groove}
            rounded="full"
            bg="color-4"
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
          <YStack
            data-fader-thumb
            position="absolute"
            l={`${position * 100}%`}
            ml={-THUMB_W / 2}
            t={(trackH - thumbH) / 2}
            w={THUMB_W}
            h={thumbH}
            rounded="xs"
            bg="color-1"
            borderWidth={1}
            borderColor="color-8"
            items="center"
            justify="center"
            style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.25)' }}
          >
            <YStack w={THUMB_W - 4} h={2} bg="color-11" rounded="full" pointerEvents="none" />
          </YStack>
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

import type { Key, Level } from '@mcmillan/2me2u-core';
import { useAtom, useAtomValue } from 'jotai';
import { type KeyboardEvent, useRef, useState } from 'react';
import { SizableText, Theme, XStack, YStack } from 'tamagui';
import { type Editable, isStereo, keyLabel } from '../lib/edit.ts';
import { issuesAtom, selectedKeyAtom, systemAtom } from '../lib/store.ts';
import { ACCENT, DISPLAY_FONT, KEY_TYPE_LABEL, KEY_TYPE_THEME } from '../lib/theme.ts';
import { Action } from './ui.tsx';

/** A level as the tiles show it: one decimal place, `OFF`, and the default `0 dB`. */
export const levelText = (level: Level | undefined): string => {
  if (level === 'off') return 'OFF';
  const db = Math.round((level ?? 0) * 10) / 10;
  return db === 0 ? '0 dB' : `${db > 0 ? '+' : ''}${db.toFixed(1)} dB`;
};

/** One line on what a key plays. */
const summary = (system: Editable, key: Key): string => {
  switch (key.type) {
    case 'unassigned':
      return 'Empty';
    case 'auto':
      return 'Next free channel';
    case 'channel':
      return isStereo(system, key.channel)
        ? `Ch ${key.channel}+${key.channel + 1}`
        : `Ch ${key.channel}`;
    case 'group': {
      const n = key.members.length;
      return n === 0 ? 'No channels' : `${n} channel${n === 1 ? '' : 's'}`;
    }
    case 'unknown':
      return 'Kept as-is';
  }
};

/** A small pill naming a key type in that type's colour. */
export const TypeBadge = ({ type }: { type: Key['type'] }) => (
  <Theme name={KEY_TYPE_THEME[type] ?? null}>
    <XStack
      items="center"
      gap="1"
      px="1.5"
      py={2}
      rounded="full"
      bg="color-3"
      borderWidth={1}
      borderColor="color-6"
      self="flex-start"
      maxW="100%"
    >
      <YStack w={6} h={6} rounded="full" bg="color-9" shrink={0} />
      <SizableText size="xs" color="color-11" fontWeight="600" numberOfLines={1}>
        {KEY_TYPE_LABEL[type]}
      </SizableText>
    </XStack>
  </Theme>
);

/** Columns for the grid's width: the ME-1's 2×8 when there's room, else 4, else 2. */
const columnsFor = (width: number): 8 | 4 | 2 => (width >= 640 ? 8 : width >= 300 ? 4 : 2);

const Tile = ({
  index,
  keyValue: key,
  selected,
  problems,
  compact,
  onSelect,
  onKeyDown,
  tileRef,
}: {
  index: number;
  keyValue: Key;
  selected: boolean;
  problems: number;
  compact: boolean;
  onSelect: () => void;
  onKeyDown: (e: KeyboardEvent) => void;
  tileRef: (el: HTMLElement | null) => void;
}) => {
  const system = useAtomValue(systemAtom);
  const empty = key.type === 'unassigned';
  const label = keyLabel(system, key);
  const line = summary(system, key);
  const level = empty ? undefined : levelText(key.level);
  const name = [
    `Key ${index + 1}: ${empty ? 'unassigned' : label}`,
    empty ? undefined : KEY_TYPE_LABEL[key.type],
    empty ? undefined : line,
    level,
    problems > 0 ? `${problems} problem${problems === 1 ? '' : 's'}` : undefined,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <Theme name={selected ? ACCENT : null}>
      <Action
        ref={tileRef as never}
        role="radio"
        aria-checked={selected}
        aria-label={name}
        tabIndex={selected ? 0 : -1}
        onPress={onSelect}
        onKeyDown={onKeyDown}
        kind="subtle"
        flex={1}
        flexBasis={0}
        minW={0}
        h="auto"
        p={compact ? '1.5' : '2'}
        rounded="lg"
        flexDirection="column"
        items="stretch"
        justify="flex-start"
        gap={compact ? '1' : '1.5'}
        borderWidth={selected ? 2 : 1}
        borderStyle={empty && !selected ? 'dashed' : 'solid'}
        bg={
          selected
            ? 'color-2'
            : empty
              ? { default: 'transparent', hover: 'color-2', press: 'color-3' }
              : { default: 'background', hover: 'color-2', press: 'color-3' }
        }
        borderColor={selected ? 'color-8' : 'border-color'}
      >
        <XStack items="center" gap="1">
          <SizableText
            size="xs"
            fontWeight="700"
            color={selected ? 'color-11' : 'color-10'}
            fontFamily={DISPLAY_FONT}
          >
            {String(index + 1).padStart(2, '0')}
          </SizableText>
          {problems > 0 && (
            <Theme name="red">
              <XStack items="center" gap="1" px="1" rounded="full" bg="color-3" aria-hidden>
                <YStack w={6} h={6} rounded="full" bg="color-9" />
                {!compact && (
                  <SizableText size="xs" color="color-11" fontWeight="700">
                    {problems}
                  </SizableText>
                )}
              </XStack>
            </Theme>
          )}
          {level && !compact && (
            <SizableText size="xs" color="color-10" fontFamily={DISPLAY_FONT} ml="auto">
              {level}
            </SizableText>
          )}
          {compact && !empty && (
            <Theme name={KEY_TYPE_THEME[key.type] ?? null}>
              <YStack w={8} h={8} rounded="full" bg="color-9" ml="auto" aria-hidden />
            </Theme>
          )}
        </XStack>
        <SizableText
          size={compact ? 'base' : 'lg'}
          fontFamily={DISPLAY_FONT}
          fontWeight="600"
          numberOfLines={1}
          color={empty ? 'color-8' : 'color'}
        >
          {label}
        </SizableText>
        {!empty && !compact && <TypeBadge type={key.type} />}
        <SizableText size="xs" color="color-10" numberOfLines={1}>
          {compact && level ? level : line}
        </SizableText>
      </Action>
    </Theme>
  );
};

const LEGEND: readonly Key['type'][] = ['channel', 'group', 'auto', 'unknown'];

/**
 * The 16 Select keys laid out as on the ME-1: 1–8 above 9–16, with a band
 * between the two halves where the device's label strip sits. Narrow columns
 * fall back to 4 or 2 columns. Selecting a key opens it in KeyDetail.
 */
export const KeyGrid = () => {
  const system = useAtomValue(systemAtom);
  const issues = useAtomValue(issuesAtom);
  const [selected, setSelected] = useAtom(selectedKeyAtom);
  const [width, setWidth] = useState(0);
  const tiles = useRef<(HTMLElement | null)[]>([]);
  const count = system.keys.length;
  const columns = columnsFor(width || 640);
  const compact = columns === 8 ? width < 820 : columns === 4 && width < 440;

  const select = (i: number, focus = false) => {
    setSelected(i);
    if (focus) tiles.current[i]?.focus();
  };

  const onKeyDown = (i: number) => (e: KeyboardEvent) => {
    const moves: Record<string, number> = {
      ArrowRight: i + 1,
      ArrowLeft: i - 1,
      ArrowDown: i + columns,
      ArrowUp: i - columns,
      Home: 0,
      End: count - 1,
    };
    const next = moves[e.key];
    if (next === undefined) return;
    e.preventDefault();
    if (next >= 0 && next < count) select(next, true);
  };

  const problemsOf = (i: number) => issues.filter((x) => x.path.startsWith(`keys[${i}]`)).length;

  const rows = Array.from({ length: Math.ceil(count / columns) }, (_, r) =>
    system.keys.slice(r * columns, (r + 1) * columns).map((key, c) => ({
      key,
      index: r * columns + c,
    })),
  );
  const half = Math.ceil(count / 2);

  return (
    <YStack gap="3" onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <XStack items="baseline" justify="space-between" gap="2">
        <SizableText size="sm" fontWeight="600" render="h2">
          Keys
        </SizableText>
        <SizableText size="xs" color="color-10">
          Arrow keys move between keys
        </SizableText>
      </XStack>
      <YStack role="radiogroup" aria-label="Keys" gap="2">
        {rows.map((row) => {
          const first = row[0]?.index ?? 0;
          return (
            <YStack key={first} gap="2">
              {first === half && (
                // Where the ME-1's label strip sits between keys 1–8 and 9–16.
                <YStack h={4} mx="1" rounded="full" bg="color-3" aria-hidden />
              )}
              <XStack gap="2">
                {row.map(({ key, index }) => (
                  <Tile
                    key={index}
                    index={index}
                    keyValue={key}
                    selected={index === selected}
                    problems={problemsOf(index)}
                    compact={compact}
                    onSelect={() => select(index)}
                    onKeyDown={onKeyDown(index)}
                    tileRef={(el) => {
                      tiles.current[index] = el;
                    }}
                  />
                ))}
              </XStack>
            </YStack>
          );
        })}
      </YStack>
      <XStack gap="2" flexWrap="wrap" items="center" aria-label="Key type colours">
        {LEGEND.map((t) => (
          <TypeBadge key={t} type={t} />
        ))}
        <XStack
          items="center"
          px="1.5"
          py={2}
          rounded="full"
          borderWidth={1}
          borderStyle="dashed"
          borderColor="border-color"
        >
          <SizableText size="xs" color="color-10">
            Unassigned
          </SizableText>
        </XStack>
      </XStack>
    </YStack>
  );
};

/**
 * The 40 channels laid out as their 20 odd/even pairs: a name for each
 * channel, a link toggle that makes the pair stereo, and a hint of which keys
 * use each channel, so renaming shows its effect on the ME-1.
 */

import { CHANNEL_COUNT } from '@mcmillan/2me2u-core';
import { useAtomValue, useSetAtom } from 'jotai';
import { type KeyboardEvent, type ReactNode, useMemo } from 'react';
import { H2, Input, SizableText, Theme, XStack, YStack } from 'tamagui';
import { type Editable, isStereo, keyLabel, setChannelName, setStereo } from '../lib/edit.ts';
import { editAtom, systemAtom } from '../lib/store.ts';
import { ACCENT, DISPLAY_FONT } from '../lib/theme.ts';
import { useTextFieldError } from './FieldError.tsx';
import { Action } from './ui.tsx';

interface KeyUse {
  /** 1-based key number. */
  readonly key: number;
  readonly label: string;
}

/** For each channel (index = channel - 1), the keys that play it; a stereo reference covers both channels. */
const keyUses = (system: Editable): KeyUse[][] => {
  const uses: KeyUse[][] = Array.from({ length: CHANNEL_COUNT }, () => []);
  const add = (channel: number, use: KeyUse) => {
    const covered = isStereo(system, channel) ? [channel, channel + 1] : [channel];
    for (const c of covered) {
      const list = uses[c - 1];
      if (list && !list.some((u) => u.key === use.key)) list.push(use);
    }
  };
  system.keys.forEach((k, i) => {
    const use = { key: i + 1, label: keyLabel(system, k) };
    if (k.type === 'channel') add(k.channel, use);
    else if (k.type === 'group') for (const m of k.members) add(m.channel, use);
  });
  return uses;
};

const nameInputId = (channel: number) => `channel-name-${channel}`;

/** Enter or the arrow keys move between names, so a whole list can be typed straight through. */
const moveFocus = (channel: number) => (e: KeyboardEvent) => {
  const step =
    e.key === 'Enter' || e.key === 'ArrowDown'
      ? e.shiftKey && e.key === 'Enter'
        ? -1
        : 1
      : e.key === 'ArrowUp'
        ? -1
        : 0;
  if (step === 0) return;
  const next = document.getElementById(nameInputId(channel + step));
  if (next instanceof HTMLInputElement) {
    e.preventDefault();
    next.focus();
    next.select();
  }
};

const LinkIcon = ({ linked }: { linked: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <g stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {linked ? (
        <>
          <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
          <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
        </>
      ) : (
        <>
          <path d="M15 7h2a5 5 0 0 1 0 10h-2" />
          <path d="M9 17H7A5 5 0 0 1 7 7h2" />
          <path d="M12 4v2M12 18v2" />
        </>
      )}
    </g>
  </svg>
);

const KeyChips = ({ uses }: { uses: readonly KeyUse[] }) =>
  uses.length === 0 ? null : (
    <XStack gap="1" flexWrap="wrap" justify="flex-end" shrink={0} maxW={96}>
      {uses.map((u) => (
        <XStack
          key={u.key}
          px="1"
          rounded="sm"
          borderWidth={1}
          borderColor="border-color"
          bg="color-2"
          role="img"
          aria-label={`Used by key ${u.key}, ${u.label}`}
        >
          <SizableText size="xs" color="color-11" fontFamily={DISPLAY_FONT}>
            K{u.key}
          </SizableText>
        </XStack>
      ))}
    </XStack>
  );

/** Children in the accent theme when `on`; only the pair's chrome takes the accent, never its inputs. */
const Accent = ({ on, children }: { on: boolean; children: ReactNode }) =>
  on ? <Theme name={ACCENT}>{children}</Theme> : children;

interface RowProps {
  readonly channel: number;
  readonly name: string;
  readonly side: 'L' | 'R' | undefined;
  readonly uses: readonly KeyUse[];
}

const ChannelRow = ({ channel, name, side, uses }: RowProps) => {
  const edit = useSetAtom(editAtom);
  const path = `channels[${channel - 1}].name`;
  const { inputProps, error } = useTextFieldError(path);
  return (
    <YStack gap="0.5">
      <XStack items="center" gap="2">
        <XStack w={34} items="baseline" justify="flex-end" gap="1" shrink={0}>
          <SizableText size="sm" color="color-11" fontFamily={DISPLAY_FONT}>
            {channel}
          </SizableText>
          <Accent on={side !== undefined}>
            <SizableText
              size="xs"
              color="color-11"
              fontWeight="700"
              w={9}
              fontFamily={DISPLAY_FONT}
            >
              {side ?? ''}
            </SizableText>
          </Accent>
        </XStack>
        <Input
          id={nameInputId(channel)}
          flex={1}
          minW={0}
          size="sm"
          maxLength={6}
          placeholder={String(channel)}
          value={name}
          fontFamily={DISPLAY_FONT}
          bg="background"
          onChangeText={(next) => edit((s) => setChannelName(s, channel, next), path)}
          onKeyDown={moveFocus(channel)}
          aria-label={`Channel ${channel} name`}
          data-issue-path={path}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          enterKeyHint={channel < CHANNEL_COUNT ? 'next' : 'done'}
          {...inputProps}
        />
        <KeyChips uses={uses} />
      </XStack>
      {error && <YStack pl={42}>{error}</YStack>}
    </YStack>
  );
};

const PairCell = ({ first, uses }: { first: number; uses: readonly KeyUse[][] }) => {
  const system = useAtomValue(systemAtom);
  const edit = useSetAtom(editAtom);
  const linked = isStereo(system, first);
  const second = first + 1;
  const label = `Link channels ${first} and ${second} as a stereo pair`;
  return (
    <XStack
      position="relative"
      z={0}
      gap="2"
      p="2"
      rounded="lg"
      borderWidth={1}
      borderColor={linked ? 'transparent' : 'border-color'}
      items="stretch"
      role="group"
      aria-label={
        linked ? `Channels ${first} and ${second}, stereo` : `Channels ${first} and ${second}`
      }
      w={{ default: '100%', md: 'calc(50% - 6px)', lg: 'calc(25% - 9px)' }}
    >
      {linked ? (
        <Theme name={ACCENT}>
          <YStack
            position="absolute"
            z={-1}
            t={-1}
            l={-1}
            r={-1}
            b={-1}
            rounded="lg"
            borderWidth={1}
            borderColor="color-7"
            bg="color-2"
            aria-hidden
          />
        </Theme>
      ) : null}
      <YStack flex={1} minW={0} gap="1.5">
        <ChannelRow
          channel={first}
          name={system.channels[first - 1]?.name ?? ''}
          side={linked ? 'L' : undefined}
          uses={uses[first - 1] ?? []}
        />
        <ChannelRow
          channel={second}
          name={system.channels[second - 1]?.name ?? ''}
          side={linked ? 'R' : undefined}
          uses={uses[second - 1] ?? []}
        />
      </YStack>
      <Accent on={linked}>
        <YStack items="center" justify="center" gap="1" w={36} shrink={0}>
          <Action
            kind={linked ? 'primary' : 'ghost'}
            size="sm"
            w={32}
            h={32}
            p="0"
            aria-pressed={linked}
            aria-label={label}
            data-issue-path={`channels[${first}].stereo`}
            onPress={() => edit((s) => setStereo(s, first, !linked))}
            icon={<LinkIcon linked={linked} />}
          />
          <SizableText
            size="xs"
            fontWeight="700"
            fontFamily={DISPLAY_FONT}
            color="color-11"
            aria-hidden
          >
            {linked ? 'ST' : ''}
          </SizableText>
        </YStack>
      </Accent>
    </XStack>
  );
};

/** The Channels view: 40 names and 20 stereo links, as the ME-U holds them. */
export const ChannelList = () => {
  const system = useAtomValue(systemAtom);
  const uses = useMemo(() => keyUses(system), [system]);
  const named = system.channels.filter((c) => c.name).length;
  const pairs = system.channels.filter((c, i) => i % 2 === 0 && c.stereo).length;
  const firsts = Array.from({ length: CHANNEL_COUNT / 2 }, (_, i) => i * 2 + 1);

  return (
    <YStack gap="4">
      <XStack justify="space-between" items="flex-end" gap="3" flexWrap="wrap">
        <YStack gap="1" flex={1} flexBasis={280} minW={0} maxW={640}>
          <H2 size="xl">Channels</H2>
          <SizableText size="sm" color="color-10">
            Names and stereo pairs come from the ME-U; the ME-1 shows them on its keys. Enter or ↓
            moves to the next name.
          </SizableText>
        </YStack>
        <SizableText size="sm" color="color-11" fontFamily={DISPLAY_FONT}>
          {named} named · {pairs} stereo {pairs === 1 ? 'pair' : 'pairs'}
        </SizableText>
      </XStack>
      <XStack gap="3" flexWrap="wrap">
        {firsts.map((first) => (
          <PairCell key={first} first={first} uses={uses} />
        ))}
      </XStack>
    </YStack>
  );
};

import { useAtomValue, useSetAtom } from 'jotai';
import { type KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Input, SizableText, type TamaguiElement, Theme, XStack, YStack } from 'tamagui';
import type { Editable } from '../lib/edit.ts';
import { selectableChannels, setMemberLevel, toggleMember } from '../lib/edit.ts';
import { editAtom, systemAtom } from '../lib/store.ts';
import { ACCENT, DISPLAY_FONT } from '../lib/theme.ts';
import { Fader } from './Fader.tsx';
import { Action } from './ui.tsx';

export interface MemberPickerProps {
  /** The group key being edited (0-based). */
  readonly index: number;
}

/** "7" or "7+8" for a stereo pair referenced by its first channel. */
const numbersOf = (system: Editable, channel: number): string =>
  system.channels[channel - 1]?.stereo ? `${channel}+${channel + 1}` : String(channel);

/** For each channel in another group, the label of that group ("DRUMS", or "key 5" if unnamed). */
const otherGroups = (system: Editable, index: number): Map<number, string> =>
  new Map(
    system.keys.flatMap((k, i) =>
      i !== index && k.type === 'group'
        ? k.members.map((m): [number, string] => [m.channel, k.name || `key ${i + 1}`])
        : [],
    ),
  );

interface Option {
  readonly channel: number;
  readonly name: string;
  readonly numbers: string;
  readonly stereo: boolean;
  /** Why it can't be added, if it can't. */
  readonly blocked?: string;
}

const matches = (option: Option, query: string): boolean => {
  const q = query.trim().toLowerCase();
  if (q === '') return true;
  return (
    option.name.toLowerCase().includes(q) ||
    option.numbers.split('+').some((n) => n.startsWith(q.replace(/^ch\s*/, '')))
  );
};

const StereoBadge = () => (
  <XStack px="1" rounded="sm" borderWidth={1} borderColor="border-color" aria-hidden>
    <SizableText size="xs" color="color-10">
      ST
    </SizableText>
  </XStack>
);

/** How a screen reader should announce a channel: "KitPad 7+8 stereo". */
const spokenName = ({ name, numbers, stereo }: Omit<Option, 'channel'>): string =>
  `${name || 'Channel'} ${numbers}${stereo ? ' stereo' : ''}`;

/** A channel's display name and number(s), as the ME-1 would show it. */
const ChannelName = ({ name, numbers, stereo }: Omit<Option, 'channel'>) => (
  <XStack items="center" gap="1.5" minW={0} shrink={1}>
    <SizableText
      size="sm"
      fontFamily={DISPLAY_FONT}
      fontWeight="600"
      color={name ? 'color' : 'color-10'}
      numberOfLines={1}
    >
      {name || '—'}
    </SizableText>
    <SizableText size="xs" color="color-10" fontFamily={DISPLAY_FONT}>
      {numbers}
    </SizableText>
    {stereo && <StereoBadge />}
  </XStack>
);

/** The group's members, each with a level and a remove button, plus a searchable list to add channels. */
export const MemberPicker = ({ index }: MemberPickerProps) => {
  const system = useAtomValue(systemAtom);
  const edit = useSetAtom(editAtom);
  const key = system.keys[index];

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<TamaguiElement>(null);
  const toggleRef = useRef<TamaguiElement>(null);
  const id = useId();
  // The toggle remounts when its theme changes, so focus it after the render that closes the list.
  const refocus = useRef(false);
  useEffect(() => {
    if (!open && refocus.current) {
      refocus.current = false;
      (toggleRef.current as HTMLElement | null)?.focus();
    }
  }, [open]);

  const members = key?.type === 'group' ? key.members : [];

  const options = useMemo((): Option[] => {
    const taken = otherGroups(system, index);
    const chosen = new Set(members.map((m) => m.channel));
    return selectableChannels(system)
      .filter((n) => !chosen.has(n))
      .map((n) => {
        const group = taken.get(n);
        return {
          channel: n,
          name: system.channels[n - 1]?.name ?? '',
          numbers: numbersOf(system, n),
          stereo: system.channels[n - 1]?.stereo === true,
          ...(group === undefined ? {} : { blocked: `in ${group}` }),
        };
      });
  }, [system, index, members]);

  if (key?.type !== 'group') return null;

  // Channels that can be added first; those held by other groups after, so the list leads with choices.
  const shown = options
    .filter((o) => matches(o, query))
    .sort((a, b) => Number(!!a.blocked) - Number(!!b.blocked));
  const enabled = shown.filter((o) => !o.blocked);
  const activeOption = enabled[Math.min(active, enabled.length - 1)];
  const optionId = (channel: number) => `${id}-ch${channel}`;

  const add = (channel: number) => {
    edit((s) => toggleMember(s, index, channel));
    (inputRef.current as HTMLElement | null)?.focus();
  };

  const close = () => {
    setOpen(false);
    setQuery('');
    setActive(0);
    refocus.current = true;
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, enabled.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActive(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setActive(enabled.length - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeOption) add(activeOption.channel);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  };

  const prominent = members.length === 0 && !open;
  const addToggle = (
    <Action
      ref={toggleRef}
      kind={prominent ? 'primary' : 'subtle'}
      self="flex-start"
      onPress={() => (open ? close() : setOpen(true))}
      aria-expanded={open}
      aria-controls={open ? `${id}-panel` : undefined}
    >
      {open ? 'Done' : '+ Add channels'}
    </Action>
  );

  return (
    <YStack gap="2">
      {members.length === 0 ? (
        <SizableText size="sm" color="color-10">
          No channels yet. Add the channels this key should bring up together.
        </SizableText>
      ) : (
        <YStack
          role="list"
          aria-label={`Key ${index + 1} members`}
          borderWidth={1}
          borderColor="border-color"
          rounded="md"
          overflow="hidden"
        >
          {members.map((m, i) => {
            const name = system.channels[m.channel - 1]?.name ?? '';
            const stereo = system.channels[m.channel - 1]?.stereo === true;
            const numbers = numbersOf(system, m.channel);
            const spoken = spokenName({ name, numbers, stereo });
            return (
              <XStack
                key={m.channel}
                role="listitem"
                data-issue-path={`keys[${index}].members[${i}]`}
                items="center"
                gap="2"
                px="2"
                py="1.5"
                flexWrap="wrap"
                borderColor="border-color"
                borderTopWidth={i === 0 ? 0 : 1}
              >
                <XStack flex={1} flexBasis={110} minW={0}>
                  <ChannelName name={name} numbers={numbers} stereo={stereo} />
                </XStack>
                <XStack items="center" gap="1" flex={2} flexBasis={240} minW={0}>
                  <YStack flex={1} minW={0} data-issue-path={`keys[${index}].members[${i}].level`}>
                    <Fader
                      compact
                      value={m.level}
                      onChange={(level) => edit((s) => setMemberLevel(s, index, m.channel, level))}
                      label={`${spoken} level in key ${index + 1}`}
                    />
                  </YStack>
                  <Action
                    kind="ghost"
                    px="2"
                    onPress={() => edit((s) => toggleMember(s, index, m.channel))}
                    aria-label={`Remove ${spoken} from key ${index + 1}`}
                  >
                    ×
                  </Action>
                </XStack>
              </XStack>
            );
          })}
        </YStack>
      )}

      {prominent ? (
        <Theme key="primary" name={ACCENT}>
          {addToggle}
        </Theme>
      ) : (
        addToggle
      )}

      {open && (
        <YStack
          id={`${id}-panel`}
          gap="1.5"
          p="2"
          rounded="md"
          borderWidth={1}
          borderColor="border-color"
          bg="color-1"
        >
          <Input
            ref={inputRef}
            size="sm"
            autoFocus
            value={query}
            placeholder="Search by name or number"
            onChangeText={(q) => {
              setQuery(q);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            role="combobox"
            aria-label="Search channels to add"
            aria-expanded
            aria-controls={`${id}-list`}
            aria-autocomplete="list"
            aria-activedescendant={activeOption ? optionId(activeOption.channel) : undefined}
          />
          <div
            id={`${id}-list`}
            role="listbox"
            aria-label="Channels"
            style={{ maxHeight: 260, overflowY: 'auto' }}
          >
            {shown.length === 0 && (
              <SizableText size="sm" color="color-10" p="2">
                {options.length === 0 ? 'Every channel is in this group.' : 'No matching channels.'}
              </SizableText>
            )}
            {shown.map((o) => {
              const isActive = o === activeOption;
              return (
                <XStack
                  key={o.channel}
                  id={optionId(o.channel)}
                  role="option"
                  aria-selected={isActive}
                  aria-label={`${spokenName(o)}${o.blocked ? `, ${o.blocked}` : ''}`}
                  aria-disabled={o.blocked ? true : undefined}
                  items="center"
                  justify="space-between"
                  gap="2"
                  px="2"
                  py="1.5"
                  rounded="sm"
                  cursor={o.blocked ? 'not-allowed' : 'pointer'}
                  opacity={o.blocked ? 0.7 : 1}
                  bg={
                    isActive
                      ? 'color-3'
                      : o.blocked
                        ? 'transparent'
                        : { default: 'transparent', hover: 'color-2' }
                  }
                  onMouseDown={(e: { preventDefault: () => void }) => e.preventDefault()}
                  onPress={() => {
                    if (o.blocked) return;
                    setActive(enabled.indexOf(o));
                    add(o.channel);
                  }}
                >
                  <ChannelName name={o.name} numbers={o.numbers} stereo={o.stereo} />
                  {o.blocked && (
                    <SizableText size="xs" color="color-10" numberOfLines={1} shrink={0}>
                      {o.blocked}
                    </SizableText>
                  )}
                </XStack>
              );
            })}
          </div>
        </YStack>
      )}
    </YStack>
  );
};

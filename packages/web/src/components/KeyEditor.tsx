import type { Key } from '@mcmillan/2me2u-core';
import { useAtomValue, useSetAtom } from 'jotai';
import { Checkbox, Input, Select, SizableText, XStack, YStack } from 'tamagui';
import {
  channelLabel,
  type Editable,
  type EditableKeyType,
  keyLabel,
  selectableChannels,
  setKeyChannel,
  setKeyLevel,
  setKeyName,
  setKeyType,
  toggleMember,
} from '../lib/edit.ts';
import { editAtom, systemAtom } from '../lib/store.ts';
import { LevelInput } from './LevelInput.tsx';

const TYPES: readonly { value: EditableKeyType; label: string }[] = [
  { value: 'unassigned', label: 'Unassigned' },
  { value: 'auto', label: 'Auto' },
  { value: 'channel', label: 'Channel' },
  { value: 'group', label: 'Group' },
];

/** Channels claimed by other groups, which the ME-1 won't let this group take. */
const takenByOtherGroups = (system: Editable, index: number): Set<number> =>
  new Set(
    system.keys.flatMap((k, i) =>
      i !== index && k.type === 'group' ? k.members.map((m) => m.channel) : [],
    ),
  );

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <XStack items="center" gap="2">
    <SizableText size="xs" color="color-10" w={56}>
      {label}
    </SizableText>
    {children}
  </XStack>
);

/** A Tamagui select over a small fixed list of options. */
const Picker = <T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  label: string;
}) => (
  <Select value={value} onValueChange={(v) => onChange(v as T)} size="sm">
    <Select.Trigger flex={1} aria-label={label}>
      <Select.Value placeholder={label} />
    </Select.Trigger>
    <Select.Content>
      <Select.Viewport>
        {options.map((o) => (
          <Select.Item key={o.value} value={o.value}>
            <Select.ItemText>{o.label}</Select.ItemText>
          </Select.Item>
        ))}
      </Select.Viewport>
    </Select.Content>
  </Select>
);

export const KeyEditor = ({ index, key_: key }: { index: number; key_: Key }) => {
  const system = useAtomValue(systemAtom);
  const edit = useSetAtom(editAtom);
  const channels = selectableChannels(system);

  return (
    <YStack
      gap="2"
      p="3"
      borderWidth={1}
      borderColor="border-color"
      rounded="md"
      flexBasis={300}
      grow={1}
    >
      <XStack items="center" gap="2">
        <SizableText size="sm" color="color-10" w={20}>
          {index + 1}
        </SizableText>
        {key.type === 'unknown' ? (
          <SizableText size="sm" color="color-10">
            Unknown source (flags 0x{key.flags.toString(16)})
          </SizableText>
        ) : (
          <Picker
            label={`Key ${index + 1} type`}
            value={key.type}
            options={TYPES}
            onChange={(type) => edit((s) => setKeyType(s, index, type))}
          />
        )}
        <SizableText fontWeight="600" ml="auto">
          {keyLabel(system, key)}
        </SizableText>
      </XStack>

      {key.type === 'channel' && (
        <Field label="Channel">
          <Picker
            label={`Key ${index + 1} channel`}
            value={String(key.channel)}
            options={channels.map((n) => ({ value: String(n), label: channelLabel(system, n) }))}
            onChange={(v) => edit((s) => setKeyChannel(s, index, Number(v)))}
          />
        </Field>
      )}

      {(key.type === 'channel' || key.type === 'group') && (
        <Field label="Label">
          <Input
            flex={1}
            size="sm"
            maxLength={6}
            value={key.name ?? ''}
            placeholder={key.type === 'channel' ? 'channel name' : 'Group'}
            onChangeText={(name) => edit((s) => setKeyName(s, index, name))}
            aria-label={`Key ${index + 1} label`}
          />
        </Field>
      )}

      {key.type !== 'unassigned' && key.type !== 'unknown' && (
        <Field label="Level">
          <LevelInput
            value={key.level}
            onChange={(level) => edit((s) => setKeyLevel(s, index, level))}
          />
        </Field>
      )}

      {key.type === 'group' && (
        <XStack flexWrap="wrap" gap="1.5" pt="1">
          {(() => {
            const taken = takenByOtherGroups(system, index);
            const chosen = new Set(key.members.map((m) => m.channel));
            return channels.map((n) => {
              const blocked = taken.has(n) && !chosen.has(n);
              return (
                <XStack key={n} items="center" gap="1.5" w={140} opacity={blocked ? 0.5 : 1}>
                  <Checkbox
                    size="xs"
                    checked={chosen.has(n)}
                    disabled={blocked}
                    onCheckedChange={() => edit((s) => toggleMember(s, index, n))}
                    aria-label={channelLabel(system, n)}
                  >
                    <Checkbox.Indicator>
                      <SizableText size="xs" lineHeight={12}>
                        ✓
                      </SizableText>
                    </Checkbox.Indicator>
                  </Checkbox>
                  <SizableText size="xs" numberOfLines={1}>
                    {channelLabel(system, n)}
                  </SizableText>
                </XStack>
              );
            });
          })()}
        </XStack>
      )}
    </YStack>
  );
};

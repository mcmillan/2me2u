import type { Key } from '@mcmillan/2me2u-core';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { type ReactNode, useId } from 'react';
import { Input, Select, SizableText, Theme, XStack, YStack } from 'tamagui';
import {
  channelLabel,
  type EditableKeyType,
  keyLabel,
  selectableChannels,
  setKeyChannel,
  setKeyLevel,
  setKeyName,
  setKeyType,
} from '../lib/edit.ts';
import { editAtom, selectedKeyAtom, systemAtom } from '../lib/store.ts';
import { DISPLAY_FONT, KEY_TYPE_LABEL, KEY_TYPE_THEME } from '../lib/theme.ts';
import { Fader } from './Fader.tsx';
import { FieldError, useTextFieldError } from './FieldError.tsx';
import { TypeBadge } from './KeyGrid.tsx';
import { MemberPicker } from './MemberPicker.tsx';
import { Panel } from './Panel.tsx';
import { Action } from './ui.tsx';

const TYPES: readonly EditableKeyType[] = ['unassigned', 'auto', 'channel', 'group'];

/** A labelled field with optional helper text and the field's problem underneath. */
const Field = ({
  label,
  htmlFor,
  helper,
  helperId,
  path,
  error,
  children,
}: {
  label: string;
  htmlFor?: string;
  helper?: string;
  helperId?: string;
  path: string;
  /** The field's own error, for text fields that time it with `useTextFieldError`. */
  error?: ReactNode;
  children: ReactNode;
}) => (
  <YStack gap="1.5">
    <SizableText
      size="xs"
      fontWeight="600"
      color="color-11"
      render="label"
      {...(htmlFor ? { htmlFor } : {})}
    >
      {label}
    </SizableText>
    {children}
    {helper && (
      <SizableText size="xs" color="color-10" {...(helperId ? { id: helperId } : {})}>
        {helper}
      </SizableText>
    )}
    {error === undefined ? <FieldError path={path} /> : error}
  </YStack>
);

/** The label as the ME-1's display shows it. */
const LabelPreview = ({ text, muted }: { text: string; muted: boolean }) => (
  <XStack
    px="2.5"
    py="1"
    rounded="md"
    bg="color-2"
    borderWidth={1}
    borderColor="border-color"
    minW={96}
    justify="center"
    aria-label={`The ME-1 shows ${text}`}
  >
    <SizableText
      size="2xl"
      fontFamily={DISPLAY_FONT}
      fontWeight="600"
      letterSpacing={1}
      color={muted ? 'color-8' : 'color'}
      numberOfLines={1}
    >
      {text}
    </SizableText>
  </XStack>
);

const TypeSwitch = ({ index, key_: key }: { index: number; key_: Key }) => {
  const edit = useSetAtom(editAtom);
  return (
    <XStack
      role="group"
      aria-label={`Key ${index + 1} type`}
      p="1"
      gap="1"
      rounded="lg"
      bg="color-2"
      flexWrap="wrap"
    >
      {TYPES.map((t) => {
        const on = key.type === t;
        return (
          <Theme key={t} name={KEY_TYPE_THEME[t] ?? null}>
            <Action
              kind="ghost"
              selected={on}
              aria-pressed={on}
              flex={1}
              minW={0}
              px="1.5"
              gap="1.5"
              borderColor={on ? 'color-7' : 'transparent'}
              onPress={() => edit((s) => setKeyType(s, index, t))}
            >
              {t !== 'unassigned' && <YStack w={8} h={8} rounded="full" bg="color-9" />}
              <SizableText
                size="sm"
                fontWeight={on ? '700' : '500'}
                color={on ? 'color' : 'color-11'}
              >
                {KEY_TYPE_LABEL[t]}
              </SizableText>
            </Action>
          </Theme>
        );
      })}
    </XStack>
  );
};

const ChannelSelect = ({ index, channel }: { index: number; channel: number }) => {
  const system = useAtomValue(systemAtom);
  const edit = useSetAtom(editAtom);
  const options = selectableChannels(system);
  // Keep a channel the key already has, even if it isn't offered, so the field shows it.
  const all = options.includes(channel) ? options : [...options, channel].sort((a, b) => a - b);
  return (
    <Select
      value={String(channel)}
      onValueChange={(v) => edit((s) => setKeyChannel(s, index, Number(v)))}
      size="sm"
    >
      <Select.Trigger
        aria-label={`Key ${index + 1} channel`}
        data-issue-path={`keys[${index}].channel`}
      >
        <Select.Value placeholder="Choose a channel" />
      </Select.Trigger>
      <Select.Content>
        <Select.Viewport maxH={320}>
          {all.map((n) => (
            <Select.Item key={n} value={String(n)}>
              <Select.ItemText>{channelLabel(system, n)}</Select.ItemText>
            </Select.Item>
          ))}
        </Select.Viewport>
      </Select.Content>
    </Select>
  );
};

const LabelField = ({
  index,
  value,
  placeholder,
  helper,
}: {
  index: number;
  value: string;
  placeholder: string;
  helper: string;
}) => {
  const edit = useSetAtom(editAtom);
  const id = useId();
  const path = `keys[${index}].name`;
  const { inputProps, error } = useTextFieldError(path, `${id}-help`);
  return (
    <Field
      label="Label"
      htmlFor={id}
      helper={helper}
      helperId={`${id}-help`}
      path={path}
      error={error}
    >
      <Input
        id={id}
        size="sm"
        maxLength={6}
        pattern="[0-9A-Za-z ]{1,6}"
        value={value}
        placeholder={placeholder}
        fontFamily={DISPLAY_FONT}
        onChangeText={(name) => edit((s) => setKeyName(s, index, name), path)}
        data-issue-path={path}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
        enterKeyHint="done"
        {...inputProps}
      />
    </Field>
  );
};

/** Editor for the selected key. */
export const KeyDetail = () => {
  const system = useAtomValue(systemAtom);
  const edit = useSetAtom(editAtom);
  const [index, setIndex] = useAtom(selectedKeyAtom);
  const key = system.keys[index];
  if (!key) return null;
  const n = index + 1;
  const count = system.keys.length;

  const level =
    key.type === 'auto' || key.type === 'channel' || key.type === 'group' ? (
      <Field
        label={key.type === 'group' ? 'Group master level' : 'Level'}
        path={`keys[${index}].level`}
      >
        <YStack data-issue-path={`keys[${index}].level`}>
          <Fader
            value={key.level}
            onChange={(l) => edit((s) => setKeyLevel(s, index, l), `keys[${index}].level`)}
            label={`Key ${n} ${key.type === 'group' ? 'master level' : 'level'}`}
          />
        </YStack>
      </Field>
    ) : null;

  const channelName =
    key.type === 'channel' ? system.channels[key.channel - 1]?.name || String(key.channel) : '';

  return (
    <Panel render="section" aria-label={`Key ${n}`} gap="4" data-issue-path={`keys[${index}]`}>
      <XStack items="center" justify="space-between" gap="3" flexWrap="wrap">
        <YStack gap="1">
          <SizableText size="lg" fontWeight="700" render="h2">
            Key {n}
          </SizableText>
          <TypeBadge type={key.type} />
        </YStack>
        <LabelPreview text={keyLabel(system, key)} muted={key.type === 'unassigned'} />
      </XStack>

      {key.type === 'unknown' ? (
        <Theme name="red">
          <YStack p="3" rounded="md" bg="color-2" borderWidth={1} borderColor="color-6">
            <SizableText size="sm" color="color-11">
              A source this editor doesn’t cover, such as Aux Input; it’s kept as-is.
            </SizableText>
          </YStack>
        </Theme>
      ) : (
        <TypeSwitch index={index} key_={key} />
      )}

      {key.type === 'unassigned' && (
        <SizableText size="sm" color="color-10">
          This key plays nothing. Choose a type above to give it a source.
        </SizableText>
      )}

      {key.type === 'auto' && (
        <>
          <SizableText size="sm" color="color-11">
            In Auto Mode the key takes the first channel that no other key or group uses, so it
            follows whatever is left over.
          </SizableText>
          {level}
        </>
      )}

      {key.type === 'channel' && (
        <>
          <Field label="Channel" path={`keys[${index}].channel`}>
            <ChannelSelect index={index} channel={key.channel} />
          </Field>
          <LabelField
            index={index}
            value={key.name ?? ''}
            placeholder={channelName}
            helper="Leave empty to show the channel name"
          />
          {level}
        </>
      )}

      {key.type === 'group' && (
        <>
          <LabelField
            index={index}
            value={key.name ?? ''}
            placeholder="Group"
            helper="Up to 6 letters, numbers or spaces"
          />
          {level}
          <YStack gap="1.5">
            <SizableText size="xs" fontWeight="600" color="color-11">
              Members
            </SizableText>
            <MemberPicker index={index} />
          </YStack>
        </>
      )}

      <XStack justify="space-between" gap="2" pt="3" borderTopWidth={1} borderColor="border-color">
        <Action
          kind="ghost"
          disabled={index === 0}
          onPress={() => index > 0 && setIndex(index - 1)}
          aria-label={index > 0 ? `Previous: key ${index}` : 'Previous key'}
        >
          ‹ {index > 0 ? `Key ${index}` : 'Previous'}
        </Action>
        <Action
          kind="ghost"
          disabled={index === count - 1}
          onPress={() => index < count - 1 && setIndex(index + 1)}
          aria-label={index < count - 1 ? `Next: key ${index + 2}` : 'Next key'}
        >
          {index < count - 1 ? `Key ${index + 2}` : 'Next'} ›
        </Action>
      </XStack>
    </Panel>
  );
};

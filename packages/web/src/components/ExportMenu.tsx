import { useAtomValue, useSetAtom } from 'jotai';
import { useEffect, useId, useRef, useState } from 'react';
import { SizableText, type TamaguiElement, Theme, XStack, YStack } from 'tamagui';
import { download } from '../lib/files.ts';
import {
  configNameAtom,
  issuesAtom,
  markSavedAtom,
  me1Atom,
  meuAtom,
  toastAtom,
} from '../lib/store.ts';
import { ACCENT, DISPLAY_FONT } from '../lib/theme.ts';
import { Action } from './ui.tsx';

const MEU_NAME = 'ChannelSetup.meu';

interface RowProps {
  readonly title: string;
  readonly file: string;
  readonly hint?: string;
  readonly disabled: boolean;
  /** Why this row in particular can't be used, shown under it. */
  readonly reason?: string | undefined;
  readonly onPress: () => void;
}

const Row = ({ title, file, hint, disabled, reason, onPress }: RowProps) => {
  return (
    <YStack
      role="menuitem"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      gap="0.5"
      px="3"
      py="2.5"
      rounded="md"
      cursor={disabled ? 'not-allowed' : 'pointer'}
      bg={disabled ? 'transparent' : { default: 'transparent', hover: 'color-2', focus: 'color-2' }}
      onPress={disabled ? undefined : onPress}
      onKeyDown={(e) => {
        if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onPress();
        }
      }}
    >
      <XStack
        items="baseline"
        justify="space-between"
        gap="3"
        flexWrap="wrap"
        opacity={disabled ? 0.5 : 1}
      >
        <SizableText size="sm" fontWeight="600">
          {title}
        </SizableText>
        <SizableText size="xs" fontFamily={DISPLAY_FONT} color="color-11">
          {file}
        </SizableText>
      </XStack>
      {hint && (
        <SizableText size="xs" color="color-10" opacity={disabled ? 0.5 : 1}>
          {hint}
        </SizableText>
      )}
      {reason && (
        <SizableText size="xs" fontWeight="600" color="color-11">
          {reason}
        </SizableText>
      )}
    </YStack>
  );
};

/** Export button and menu for the .ME1 and .meu. */
export const ExportMenu = () => {
  const [open, setOpen] = useState(false);
  const me1 = useAtomValue(me1Atom);
  const meu = useAtomValue(meuAtom);
  const issues = useAtomValue(issuesAtom);
  const configName = useAtomValue(configNameAtom);
  const markSaved = useSetAtom(markSavedAtom);
  const toast = useSetAtom(toastAtom);
  const root = useRef<TamaguiElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    // On the web a Tamagui view is its DOM element.
    const el = root.current as unknown as HTMLElement | null;
    const close = (e: PointerEvent) => {
      if (el && !el.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      el?.querySelector<HTMLElement>('[aria-haspopup]')?.focus();
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', onKey);
    // Move focus into the menu so keyboard users land on the first row.
    el?.querySelector<HTMLElement>('[role=menuitem][tabindex="0"]')?.focus();
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const save = (data: Uint8Array | string, name: string, type: string) => {
    download(data, name, type);
    markSaved();
    toast({ message: `Saved ${name}`, tone: 'success' });
    setOpen(false);
  };

  const blocked =
    issues.length > 0
      ? `Fix ${issues.length} ${issues.length === 1 ? 'problem' : 'problems'} first`
      : undefined;
  const me1Name = `${configName}.ME1`;
  const unnamed = configName === '';

  return (
    <YStack ref={root} position="relative">
      <Theme name={ACCENT}>
        <Action
          kind="primary"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={open ? menuId : undefined}
          onPress={() => setOpen((o) => !o)}
        >
          Export ▾
        </Action>
      </Theme>
      {open && (
        <YStack
          id={menuId}
          role="menu"
          aria-label="Export"
          position="absolute"
          t="100%"
          r={0}
          mt="1.5"
          z={50}
          w={340}
          maxW="calc(100vw - 32px)"
          p="1.5"
          gap="1"
          rounded="lg"
          bg="background"
          borderWidth={1}
          borderColor="border-color"
          shadowColor="shadow-color"
          shadowRadius={16}
          shadowOffset={{ width: 0, height: 6 }}
        >
          {blocked && (
            <Theme name="red">
              <YStack px="3" py="2" rounded="md" bg="color-2" gap="0.5" role="note">
                <SizableText size="sm" fontWeight="700" color="color-11">
                  {blocked}
                </SizableText>
                <SizableText size="xs" color="color-11">
                  The ME-1 wouldn’t accept this system yet.
                </SizableText>
              </YStack>
            </Theme>
          )}
          <Row
            title="Config for the ME-1"
            file={me1Name}
            hint="Copy to the ME1CFG folder on the USB stick."
            disabled={blocked !== undefined || unnamed}
            reason={unnamed ? 'Give the config a name first' : undefined}
            onPress={() => {
              if (me1.isOk && !unnamed) save(me1.value, me1Name, 'application/octet-stream');
            }}
          />
          <Row
            title="Channel setup for the ME-U"
            file={MEU_NAME}
            disabled={blocked !== undefined || meu.isErr}
            onPress={() => {
              if (meu.isOk) save(meu.value, MEU_NAME, 'application/json');
            }}
          />
        </YStack>
      )}
    </YStack>
  );
};

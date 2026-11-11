import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useState } from 'react';
import { Input, SizableText, Theme, XStack, YStack } from 'tamagui';
import {
  canRedoAtom,
  canUndoAtom,
  configNameAtom,
  dirtyAtom,
  redoAtom,
  resetAtom,
  undoAtom,
  type View,
  viewAtom,
} from '../lib/store.ts';
import { ACCENT, DISPLAY_FONT } from '../lib/theme.ts';
import { ConfirmDialog } from './ConfirmDialog.tsx';
import { ExportMenu } from './ExportMenu.tsx';
import { ProblemsButton } from './ProblemsButton.tsx';
import { Action } from './ui.tsx';

export const Brand = () => (
  <XStack items="center" gap="2">
    <Theme name={ACCENT}>
      <YStack w={28} h={28} rounded="md" bg="color-8" items="center" justify="center">
        <SizableText size="sm" fontWeight="800" color="background">
          2
        </SizableText>
      </YStack>
    </Theme>
    <SizableText size="lg" fontWeight="700">
      2me2u
    </SizableText>
  </XStack>
);

const VIEWS: readonly { value: View; label: string }[] = [
  { value: 'keys', label: 'Keys' },
  { value: 'channels', label: 'Channels' },
];

const ViewSwitch = () => {
  const [view, setView] = useAtom(viewAtom);
  return (
    <XStack role="tablist" aria-label="View" p="1" gap="1" rounded="lg" bg="color-2">
      {VIEWS.map((v) => (
        <Action
          key={v.value}
          role="tab"
          aria-selected={view === v.value}
          kind="ghost"
          selected={view === v.value}
          onPress={() => setView(v.value)}
        >
          {v.label}
        </Action>
      ))}
    </XStack>
  );
};

const ConfigName = () => {
  const [configName, setConfigName] = useAtom(configNameAtom);
  const dirty = useAtomValue(dirtyAtom);
  return (
    <XStack items="center" gap="2">
      <Input
        size="sm"
        w={116}
        maxLength={8}
        pattern="[0-9A-Z_\-]{0,8}"
        value={configName}
        fontFamily={DISPLAY_FONT}
        onChangeText={(v) => setConfigName(v.toUpperCase().replace(/[^0-9A-Z_-]/g, ''))}
        aria-label="Config name, up to 8 characters; the ME-1 shows it as the config's name"
        autoComplete="off"
        autoCorrect="off"
        // Tamagui maps autoCapitalize="characters" to "off"; set the attribute itself.
        ref={(el) => {
          if (el instanceof HTMLElement) el.setAttribute('autocapitalize', 'characters');
        }}
        spellCheck={false}
        enterKeyHint="done"
      />
      {dirty && (
        <Theme name={ACCENT}>
          <XStack items="center" gap="1.5" aria-live="polite">
            <YStack w={8} h={8} rounded="full" bg="color-8" />
            <SizableText size="xs" color="color-10">
              Unsaved changes
            </SizableText>
          </XStack>
        </Theme>
      )}
    </XStack>
  );
};

const ArrowIcon = ({ flip }: { flip?: boolean }) => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
    style={flip ? { transform: 'scaleX(-1)' } : undefined}
  >
    <path
      d="M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const History = () => {
  const undo = useSetAtom(undoAtom);
  const redo = useSetAtom(redoAtom);
  const canUndo = useAtomValue(canUndoAtom);
  const canRedo = useAtomValue(canRedoAtom);
  return (
    <XStack gap="1">
      <Action kind="ghost" disabled={!canUndo} onPress={undo} aria-label="Undo (⌘Z)">
        <ArrowIcon />
      </Action>
      <Action kind="ghost" disabled={!canRedo} onPress={redo} aria-label="Redo (⇧⌘Z)">
        <ArrowIcon flip />
      </Action>
    </XStack>
  );
};

const NewButton = () => {
  const reset = useSetAtom(resetAtom);
  const dirty = useAtomValue(dirtyAtom);
  const [confirming, setConfirming] = useState(false);
  return (
    <>
      <Action kind="ghost" onPress={() => (dirty ? setConfirming(true) : reset())}>
        New
      </Action>
      <ConfirmDialog
        open={confirming}
        title="Start a new system?"
        confirmLabel="Discard changes"
        onClose={(confirmed) => {
          setConfirming(false);
          if (confirmed) reset();
        }}
      >
        Your unsaved changes will be lost.
      </ConfirmDialog>
    </>
  );
};

/**
 * Two groups that wrap onto separate rows on narrow screens: identity (brand,
 * config name) and actions. Each is capped at the bar's width so nothing
 * pushes the page wider than the screen.
 */
export const TopBar = () => (
  <XStack
    render="header"
    position="sticky"
    t={0}
    z={10}
    items="center"
    justify="space-between"
    gap="3"
    rowGap="2"
    px="4"
    py="2.5"
    flexWrap="wrap"
    bg="background"
    borderBottomWidth={1}
    borderColor="border-color"
  >
    <XStack items="center" gap="3" maxW="100%" flexWrap="wrap" rowGap="2">
      <Brand />
      <ConfigName />
    </XStack>
    <XStack items="center" gap="2" maxW="100%" flexWrap="wrap" rowGap="2" ml="auto">
      <ViewSwitch />
      <History />
      <NewButton />
      <ProblemsButton />
      <ExportMenu />
    </XStack>
  </XStack>
);

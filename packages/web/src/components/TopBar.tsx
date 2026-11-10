import { useAtom, useAtomValue, useSetAtom } from 'jotai';
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
        value={configName}
        fontFamily={DISPLAY_FONT}
        onChangeText={(v) => setConfigName(v.toUpperCase().replace(/[^0-9A-Z_-]/g, ''))}
        aria-label="Config name, up to 8 characters; the ME-1 shows it as the config's name"
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

const History = () => {
  const undo = useSetAtom(undoAtom);
  const redo = useSetAtom(redoAtom);
  const canUndo = useAtomValue(canUndoAtom);
  const canRedo = useAtomValue(canRedoAtom);
  return (
    <XStack gap="1">
      <Action kind="ghost" disabled={!canUndo} onPress={undo} aria-label="Undo (⌘Z)">
        ↶
      </Action>
      <Action kind="ghost" disabled={!canRedo} onPress={redo} aria-label="Redo (⇧⌘Z)">
        ↷
      </Action>
    </XStack>
  );
};

const NewButton = () => {
  const reset = useSetAtom(resetAtom);
  const dirty = useAtomValue(dirtyAtom);
  return (
    <Action
      kind="ghost"
      onPress={() => {
        if (!dirty || window.confirm('Discard your unsaved changes and start a new system?')) {
          reset();
        }
      }}
    >
      New
    </Action>
  );
};

export const TopBar = () => (
  <XStack
    render="header"
    position="sticky"
    t={0}
    z={10}
    items="center"
    gap="3"
    px="4"
    py="2.5"
    flexWrap="wrap"
    bg="background"
    borderBottomWidth={1}
    borderColor="border-color"
  >
    <Brand />
    <ConfigName />
    <XStack items="center" gap="2" ml="auto" flexWrap="wrap">
      <ViewSwitch />
      <History />
      <NewButton />
      <ProblemsButton />
      <ExportMenu />
    </XStack>
  </XStack>
);

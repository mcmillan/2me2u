import { useAtomValue, useSetAtom } from 'jotai';
import { useId } from 'react';
import { SizableText, Theme, XStack, YStack } from 'tamagui';
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
import { Menu, MenuItem } from './Menu.tsx';
import { Action } from './ui.tsx';

const MEU_NAME = 'ChannelSetup.meu';

interface RowProps {
  readonly title: string;
  readonly file: string;
  readonly hint?: string;
  readonly disabled: boolean;
  /** Why this row in particular can't be used, shown under it. */
  readonly reason?: string | undefined;
  /** The id of the note that explains why the row is disabled. */
  readonly describedBy?: string | undefined;
  readonly onSelect: () => void;
}

const Row = ({ title, file, hint, disabled, reason, describedBy, onSelect }: RowProps) => {
  return (
    <MenuItem
      disabled={disabled}
      onSelect={onSelect}
      aria-describedby={describedBy}
      gap="0.5"
      px="3"
      py="2.5"
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
    </MenuItem>
  );
};

/** Export button and menu for the .ME1 and .meu. */
export const ExportMenu = () => {
  const me1 = useAtomValue(me1Atom);
  const meu = useAtomValue(meuAtom);
  const issues = useAtomValue(issuesAtom);
  const configName = useAtomValue(configNameAtom);
  const markSaved = useSetAtom(markSavedAtom);
  const toast = useSetAtom(toastAtom);

  const save = (data: Uint8Array | string, name: string, type: string) => {
    download(data, name, type);
    markSaved();
    toast({ message: `Saved ${name}`, tone: 'success' });
  };

  const blocked =
    issues.length > 0
      ? `Fix ${issues.length} ${issues.length === 1 ? 'problem' : 'problems'} first`
      : undefined;
  const me1Name = `${configName}.ME1`;
  const unnamed = configName === '';
  const noteId = `${useId()}-blocked`;
  const describedBy = blocked ? noteId : undefined;

  return (
    <YStack>
      <Menu
        trigger={(props, open) => (
          <Action
            {...props}
            theme={ACCENT}
            kind="primary"
            {...(open ? { bg: 'color-10', borderColor: 'color-10' } : {})}
          >
            <SizableText size="sm" fontWeight="600" color="background">
              Export{' '}
              <SizableText size="sm" color="background" aria-hidden>
                ▾
              </SizableText>
            </SizableText>
          </Action>
        )}
      >
        {blocked && (
          <Theme name="red">
            <YStack id={noteId} px="3" py="2" rounded="md" bg="color-2" gap="0.5" role="note">
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
          describedBy={describedBy}
          onSelect={() => {
            if (me1.isOk && !unnamed) save(me1.value, me1Name, 'application/octet-stream');
          }}
        />
        <Row
          title="Channel setup for the ME-U"
          file={MEU_NAME}
          disabled={blocked !== undefined || meu.isErr}
          describedBy={describedBy}
          onSelect={() => {
            if (meu.isOk) save(meu.value, MEU_NAME, 'application/json');
          }}
        />
      </Menu>
    </YStack>
  );
};

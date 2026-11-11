import { useStore } from 'jotai';
import { useEffect, useState } from 'react';
import { SizableText, Theme, YStack } from 'tamagui';
import { dirtyAtom, loadAtom, startedAtom } from '../lib/store.ts';
import { ACCENT, DISPLAY_FONT } from '../lib/theme.ts';
import { ConfirmDialog } from './ConfirmDialog.tsx';

const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files');

/**
 * Whole-window drop target for `.ME1` and `.meu` files, on the welcome screen
 * and in the editor, with a full-screen overlay while files are dragged over.
 * Dropping onto unsaved edits asks first, in a modal confirmation.
 */
export const WindowDrop = () => {
  const store = useStore();
  const [over, setOver] = useState(false);
  /** Dropped files waiting for the user to confirm replacing unsaved edits. */
  const [pending, setPending] = useState<readonly File[] | null>(null);

  useEffect(() => {
    // dragenter/dragleave fire for every child crossed, so count them.
    let depth = 0;
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth++;
      setOver(true);
    };
    const overHandler = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    };
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setOver(false);
    };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setOver(false);
      // Copy now: the DataTransfer's file list is emptied once the event ends.
      const files = Array.from(e.dataTransfer?.files ?? []);
      if (!files.length) return;
      if (store.get(startedAtom) && store.get(dirtyAtom)) {
        setPending(files);
        return;
      }
      void store.set(loadAtom, files);
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragover', overHandler);
    window.addEventListener('dragleave', leave);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragover', overHandler);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('drop', drop);
    };
  }, [store]);

  const confirm = (
    <ConfirmDialog
      open={pending !== null}
      title="Replace the current system?"
      confirmLabel="Replace"
      onClose={(confirmed) => {
        if (confirmed && pending) void store.set(loadAtom, pending);
        setPending(null);
      }}
    >
      The dropped files will replace it, and your unsaved changes will be lost.
    </ConfirmDialog>
  );
  if (!over) return confirm;
  return (
    <>
      {confirm}
      <YStack
        position="fixed"
        t={0}
        l={0}
        r={0}
        b={0}
        z={1000}
        p="4"
        pointerEvents="none"
        aria-hidden
      >
        <YStack position="absolute" t={0} l={0} r={0} b={0} bg="background" opacity={0.88} />
        <Theme name={ACCENT}>
          <YStack
            position="relative"
            flex={1}
            items="center"
            justify="center"
            gap="2"
            rounded="xl"
            borderWidth={3}
            borderStyle="dashed"
            borderColor="color-8"
          >
            <SizableText size="2xl" fontWeight="800" color="color-11" text="center">
              Drop{' '}
              <SizableText size="2xl" fontWeight="800" fontFamily={DISPLAY_FONT} color="color-11">
                .ME1
              </SizableText>{' '}
              and/or{' '}
              <SizableText size="2xl" fontWeight="800" fontFamily={DISPLAY_FONT} color="color-11">
                .meu
              </SizableText>{' '}
              files
            </SizableText>
            <SizableText size="sm" color="color-11">
              They’re read here in the browser, not uploaded.
            </SizableText>
          </YStack>
        </Theme>
      </YStack>
    </>
  );
};

import { type ReactNode, useEffect, useId, useRef } from 'react';
import { SizableText, Theme, XStack, YStack } from 'tamagui';
import { Action } from './ui.tsx';

/**
 * The native modal gives the inert page, focus containment, Esc and focus
 * return. Tamagui's reset unsets the UA styles on `dialog`, so this restores
 * the closed state and the centred modal box, dims the backdrop and keeps
 * scrolling from chaining to the page behind.
 */
const CSS = `
.confirm-dialog:not([open]) { display: none; }
.confirm-dialog[open] { display: block; padding: 0; border: 0; background: transparent; color: inherit; }
.confirm-dialog:modal { position: fixed; inset: 0; margin: auto; width: fit-content; height: fit-content; max-width: calc(100vw - 32px); max-height: calc(100dvh - 32px); overflow: auto; overscroll-behavior: contain; }
.confirm-dialog::backdrop { background: rgba(0, 0, 0, 0.45); overflow: hidden; overscroll-behavior: contain; }
`;

/** Outside the dialog's box: the pointer, not the target, since padding also targets the dialog. */
const outside = (e: PointerEvent, dialog: HTMLDialogElement) => {
  const r = dialog.getBoundingClientRect();
  return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
};

/**
 * A modal confirmation for a destructive action, on a native `<dialog>`.
 * Escape, the back gesture, a backdrop click and Cancel all report `false`;
 * only the confirm button reports `true`. Cancel takes focus, so Enter is safe.
 */
export const ConfirmDialog = ({
  open,
  title,
  children,
  confirmLabel,
  onClose,
}: {
  readonly open: boolean;
  readonly title: string;
  readonly children: ReactNode;
  readonly confirmLabel: string;
  readonly onClose: (confirmed: boolean) => void;
}) => {
  const ref = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const id = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      // Focus the safe action. Tamagui doesn't pass React's autoFocus through,
      // so set the attribute the dialog's own focusing steps read.
      dialog.querySelector('button[value="cancel"]')?.setAttribute('autofocus', '');
      dialog.showModal();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const close = () => {
      const confirmed = dialog.returnValue === 'confirm';
      // Esc sets no value and browsers differ on clearing the last one.
      dialog.returnValue = '';
      onCloseRef.current(confirmed);
    };
    dialog.addEventListener('close', close);
    // `closedby="any"` light-dismisses natively; elsewhere (Safari), close on
    // a press and release both outside the box.
    let pressedOutside = false;
    const down = (e: PointerEvent) => {
      pressedOutside = outside(e, dialog);
    };
    const up = (e: PointerEvent) => {
      if (pressedOutside && outside(e, dialog)) dialog.close();
    };
    const fallback = !('closedBy' in HTMLDialogElement.prototype);
    if (fallback) {
      dialog.addEventListener('pointerdown', down);
      dialog.addEventListener('pointerup', up);
    }
    return () => {
      dialog.removeEventListener('close', close);
      dialog.removeEventListener('pointerdown', down);
      dialog.removeEventListener('pointerup', up);
    };
  }, []);

  return (
    <dialog
      ref={ref}
      className="confirm-dialog"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-message`}
      {...({ closedby: 'any' } as Record<string, string>)}
    >
      <style>{CSS}</style>
      <form method="dialog">
        <YStack
          w={400}
          maxW="100%"
          gap="3"
          p="4"
          rounded="lg"
          borderWidth={1}
          borderColor="border-color"
          bg="background"
          shadowColor="rgba(0,0,0,0.2)"
          shadowRadius={24}
          shadowOffset={{ width: 0, height: 8 }}
        >
          <YStack gap="1">
            <SizableText id={`${id}-title`} size="base" fontWeight="600" render="h2" m="0">
              {title}
            </SizableText>
            <SizableText id={`${id}-message`} size="sm" color="color-11">
              {children}
            </SizableText>
          </YStack>
          <XStack gap="2" justify="flex-end" flexWrap="wrap">
            <Action kind="subtle" type="submit" value="cancel">
              Cancel
            </Action>
            <Theme name="red">
              <Action kind="primary" type="submit" value="confirm">
                {confirmLabel}
              </Action>
            </Theme>
          </XStack>
        </YStack>
      </form>
    </dialog>
  );
};

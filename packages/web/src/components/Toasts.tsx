import { useAtomValue, useSetAtom } from 'jotai';
import { type FocusEvent, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { SizableText, XStack, YStack } from 'tamagui';
import { dismissToastAtom, type Toast, toastsAtom } from '../lib/store.ts';
import { Action } from './ui.tsx';

const TONE_THEME = { success: 'green', error: 'red', info: null } as const;
const TONE_GLYPH = { success: '✓', error: '!', info: 'i' } as const;
/**
 * How long a toast stays up, or `null` to stay until dismissed. Successes
 * ("Loaded…", "Saved…") are frequent and also shown elsewhere in the UI, so
 * they go by themselves; errors and notices stay until they're closed.
 */
const DURATION_MS = { success: 5000, info: null, error: null } as const;

const supportsPopover =
  typeof HTMLElement !== 'undefined' && Object.hasOwn(HTMLElement.prototype, 'popover');

/**
 * The container is a manual popover, so it sits in the top layer above any
 * dialog or menu opened before it, and nothing light-dismisses it. Without
 * popover support it stays a fixed, z-indexed box (the `:popover-open` rules
 * are dropped). Entry and exit fade, and slide in, unless less motion is asked.
 */
const CSS = `
.toasts { position: fixed; inset: auto 16px 16px 16px; width: auto; height: auto; max-height: calc(100dvh - 32px); overflow-y: auto; margin: 0; padding: 0; border: 0; background: transparent; color: inherit; z-index: 100; display: flex; flex-direction: column; gap: 8px; align-items: center; pointer-events: none; opacity: 1; }
@media (min-width: 768px) { .toasts { left: auto; right: 24px; bottom: 24px; align-items: flex-end; } }
.toasts[popover] { transition: opacity 160ms ease-out, display 160ms, overlay 160ms; transition-behavior: allow-discrete; }
.toasts[popover]:not(:popover-open) { display: none; opacity: 0; }
@starting-style { .toasts[popover]:popover-open { opacity: 0; } }
.toast { transition: opacity 160ms ease-out, translate 160ms ease-out; }
@starting-style { .toast { opacity: 0; translate: 0 8px; } }
@media (prefers-reduced-motion: reduce) { .toasts[popover], .toast { transition: none; } }
.toasts-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
`;

type AriaNotify = (announcement: string) => void;

/** True while a modal `<dialog>` is open; toasts wait until it closes. */
const useModalOpen = (): boolean => {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const check = () => setOpen(document.querySelector('dialog:modal') !== null);
    const observer = new MutationObserver(check);
    observer.observe(document.body, { subtree: true, attributeFilter: ['open'], childList: true });
    check();
    return () => observer.disconnect();
  }, []);
  return open;
};

const ToastItem = ({
  toast,
  paused,
  onDismiss,
}: {
  readonly toast: Toast;
  readonly paused: boolean;
  readonly onDismiss: (id: number) => void;
}) => {
  const dismiss = useSetAtom(dismissToastAtom);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const duration = DURATION_MS[toast.tone];
  const running = duration !== null && !paused && !hovered && !focused;

  // Count down only while nobody is reading or using the toast.
  useEffect(() => {
    if (!running) return;
    const timer = window.setTimeout(() => dismiss(toast.id), duration);
    return () => window.clearTimeout(timer);
  }, [running, duration, dismiss, toast.id]);

  const onBlur = (e: FocusEvent<HTMLElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
  };

  return (
    <XStack
      className="toast"
      data-toast-id={toast.id}
      theme={TONE_THEME[toast.tone]}
      items="center"
      gap="2.5"
      w={360}
      maxW="100%"
      pl="3"
      pr="1"
      py="1.5"
      rounded="lg"
      borderWidth={1}
      borderColor="color-6"
      bg="color-2"
      shadowColor="rgba(0,0,0,0.16)"
      shadowRadius={14}
      shadowOffset={{ width: 0, height: 4 }}
      pointerEvents="auto"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={onBlur}
    >
      <YStack
        w={20}
        h={20}
        rounded="full"
        bg={toast.tone === 'info' ? 'color-8' : 'color-9'}
        items="center"
        justify="center"
        shrink={0}
        aria-hidden
      >
        <SizableText size="xs" fontWeight="800" color="background">
          {TONE_GLYPH[toast.tone]}
        </SizableText>
      </YStack>
      <SizableText size="sm" color="color" flex={1} minW={0}>
        {toast.message}
      </SizableText>
      <Action kind="ghost" aria-label="Dismiss notification" onPress={() => onDismiss(toast.id)}>
        ✕
      </Action>
    </XStack>
  );
};

/**
 * Notifications from `toastsAtom`, stacked bottom-centre (bottom right on
 * wider screens) in one "Notifications" region on a manual popover. Each is
 * announced with `ariaNotify()`, or a live region where that's missing.
 * Successes dismiss themselves after a few seconds, waiting while hovered or
 * focused; errors and notices stay until closed. Toasts wait while a modal
 * dialog is open.
 */
export const Toasts = () => {
  const toasts = useAtomValue(toastsAtom);
  const dismiss = useSetAtom(dismissToastAtom);
  const modalOpen = useModalOpen();
  const region = useRef<HTMLElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const announced = useRef(new Set<number>());
  const [liveText, setLiveText] = useState('');

  const open = toasts.length > 0 && !modalOpen;
  // Keep the last toasts in the closing popover so they fade out with it.
  const lastShown = useRef<readonly Toast[]>([]);
  if (open) lastShown.current = toasts;
  const shown = open || !supportsPopover ? toasts : lastShown.current;

  useLayoutEffect(() => {
    const el = region.current;
    if (!el || !supportsPopover) return;
    const isOpen = el.matches(':popover-open');
    if (open && !isOpen) el.showPopover();
    if (!open && isOpen) el.hidePopover();
  }, [open]);

  // Announce each toast's text once, when it's actually visible.
  useEffect(() => {
    if (modalOpen) return;
    const fresh = toasts.filter((t) => !announced.current.has(t.id));
    if (fresh.length === 0) return;
    for (const t of fresh) announced.current.add(t.id);
    const text = fresh.map((t) => t.message).join('. ');
    const notify = (document as Document & { ariaNotify?: AriaNotify }).ariaNotify;
    if (notify) {
      notify.call(document, text);
      return;
    }
    // Clear first so a repeated message is announced again.
    setLiveText('');
    const frame = requestAnimationFrame(() => setLiveText(text));
    return () => cancelAnimationFrame(frame);
  }, [toasts, modalOpen]);

  /** Remember where focus came from, to return it when the last toast closes. */
  const onFocus = (e: FocusEvent<HTMLElement>) => {
    const from = e.relatedTarget as HTMLElement | null;
    if (from && !e.currentTarget.contains(from)) returnFocus.current = from;
  };

  /** Close a toast; if it had focus, move it to the next toast or back where it was. */
  const close = (id: number) => {
    const el = region.current?.querySelector(`[data-toast-id="${id}"]`);
    const hadFocus = el?.contains(document.activeElement) ?? false;
    const index = toasts.findIndex((t) => t.id === id);
    const next = toasts[index + 1] ?? toasts[index - 1];
    dismiss(id);
    if (!hadFocus) return;
    requestAnimationFrame(() => {
      const target = next
        ? region.current?.querySelector<HTMLElement>(`[data-toast-id="${next.id}"] button`)
        : returnFocus.current?.isConnected
          ? returnFocus.current
          : null;
      target?.focus();
    });
  };

  return (
    <>
      <style>{CSS}</style>
      <section
        ref={region}
        className="toasts"
        aria-label="Notifications"
        inert={!open}
        onFocus={onFocus}
        {...(supportsPopover ? ({ popover: 'manual' } as Record<string, string>) : {})}
      >
        {shown.map((t) => (
          <ToastItem key={t.id} toast={t} paused={!open} onDismiss={close} />
        ))}
      </section>
      {liveText ? <p className="toasts-sr">Notifications</p> : null}
      <div className="toasts-sr" aria-live="polite">
        {liveText}
      </div>
    </>
  );
};

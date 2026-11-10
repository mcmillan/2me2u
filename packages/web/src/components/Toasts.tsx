import { useAtomValue, useSetAtom } from 'jotai';
import { useEffect, useRef } from 'react';
import { SizableText, XStack, YStack } from 'tamagui';
import { dismissToastAtom, type Toast, toastsAtom } from '../lib/store.ts';
import { Action } from './ui.tsx';

const TONE_THEME = { success: 'green', error: 'red', info: null } as const;
const TONE_GLYPH = { success: '✓', error: '!', info: 'i' } as const;
/** How long a toast stays up; errors stay longer so there's time to read them. */
const DURATION_MS = { success: 4000, info: 4000, error: 7000 } as const;

/** Slide-in, dropped for people who ask for less motion. */
const CSS = `
@keyframes toast-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
.toast { animation: toast-in 160ms ease-out; }
@media (prefers-reduced-motion: reduce) { .toast { animation: none; } }
.toasts { left: 16px; right: 16px; align-items: center; }
@media (min-width: 768px) { .toasts { left: auto; right: 24px; bottom: 24px; align-items: flex-end; } }
`;

const ToastItem = ({ toast }: { readonly toast: Toast }) => {
  const dismiss = useSetAtom(dismissToastAtom);
  const timer = useRef<number | undefined>(undefined);
  const start = () => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => dismiss(toast.id), DURATION_MS[toast.tone]);
  };
  const pause = () => window.clearTimeout(timer.current);
  // biome-ignore lint/correctness/useExhaustiveDependencies: start the timer once per toast
  useEffect(() => {
    start();
    return pause;
  }, [toast.id]);

  return (
    <XStack
      className="toast"
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
      onMouseEnter={pause}
      onMouseLeave={start}
      onFocus={pause}
      onBlur={start}
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
      <SizableText size="sm" color="color" flex={1}>
        {toast.message}
      </SizableText>
      <Action kind="ghost" aria-label="Dismiss notification" onPress={() => dismiss(toast.id)}>
        ✕
      </Action>
    </XStack>
  );
};

/**
 * Transient notifications from `toastsAtom`, stacked bottom-centre (bottom
 * right on wider screens). Each dismisses itself after a few seconds, longer
 * for errors, and waits while hovered or focused.
 */
export const Toasts = () => {
  const toasts = useAtomValue(toastsAtom);
  return (
    <>
      <style>{CSS}</style>
      <YStack
        className="toasts"
        role="region"
        aria-label="Notifications"
        aria-live="polite"
        position="fixed"
        b={16}
        z={100}
        gap="2"
        pointerEvents="none"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} />
        ))}
      </YStack>
    </>
  );
};

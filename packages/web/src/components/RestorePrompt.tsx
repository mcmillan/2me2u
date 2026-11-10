import { useAtomValue, useSetAtom, useStore } from 'jotai';
import { useEffect, useState } from 'react';
import { SizableText, Theme, XStack, YStack } from 'tamagui';
import { discardSession, readSession, restoreSession, type Session } from '../lib/session.ts';
import { startedAtom, toastAtom } from '../lib/store.ts';
import { ACCENT, DISPLAY_FONT } from '../lib/theme.ts';
import { Action } from './ui.tsx';

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

/** "just now", "3 minutes ago", "yesterday", … */
const ago = (then: number, now: number): string => {
  const seconds = Math.round((then - now) / 1000);
  if (seconds > -45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes > -60) return relative.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (hours > -24) return relative.format(hours, 'hour');
  const days = Math.round(hours / 24);
  if (days > -30) return relative.format(days, 'day');
  return new Date(then).toLocaleDateString();
};

/** The time, re-rendered each minute so "edited 3 minutes ago" stays true. */
const useNow = (): number => {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  return now;
};

const describe = (session: Session): string => {
  const files = [session.files.me1?.name, session.files.meu?.name].filter(Boolean);
  const what = files.length > 0 ? files.join(' and ') : 'A new system';
  return session.dirty ? `${what}, with unsaved changes` : what;
};

/** Offers to bring back the autosaved session, until the user starts something. */
export const RestorePrompt = () => {
  const started = useAtomValue(startedAtom);
  const toast = useSetAtom(toastAtom);
  const store = useStore();
  const [session, setSession] = useState(readSession);
  const [busy, setBusy] = useState(false);
  const now = useNow();

  if (!session || started) return null;

  const restore = async () => {
    setBusy(true);
    const ok = await restoreSession(session, store);
    setBusy(false);
    setSession(null);
    if (!ok) {
      toast({
        message: 'The original files couldn’t be read again; your channels and keys are back',
        tone: 'error',
      });
    }
  };

  const discard = () => {
    discardSession();
    setSession(null);
  };

  return (
    <YStack w="100%" maxW={560} mx="auto" px="4" pt="4">
      <YStack
        role="region"
        aria-labelledby="restore-title"
        gap="3"
        p="4"
        rounded="lg"
        borderWidth={1}
        borderColor="border-color"
        bg="color-1"
      >
        <XStack gap="3" items="flex-start">
          <Theme name={ACCENT}>
            <YStack w={8} h={8} mt="1.5" rounded="full" bg="color-8" shrink={0} />
          </Theme>
          <YStack gap="1" flex={1} minW={0}>
            <SizableText id="restore-title" size="base" fontWeight="600" render="h2">
              Pick up where you left off?
            </SizableText>
            <SizableText size="sm" color="color-11">
              <SizableText size="sm" fontFamily={DISPLAY_FONT} fontWeight="600" color="color">
                {session.configName}
              </SizableText>
              {` · edited ${ago(session.savedAt, now)}`}
            </SizableText>
            <SizableText size="xs" color="color-10">
              {describe(session)}
            </SizableText>
          </YStack>
        </XStack>
        <XStack gap="2" justify="flex-end" flexWrap="wrap">
          <Action kind="subtle" onPress={discard} disabled={busy}>
            Discard
          </Action>
          <Theme name={ACCENT}>
            <Action kind="primary" onPress={() => void restore()} disabled={busy}>
              Restore
            </Action>
          </Theme>
        </XStack>
      </YStack>
    </YStack>
  );
};

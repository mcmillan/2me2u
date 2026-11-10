import { useAtomValue } from 'jotai';
import { XStack, YStack } from 'tamagui';
import { ChannelList } from './components/ChannelList.tsx';
import { KeyDetail } from './components/KeyDetail.tsx';
import { KeyGrid } from './components/KeyGrid.tsx';
import { RestorePrompt } from './components/RestorePrompt.tsx';
import { Toasts } from './components/Toasts.tsx';
import { TopBar } from './components/TopBar.tsx';
import { Welcome } from './components/Welcome.tsx';
import { WindowDrop } from './components/WindowDrop.tsx';
import { useAutosave } from './lib/session.ts';
import { useShortcuts } from './lib/shortcuts.ts';
import { startedAtom, viewAtom } from './lib/store.ts';

const Editor = () => {
  const view = useAtomValue(viewAtom);
  return (
    <>
      <TopBar />
      <YStack render="main" w="100%" maxW={1280} mx="auto" p="4">
        {view === 'keys' ? (
          <XStack gap="4" flexWrap="wrap" items="flex-start">
            <YStack flex={1} flexBasis={360} minW={300}>
              <KeyGrid />
            </YStack>
            <YStack flex={1.3} flexBasis={420} minW={300} position="sticky" t={72}>
              <KeyDetail />
            </YStack>
          </XStack>
        ) : (
          <ChannelList />
        )}
      </YStack>
    </>
  );
};

export const App = () => {
  const started = useAtomValue(startedAtom);
  useAutosave();
  useShortcuts();
  return (
    <YStack minH="100vh" bg="background">
      <WindowDrop />
      <RestorePrompt />
      {started ? <Editor /> : <Welcome />}
      <Toasts />
    </YStack>
  );
};

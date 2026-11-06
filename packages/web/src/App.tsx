import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { Button, H1, H2, Input, SizableText, XStack, YStack } from 'tamagui';
import { Channels } from './components/Channels.tsx';
import { DropZone } from './components/DropZone.tsx';
import { Issues } from './components/Issues.tsx';
import { KeyEditor } from './components/KeyEditor.tsx';
import { Panel } from './components/Panel.tsx';
import { download } from './lib/files.ts';
import {
  configNameAtom,
  issuesAtom,
  me1Atom,
  meuAtom,
  resetAtom,
  systemAtom,
} from './lib/store.ts';

const Toolbar = () => {
  const [configName, setConfigName] = useAtom(configNameAtom);
  const reset = useSetAtom(resetAtom);
  const me1 = useAtomValue(me1Atom);
  const meu = useAtomValue(meuAtom);
  return (
    <XStack items="center" gap="3" flexWrap="wrap">
      <H1 size="2xl" mr="auto">
        2me2u
      </H1>
      <Button size="sm" onPress={reset}>
        New system
      </Button>
      <XStack items="center" gap="2">
        <SizableText size="sm" color="color-10">
          Config name
        </SizableText>
        <Input
          size="sm"
          w={120}
          maxLength={8}
          value={configName}
          onChangeText={(v) => setConfigName(v.toUpperCase().replace(/[^0-9A-Z_-]/g, ''))}
          aria-label="Config name, up to 8 characters"
        />
      </XStack>
      <Button
        size="sm"
        theme="accent"
        disabled={me1.isErr || configName === ''}
        onPress={() =>
          me1.isOk && download(me1.value, `${configName}.ME1`, 'application/octet-stream')
        }
      >
        Export .ME1
      </Button>
      <Button
        size="sm"
        theme="accent"
        disabled={meu.isErr}
        onPress={() => meu.isOk && download(meu.value, 'ChannelSetup.meu', 'application/json')}
      >
        Export .meu
      </Button>
    </XStack>
  );
};

const Status = () => {
  const issues = useAtomValue(issuesAtom);
  return issues.length > 0 ? (
    <Issues issues={issues} title="The ME-1 would reject this system" />
  ) : (
    <SizableText size="sm" theme="green" color="color-11">
      Valid: the ME-1 would accept this system.
    </SizableText>
  );
};

const Keys = () => {
  const system = useAtomValue(systemAtom);
  return (
    <Panel gap="3">
      <XStack justify="space-between" items="baseline" gap="3" flexWrap="wrap">
        <H2 size="lg">Keys</H2>
        <SizableText size="sm" color="color-10">
          The ME-1's 16 select keys.
        </SizableText>
      </XStack>
      <XStack flexWrap="wrap" gap="2">
        {system.keys.map((key, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: keys are fixed positions on the ME-1
          <KeyEditor key={i} index={i} key_={key} />
        ))}
      </XStack>
    </Panel>
  );
};

export const App = () => (
  <YStack render="main" maxW={1200} mx="auto" p="4" gap="3" minH="100vh" bg="background">
    <Toolbar />
    <DropZone />
    <Status />
    <XStack gap="3" flexWrap="wrap" items="flex-start">
      <YStack flex={1} minW={320}>
        <Channels />
      </YStack>
      <YStack flex={1.4} minW={320}>
        <Keys />
      </YStack>
    </XStack>
  </YStack>
);

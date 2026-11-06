import { useAtomValue, useSetAtom } from 'jotai';
import { Checkbox, H2, Input, SizableText, XStack, YStack } from 'tamagui';
import { setChannelName, setStereo } from '../lib/edit.ts';
import { editAtom, systemAtom } from '../lib/store.ts';
import { Panel } from './Panel.tsx';

const Column = ({ from, to }: { from: number; to: number }) => {
  const system = useAtomValue(systemAtom);
  const edit = useSetAtom(editAtom);
  return (
    <YStack gap="1.5" flex={1} minW={220}>
      {system.channels.slice(from - 1, to).map((channel, i) => {
        const n = from + i;
        const second = channel.stereo === true && n % 2 === 0;
        return (
          <XStack key={n} items="center" gap="2">
            <SizableText size="sm" color="color-10" w={24} text="right">
              {n}
            </SizableText>
            <Input
              flex={1}
              size="sm"
              maxLength={6}
              placeholder={String(n)}
              value={channel.name ?? ''}
              onChangeText={(name) => edit((s) => setChannelName(s, n, name))}
              aria-label={`Channel ${n} name`}
              borderStyle={second ? 'dashed' : 'solid'}
            />
            <XStack w={44} items="center" gap="1">
              {n % 2 === 1 ? (
                <>
                  <Checkbox
                    size="sm"
                    checked={channel.stereo === true}
                    onCheckedChange={(checked) => edit((s) => setStereo(s, n, checked === true))}
                    aria-label={`Link channels ${n} and ${n + 1} as a stereo pair`}
                  >
                    <Checkbox.Indicator>
                      <SizableText size="xs" lineHeight={14}>
                        ✓
                      </SizableText>
                    </Checkbox.Indicator>
                  </Checkbox>
                  <SizableText size="xs" color="color-10">
                    ST
                  </SizableText>
                </>
              ) : (
                <SizableText size="xs" color="color-10">
                  {channel.stereo ? '↑ R' : ''}
                </SizableText>
              )}
            </XStack>
          </XStack>
        );
      })}
    </YStack>
  );
};

export const Channels = () => (
  <Panel gap="3">
    <XStack justify="space-between" items="baseline" gap="3" flexWrap="wrap">
      <H2 size="lg">Channels</H2>
      <SizableText size="sm" color="color-10">
        Names up to 6 characters. ST links a pair.
      </SizableText>
    </XStack>
    <XStack gap="4" flexWrap="wrap">
      <Column from={1} to={20} />
      <Column from={21} to={40} />
    </XStack>
  </Panel>
);

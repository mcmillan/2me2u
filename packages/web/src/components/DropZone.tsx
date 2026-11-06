import { useAtomValue, useSetAtom } from 'jotai';
import { type DragEvent, useRef, useState } from 'react';
import { SizableText, XStack, YStack } from 'tamagui';
import { filesAtom, loadAtom, loadIssuesAtom } from '../lib/store.ts';
import { Issues } from './Issues.tsx';

export const DropZone = () => {
  const files = useAtomValue(filesAtom);
  const issues = useAtomValue(loadIssuesAtom);
  const load = useSetAtom(loadAtom);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    void load(e.dataTransfer.files);
  };

  return (
    <YStack gap="2">
      <XStack
        role="button"
        tabIndex={0}
        items="center"
        justify="space-between"
        flexWrap="wrap"
        gap="3"
        p="3"
        borderWidth={2}
        borderStyle="dashed"
        borderColor={over ? 'accent-color' : { default: 'border-color', hover: 'color-8' }}
        rounded="md"
        bg="background"
        cursor="pointer"
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        onPress={() => input.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && input.current?.click()}
      >
        <input
          ref={input}
          type="file"
          accept=".ME1,.me1,.meu"
          multiple
          hidden
          style={{ display: 'none' }}
          onChange={(e) => {
            if (e.currentTarget.files) void load(e.currentTarget.files);
            e.currentTarget.value = '';
          }}
        />
        <SizableText>
          <SizableText fontWeight="600">Drop an .ME1 and/or .meu here</SizableText>{' '}
          <SizableText color="color-10">or click to choose</SizableText>
        </SizableText>
        <XStack gap="3">
          {files.me1 && <SizableText color="color-10">{files.me1.name}</SizableText>}
          {files.meu && <SizableText color="color-10">{files.meu.name}</SizableText>}
          {!files.me1 && !files.meu && <SizableText color="color-10">Nothing loaded</SizableText>}
        </XStack>
      </XStack>
      <Issues issues={issues} title="Problems loading" />
    </YStack>
  );
};

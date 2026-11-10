import { useAtomValue, useSetAtom } from 'jotai';
import { type ReactNode, useRef } from 'react';
import { SizableText, Theme, XStack, YStack } from 'tamagui';
import { describeIssue } from '../lib/messages.ts';
import { loadAtom, loadIssuesAtom, resetAtom } from '../lib/store.ts';
import { ACCENT, DISPLAY_FONT } from '../lib/theme.ts';
import { Brand } from './TopBar.tsx';

const Ext = ({ children }: { children: ReactNode }) => (
  <SizableText size="sm" fontFamily={DISPLAY_FONT} fontWeight="700" color="color">
    {children}
  </SizableText>
);

/** Large tappable card shared by both paths. */
const cardProps = {
  flex: 1,
  flexBasis: 300,
  minW: 260,
  minH: 240,
  gap: '3',
  p: '5',
  rounded: 'xl',
  bg: { default: 'transparent', hover: 'color-2' },
  cursor: 'pointer',
  role: 'button',
  tabIndex: 0,
} as const;

const onActivate = (fn: () => void) => (e: { key: string; preventDefault: () => void }) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    fn();
  }
};

const UploadGlyph = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M12 15V4m0 0L7.5 8.5M12 4l4.5 4.5M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const PlusGlyph = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const OpenCard = () => {
  const load = useSetAtom(loadAtom);
  const issues = useAtomValue(loadIssuesAtom);
  const input = useRef<HTMLInputElement>(null);
  const choose = () => input.current?.click();
  return (
    <YStack flex={1} flexBasis={300} minW={260} gap="3">
      <YStack
        {...cardProps}
        flex={undefined}
        flexBasis={undefined}
        grow={1}
        borderWidth={2}
        borderStyle="dashed"
        bg={{ default: 'transparent', hover: 'color-1' }}
        borderColor={{ default: 'color-7', hover: 'color-8', 'focus-visible': 'color-9' }}
        aria-label="Open your files: choose an .ME1 and/or .meu file"
        onPress={choose}
        onKeyDown={onActivate(choose)}
      >
        <input
          ref={input}
          type="file"
          accept=".ME1,.me1,.meu"
          multiple
          hidden
          style={{ display: 'none' }}
          onChange={(e) => {
            const picked = e.currentTarget.files ? Array.from(e.currentTarget.files) : [];
            e.currentTarget.value = '';
            if (picked.length) void load(picked);
          }}
        />
        <YStack color="color-10">
          <UploadGlyph />
        </YStack>
        <YStack gap="1">
          <SizableText size="xl" fontWeight="700">
            Open your files
          </SizableText>
          <SizableText size="sm" color="color-11">
            Drop an <Ext>.ME1</Ext> and/or a <Ext>.meu</Ext> here, or click to choose.
          </SizableText>
        </YStack>
        <YStack gap="1.5" mt="auto" pt="2" borderTopWidth={1} borderColor="border-color">
          <SizableText size="xs" color="color-11">
            <Ext>.ME1</Ext> — saved by the ME-1 to its USB stick, in the <Ext>ME1CFG</Ext> folder.
          </SizableText>
          <SizableText size="xs" color="color-11">
            <Ext>.meu</Ext> — exported from the ME-U.
          </SizableText>
        </YStack>
      </YStack>
      {issues.length > 0 && (
        <Theme name="red">
          <YStack
            role="alert"
            gap="1"
            p="3"
            rounded="lg"
            bg="color-2"
            borderWidth={1}
            borderColor="color-6"
          >
            <SizableText size="sm" fontWeight="700" color="color-11">
              Those files couldn’t be read
            </SizableText>
            {issues.slice(0, 6).map((issue) => (
              <SizableText key={`${issue.path}:${issue.reason}`} size="sm" color="color-11">
                {describeIssue(issue)}
              </SizableText>
            ))}
            {issues.length > 6 && (
              <SizableText size="sm" color="color-11">
                …and {issues.length - 6} more.
              </SizableText>
            )}
          </YStack>
        </Theme>
      )}
    </YStack>
  );
};

const ScratchCard = () => {
  const reset = useSetAtom(resetAtom);
  return (
    <YStack
      {...cardProps}
      borderWidth={1}
      borderColor={{ default: 'border-color', hover: 'color-7', 'focus-visible': 'color-9' }}
      aria-label="Start from scratch with a blank system"
      onPress={reset}
      onKeyDown={onActivate(reset)}
    >
      <YStack color="color-10">
        <PlusGlyph />
      </YStack>
      <YStack gap="1">
        <SizableText size="xl" fontWeight="700">
          Start from scratch
        </SizableText>
        <SizableText size="sm" color="color-11">
          A blank system: 40 unnamed channels and 16 unassigned keys, ready to set up.
        </SizableText>
      </YStack>
      <SizableText size="sm" fontWeight="600" color="color-11" mt="auto" pt="2" aria-hidden>
        New system →
      </SizableText>
    </YStack>
  );
};

/** A small stylised ME-1 front panel: dark faceplate, OLED screen, 16 backlit keys. */
const DeviceGlyph = () => {
  const lit: Record<number, string> = { 0: '#22c55e', 2: '#3b82f6', 5: '#facc15', 9: '#3b82f6' };
  const keys = Array.from({ length: 16 }, (_, i) => {
    const x = 22 + (i % 8) * 22;
    const y = i < 8 ? 78 : 112;
    return (
      <rect
        key={`${x},${y}`}
        x={x}
        y={y}
        width="16"
        height="11"
        rx="2.5"
        fill={lit[i] ?? '#3f3f46'}
        opacity={lit[i] ? 0.9 : 1}
      />
    );
  });
  return (
    <svg width="220" height="146" viewBox="0 0 220 146" aria-hidden="true">
      <rect x="4" y="4" width="212" height="138" rx="12" fill="#18181b" stroke="#3f3f46" />
      <circle cx="34" cy="34" r="11" fill="#27272a" stroke="#52525b" />
      <circle cx="186" cy="34" r="11" fill="#27272a" stroke="#52525b" />
      <rect x="62" y="16" width="96" height="40" rx="4" fill="#09090b" stroke="#3f3f46" />
      <text
        x="110"
        y="42"
        textAnchor="middle"
        fontFamily={DISPLAY_FONT}
        fontSize="17"
        fontWeight="700"
        fill="#fb923c"
      >
        2me2u
      </text>
      <rect x="18" y="94" width="184" height="13" rx="3" fill="#27272a" />
      {keys}
    </svg>
  );
};

/** First-run screen: open files or start from scratch. */
export const Welcome = () => (
  <YStack render="main" flex={1} w="100%" maxW={880} mx="auto" px="4" pt="8" pb="6" gap="7">
    <XStack justify="center">
      <Brand />
    </XStack>
    <YStack gap="2" items="center" mt="auto">
      <YStack mb="3">
        <DeviceGlyph />
      </YStack>
      <SizableText render="h1" size="2xl" fontWeight="800" text="center" m="0">
        Edit your ME-1 and ME-U setups in the browser
      </SizableText>
      <SizableText size="base" color="color-11" text="center">
        Your files never leave this computer — nothing is uploaded.
      </SizableText>
    </YStack>
    <XStack gap="4" flexWrap="wrap" items="flex-start">
      <Theme name={ACCENT}>
        <OpenCard />
      </Theme>
      <ScratchCard />
    </XStack>
    <SizableText size="xs" color="color-10" text="center" mt="auto">
      Not edited here: EQ, limiter, mic and other ME-1 settings — they’re kept as they are.
    </SizableText>
  </YStack>
);

import { LEVEL_MAX, LEVEL_MIN, type Level } from '@mcmillan/2me2u-core';
import { useEffect, useState } from 'react';
import { Checkbox, Input, SizableText, XStack } from 'tamagui';

interface Props {
  readonly value: Level | undefined;
  readonly onChange: (level: Level) => void;
}

const clamp = (n: number) => Math.min(LEVEL_MAX, Math.max(LEVEL_MIN, n));

/** Levels to one decimal place; the stored value keeps its full precision until edited. */
const format = (db: number) => String(Math.round(db * 10) / 10);

/** A level in dB relative to the 0 marker, or off. Typed values are committed on blur
 * or Enter, and only if the text was changed, so tabbing through never rounds a level. */
export const LevelInput = ({ value, onChange }: Props) => {
  const off = value === 'off';
  const db = typeof value === 'number' ? value : 0;
  const [text, setText] = useState(format(db));
  useEffect(() => setText(format(db)), [db]);

  const commit = () => {
    if (text === format(db)) return;
    const n = Number.parseFloat(text);
    if (Number.isFinite(n)) onChange(clamp(n));
    else setText(format(db));
  };

  return (
    <XStack items="center" gap="2">
      <Input
        size="sm"
        w={80}
        inputMode="decimal"
        value={off ? '' : text}
        disabled={off}
        onChangeText={setText}
        onBlur={commit}
        onSubmitEditing={commit}
        aria-label="Level in dB"
      />
      <SizableText size="sm" color="color-10">
        dB
      </SizableText>
      <Checkbox
        size="sm"
        checked={off}
        onCheckedChange={(checked) => onChange(checked === true ? 'off' : 0)}
        aria-label="Off"
      >
        <Checkbox.Indicator>
          <SizableText size="xs" lineHeight={14}>
            ✓
          </SizableText>
        </Checkbox.Indicator>
      </Checkbox>
      <SizableText size="sm" color="color-10">
        off
      </SizableText>
    </XStack>
  );
};

/**
 * Shared primitives. Use these rather than styling Tamagui's Button ad hoc, so
 * actions look the same everywhere.
 */

import { Button, styled } from 'tamagui';

/**
 * A button. `primary` is the one main action in a region (wrap it in
 * `<Theme name={ACCENT}>` for the accent colour); `subtle` is a secondary
 * action; `ghost` is a toolbar or inline action with no chrome until hovered.
 */
export const Action = styled(Button, {
  size: 'sm',
  rounded: 'md',
  borderWidth: 1,
  cursor: 'pointer',
  variants: {
    kind: {
      primary: {
        bg: { default: 'color-8', hover: 'color-9', press: 'color-10' },
        borderColor: { default: 'color-8', hover: 'color-9', press: 'color-10' },
        color: 'background',
      },
      subtle: {
        bg: { default: 'color-2', hover: 'color-3', press: 'color-4' },
        borderColor: 'border-color',
        color: 'color',
      },
      ghost: {
        bg: { default: 'transparent', hover: 'color-2', press: 'color-3' },
        borderColor: 'transparent',
        color: 'color',
      },
    },
    selected: {
      true: { bg: 'background', borderColor: 'border-color' },
    },
    disabled: {
      true: { opacity: 0.4, cursor: 'not-allowed' },
    },
  } as const,
  defaultVariants: { kind: 'subtle' },
});

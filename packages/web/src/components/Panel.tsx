import { styled, YStack } from 'tamagui';

/** A bordered section of the page. */
export const Panel = styled(YStack, {
  gap: '3',
  p: '4',
  borderWidth: 1,
  borderColor: 'border-color',
  rounded: 'lg',
  bg: 'background',
});

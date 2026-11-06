import type { Issue } from '@mcmillan/2me2u-core';
import { SizableText, YStack } from 'tamagui';

interface Props {
  readonly issues: readonly Issue[];
  readonly title: string;
}

export const Issues = ({ issues, title }: Props) =>
  issues.length === 0 ? null : (
    <YStack
      theme="red"
      role="alert"
      aria-label={title}
      gap="1"
      p="3"
      borderWidth={1}
      borderColor="color-8"
      rounded="md"
      bg="color-2"
    >
      <SizableText fontWeight="600" color="color-11">
        {title}
      </SizableText>
      {issues.map((issue) => (
        <SizableText key={`${issue.path}:${issue.reason}`} size="sm" color="color-11">
          <SizableText size="sm" fontWeight="600" color="color-11">
            {issue.path}
          </SizableText>{' '}
          {issue.reason}
        </SizableText>
      ))}
    </YStack>
  );

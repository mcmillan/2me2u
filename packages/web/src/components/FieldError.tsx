import { SizableText, XStack } from 'tamagui';
import { useFieldIssue } from '../lib/messages.ts';

export interface FieldErrorProps {
  /** Issue path from the core library, e.g. "keys[3].name". */
  readonly path: string;
}

/** A small warning sign, drawn in the current text colour. */
export const WarningIcon = ({ size = 14 }: { readonly size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
    <path
      d="M8 1.5 15 14H1L8 1.5Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
    <path d="M8 6v3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="8" cy="11.75" r="0.9" fill="currentColor" />
  </svg>
);

/**
 * The plain-English problem for one field, if any. The live region stays
 * mounted so screen readers announce a new problem politely, once.
 */
export const FieldError = ({ path }: FieldErrorProps) => {
  const message = useFieldIssue(path);
  return (
    <XStack theme="red" aria-live="polite" aria-atomic="true">
      {message && (
        <XStack items="flex-start" gap="1.5" pt="1">
          <SizableText size="xs" color="color-7" pt="0.5" shrink={0} aria-hidden>
            <WarningIcon />
          </SizableText>
          <SizableText size="xs" color="color">
            {message}
          </SizableText>
        </XStack>
      )}
    </XStack>
  );
};

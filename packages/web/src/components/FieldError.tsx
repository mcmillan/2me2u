import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
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

/*
 * One polite live region for the page announces a field's problem when it
 * appears, a moment later so it doesn't talk over the field that takes focus
 * next. The messages themselves aren't live regions: a region that is shown,
 * rather than changed, isn't announced reliably.
 */
let announcer: HTMLElement | undefined;
let announceTimer: ReturnType<typeof setTimeout> | undefined;
let announcedFor: string | undefined;

const announcerElement = (): HTMLElement => {
  if (announcer?.isConnected) return announcer;
  const el = document.createElement('div');
  el.setAttribute('aria-live', 'polite');
  Object.assign(el.style, {
    position: 'absolute',
    clipPath: 'inset(50%)',
    overflow: 'hidden',
    width: '1px',
    height: '1px',
    margin: '-1px',
    padding: '0',
    border: '0',
    whiteSpace: 'nowrap',
  });
  document.body.append(el);
  announcer = el;
  return el;
};

const announce = (owner: string, message: string) => {
  const el = announcerElement();
  clearTimeout(announceTimer);
  el.textContent = '';
  announcedFor = owner;
  announceTimer = setTimeout(() => {
    el.textContent = `Error: ${message}`;
  }, 500);
};

/** Withdraw an announcement once its field is fixed, so it isn't found later. */
const withdraw = (owner: string) => {
  if (announcedFor !== owner) return;
  clearTimeout(announceTimer);
  if (announcer) announcer.textContent = '';
  announcedFor = undefined;
};

/** The message under a field; the icon reads as "Error" so the text isn't colour alone. */
const ErrorText = ({ id, message }: { id?: string; message: string }) => (
  <XStack theme="red" items="flex-start" gap="1.5" pt="1" {...(id ? { id } : {})}>
    <SizableText size="xs" color="color-7" pt="0.5" shrink={0} role="img" aria-label="Error">
      <WarningIcon />
    </SizableText>
    <SizableText size="xs" color="color">
      {message}
    </SizableText>
  </XStack>
);

/**
 * The plain-English problem for a control that commits on change (a select, a
 * fader, a picker). A problem that appears after an edit is announced once.
 */
export const FieldError = ({ path }: FieldErrorProps) => {
  const message = useFieldIssue(path);
  const last = useRef({ path, message });
  useEffect(() => {
    const before = last.current;
    last.current = { path, message };
    if (before.path !== path) return;
    if (message === undefined) withdraw(path);
    else if (message !== before.message) announce(path, message);
  }, [path, message]);
  return message ? <ErrorText message={message} /> : null;
};

export interface TextFieldError {
  /** Spread on the text input: wires `aria-invalid`, `aria-describedby` and focus tracking. */
  readonly inputProps: {
    readonly 'aria-invalid': boolean;
    readonly 'aria-describedby'?: string;
    readonly onFocus: () => void;
    readonly onBlur: () => void;
  };
  /** The message to render under the input, or nothing. */
  readonly error: ReactNode;
}

/**
 * Validation timing for a text field whose problems come from the core
 * library (`path` is the issue path). A problem that appears while the user
 * is typing waits until they leave the field, then shows and is announced; a
 * fixed problem clears at once. Problems already there (from a loaded file,
 * or an undo) show straight away. While shown, the message is listed in
 * `aria-describedby` after `describedBy` and the input is `aria-invalid`.
 */
export const useTextFieldError = (path: string, describedBy?: string): TextFieldError => {
  const message = useFieldIssue(path);
  const errorId = useId();
  const [focused, setFocused] = useState(false);
  // Whether the field's problem had been shown when the user last entered or left it.
  const [committed, setCommitted] = useState(false);

  useEffect(() => {
    if (message === undefined) {
      setCommitted(false);
      withdraw(path);
    }
  }, [message, path]);

  const shown = message !== undefined && (!focused || committed);
  const ids = [describedBy, shown ? errorId : undefined].filter(Boolean).join(' ');

  return {
    inputProps: {
      'aria-invalid': shown,
      ...(ids ? { 'aria-describedby': ids } : {}),
      onFocus: () => {
        setFocused(true);
        setCommitted(message !== undefined);
      },
      onBlur: () => {
        setFocused(false);
        if (message !== undefined && !committed) announce(path, message);
        setCommitted(message !== undefined);
      },
    },
    error: shown && message !== undefined ? <ErrorText id={errorId} message={message} /> : null,
  };
};

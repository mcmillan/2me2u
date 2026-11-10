export interface FieldErrorProps {
  /** Issue path from the core library, e.g. "keys[3].name". */
  readonly path: string;
}

/** The plain-English problem for one field, if any. Owned by the feedback agent. */
export const FieldError = (_props: FieldErrorProps) => null;

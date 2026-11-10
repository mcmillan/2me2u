import type { Issue } from '@mcmillan/2me2u-core';

/** A plain-English sentence for an issue from the core library. Owned by the feedback agent. */
export const describeIssue = (issue: Issue): string => issue.reason;

/** The first problem for a field path, described in plain English. */
export const useFieldIssue = (_path: string): string | undefined => undefined;

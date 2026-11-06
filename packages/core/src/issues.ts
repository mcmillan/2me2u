/**
 * Problems are reported as data: a list of issues, each locating one field by
 * its property path. Every fallible operation in the package returns a
 * `Result` whose error is such a list, and reports every issue it finds rather
 * than stopping at the first.
 */

import Result, { transposeAll } from 'true-myth/result';

/** A problem with one field, located by a property path such as `keys[3].members[1].channel`. */
export interface Issue {
  readonly path: string;
  readonly reason: string;
}

export type Issues = readonly Issue[];

/** A result that, on failure, reports every issue found. */
export type Validated<T> = Result<T, Issues>;

export const issue = (path: string, reason: string): Issues => [{ path, reason }];

export const invalid = <T>(path: string, reason: string): Validated<T> =>
  Result.err(issue(path, reason));

/** No issues if `ok` holds; otherwise one. */
export const issueUnless = (ok: boolean, path: string, reason: string): Issues =>
  ok ? [] : issue(path, reason);

/** Succeed only if `ok` holds. */
export const check = (ok: boolean, path: string, reason: string): Validated<null> =>
  ok ? Result.ok(null) : invalid(path, reason);

/**
 * Combine a tuple of results, keeping all the values (as a tuple) or every
 * issue from every failure.
 */
export const combine = <const A extends readonly Validated<unknown>[]>(results: A) =>
  transposeAll(results).mapErr((errors): Issues => errors.flat());

/** Combine an array of like results, keeping all the values or every issue. */
export const collect = <T>(results: readonly Validated<T>[]): Validated<T[]> =>
  transposeAll(results).mapErr((errors): Issues => errors.flat());

/** Fail with the given issues if there are any. */
export const unlessIssues = (issues: Issues): Validated<null> =>
  issues.length === 0 ? Result.ok(null) : Result.err(issues);

/** Prefix every issue's path, for issues found inside a nested value. */
export const under = (prefix: string, issues: Issues): Issues =>
  issues.map((i) => ({ ...i, path: i.path ? `${prefix}.${i.path}` : prefix }));

export const isByte = (v: number): boolean => Number.isInteger(v) && v >= 0 && v <= 0xff;
export const isInt16 = (v: number): boolean => Number.isInteger(v) && v >= -0x8000 && v <= 0x7fff;

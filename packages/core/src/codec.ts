/**
 * The shape shared by every binary entity: a codec that decodes and encodes it.
 * Entities compose their codecs from the codecs of their parts.
 */

import Result from 'true-myth/result';
import { check, collect, invalid, isByte, isInt16, type Validated } from './issues.ts';

/**
 * A fixed-size binary record. `decode` is total when given exactly `size`
 * bytes (the enclosing codec guarantees that); `index` is the record's position
 * in its parent, for records that carry it. `encode` reports every invalid
 * field under `path`.
 */
export interface RecordCodec<T> {
  readonly size: number;
  readonly decode: (bytes: Uint8Array, index: number) => T;
  readonly encode: (value: T, path: string) => Validated<Uint8Array>;
}

/** A whole file: decoding checks its input; encoding reports every invalid field. */
export interface FileCodec<T, E> {
  readonly decode: (data: Uint8Array | ArrayBuffer) => Result<T, E>;
  readonly encode: (value: T) => Validated<Uint8Array>;
}

export interface InvalidSize {
  readonly type: 'InvalidSize';
  readonly expected: readonly number[];
  readonly actual: number;
}

/** Accept input of one of the expected sizes. */
export const sized =
  (...expected: number[]) =>
  (data: Uint8Array | ArrayBuffer): Result<Uint8Array, InvalidSize> => {
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    return expected.includes(bytes.length)
      ? Result.ok(bytes)
      : Result.err({ type: 'InvalidSize', expected, actual: bytes.length });
  };

/** The `size` bytes at `offset`. */
export const at = (bytes: Uint8Array, offset: number, size: number): Uint8Array =>
  bytes.subarray(offset, offset + size);

/** Decode `count` consecutive records starting at `offset`. */
export const records = <T>(
  codec: RecordCodec<T>,
  bytes: Uint8Array,
  offset: number,
  count: number,
): T[] =>
  Array.from({ length: count }, (_, i) =>
    codec.decode(at(bytes, offset + i * codec.size, codec.size), i),
  );

export const viewOf = (b: Uint8Array): DataView =>
  new DataView(b.buffer, b.byteOffset, b.byteLength);

const concat = (parts: readonly Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  parts.reduce((offset, p) => {
    out.set(p, offset);
    return offset + p.length;
  }, 0);
  return out;
};

/** Encode each part and join them, or report every issue from every part. */
export const join = (parts: readonly Validated<Uint8Array>[]): Validated<Uint8Array> =>
  collect(parts).map(concat);

const EMPTY = new Uint8Array(0);

export const u8 = (v: number, path: string): Validated<Uint8Array> =>
  isByte(v) ? Result.ok(Uint8Array.of(v)) : invalid(path, `${v} is not a byte`);

export const i16 = (v: number, path: string): Validated<Uint8Array> =>
  isInt16(v)
    ? Result.ok(Uint8Array.of((v >> 8) & 0xff, v & 0xff))
    : invalid(path, `${v} is not a 16-bit signed integer`);

export const fill = (size: number, value = 0): Validated<Uint8Array> =>
  Result.ok(new Uint8Array(size).fill(value));

/** Pass `bytes` through if it's exactly `size` long. */
export const exactly = (bytes: Uint8Array, size: number, path: string): Validated<Uint8Array> =>
  bytes.length === size
    ? Result.ok(bytes)
    : invalid(path, `must be ${size} bytes, got ${bytes.length}`);

/** Encode a list of records, checking there are exactly `count` of them. */
export const encodeAll = <T>(
  codec: RecordCodec<T>,
  values: readonly T[],
  count: number,
  path: string,
): Validated<Uint8Array> =>
  join([
    check(values.length === count, path, `must have ${count} entries, got ${values.length}`).map(
      () => EMPTY,
    ),
    ...values.map((v, i) => codec.encode(v, `${path}[${i}]`)),
  ]);

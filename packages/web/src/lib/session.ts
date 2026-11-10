/**
 * Autosave: the editor's work survives a reload or a closed tab. What's saved
 * is the original file bytes plus the edited channels and keys; on restore the
 * files are parsed again to recover `source`, so a re-export stays byte-exact.
 * Everything stays in this browser's localStorage.
 */

import type { Channel, Key } from '@mcmillan/2me2u-core';
import { useAtomValue, useSetAtom, type useStore } from 'jotai';
import { useEffect, useRef } from 'react';
import { blank, type Editable, fromSystem } from './edit.ts';
import { type LoadedFile, type LoadedFiles, load } from './files.ts';
import {
  configNameAtom,
  dirtyAtom,
  editAtom,
  filesAtom,
  replaceSystemAtom,
  startedAtom,
  systemAtom,
  toastAtom,
} from './store.ts';

const KEY = '2me2u:session:v1';
const DEBOUNCE_MS = 500;

interface SavedFile {
  readonly name: string;
  /** The file's bytes, base64. */
  readonly data: string;
}

/** A saved session, as stored. */
export interface Session {
  readonly version: 1;
  /** When it was saved, ms since the epoch. */
  readonly savedAt: number;
  readonly configName: string;
  readonly files: { readonly me1?: SavedFile; readonly meu?: SavedFile };
  readonly channels: readonly Channel[];
  readonly keys: readonly Key[];
  /** Whether there were unsaved edits. */
  readonly dirty: boolean;
}

// ---- base64 ----------------------------------------------------------------

const toBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
};

const fromBase64 = (text: string): Uint8Array => {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

/** Encoding the files on every keystroke is waste; they only change on load. */
const encoded = new WeakMap<LoadedFile, SavedFile>();
const saveFile = (file: LoadedFile): SavedFile => {
  let saved = encoded.get(file);
  if (!saved) {
    saved = { name: file.name, data: toBase64(file.data) };
    encoded.set(file, saved);
  }
  return saved;
};

// ---- storage ---------------------------------------------------------------

const isSession = (value: unknown): value is Session => {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Partial<Session>;
  return (
    v.version === 1 &&
    typeof v.savedAt === 'number' &&
    typeof v.configName === 'string' &&
    typeof v.files === 'object' &&
    v.files !== null &&
    Array.isArray(v.channels) &&
    Array.isArray(v.keys)
  );
};

/** The saved session, if there is a readable one. */
export const readSession = (): Session | null => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    return isSession(value) ? value : null;
  } catch {
    return null;
  }
};

export const discardSession = (): void => {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Storage unavailable: nothing to discard.
  }
};

type WriteResult = 'ok' | 'full' | 'unavailable';

const writeSession = (session: Session): WriteResult => {
  try {
    localStorage.setItem(KEY, JSON.stringify(session));
    return 'ok';
  } catch (error) {
    return error instanceof DOMException &&
      (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')
      ? 'full'
      : 'unavailable';
  }
};

// ---- restoring -------------------------------------------------------------

const toLoaded = (saved: SavedFile): File => {
  const bytes = fromBase64(saved.data);
  return new File([bytes as BlobPart], saved.name);
};

/**
 * Rebuild the editor from a saved session: the files are parsed again for
 * their `source`, and the saved channels and keys go over the top. Unsaved
 * edits come back as one undoable step over the files as loaded (or a blank
 * system), so the session is still marked unsaved and Undo returns to where
 * it started. Resolves `false` if the files couldn't be read again, in which
 * case only the channels and keys came back.
 */
export const restoreSession = async (
  session: Session,
  store: ReturnType<typeof useStore>,
): Promise<boolean> => {
  const incoming = [session.files.me1, session.files.meu].flatMap((f) => (f ? [toLoaded(f)] : []));
  let base: Editable = blank();
  let files: LoadedFiles = {};
  let ok = true;
  if (incoming.length > 0) {
    const loaded = await load(incoming, {});
    if (loaded.ok) {
      base = fromSystem(loaded.system);
      files = loaded.files;
    } else {
      ok = false;
    }
  }
  const restored: Editable = { ...base, channels: session.channels, keys: session.keys };
  if (session.dirty && ok) {
    store.set(replaceSystemAtom, { system: base, files, configName: session.configName });
    store.set(editAtom, () => restored);
  } else {
    store.set(replaceSystemAtom, { system: restored, files, configName: session.configName });
  }
  return ok;
};

// ---- the hook --------------------------------------------------------------

/**
 * Save the editor to localStorage a moment after each change, once the user
 * has started. Storage that's unavailable or full is skipped quietly, with
 * one notice if it's full.
 */
export const useAutosave = (): void => {
  const started = useAtomValue(startedAtom);
  const system = useAtomValue(systemAtom);
  const configName = useAtomValue(configNameAtom);
  const files = useAtomValue(filesAtom);
  const dirty = useAtomValue(dirtyAtom);
  const toast = useSetAtom(toastAtom);
  const warned = useRef(false);
  const pending = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!started) return;
    const save = () => {
      pending.current = null;
      const result = writeSession({
        version: 1,
        savedAt: Date.now(),
        configName,
        files: {
          ...(files.me1 ? { me1: saveFile(files.me1) } : {}),
          ...(files.meu ? { meu: saveFile(files.meu) } : {}),
        },
        channels: system.channels,
        keys: system.keys,
        dirty,
      });
      if (result === 'full' && !warned.current) {
        warned.current = true;
        toast({
          message: 'Browser storage is full, so this session won’t be kept after a reload',
          tone: 'info',
        });
      }
    };
    pending.current = save;
    const timer = setTimeout(save, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [started, system, configName, files, dirty, toast]);

  // Don't lose the last half-second of edits when the tab closes.
  useEffect(() => {
    const flush = () => pending.current?.();
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, []);
};

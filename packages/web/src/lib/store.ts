/**
 * App state as Jotai atoms. The source of truth is one editable system; what
 * it builds to, and whether the ME-1 would accept it, are derived from it.
 * Every edit goes through `editAtom`, which records history for undo.
 */

import { buildME1Config, buildMEUConfig, type Issue } from '@mcmillan/2me2u-core';
import { atom } from 'jotai';
import { blank, clean, type Editable, fromSystem } from './edit.ts';
import { configNameOf, type LoadedFiles, load } from './files.ts';

// ---- the system ------------------------------------------------------------

export const systemAtom = atom<Editable>(blank());
export const filesAtom = atom<LoadedFiles>({});
/** The 8.3 stem the `.ME1` is saved under; the ME-1 shows it as the config's name. */
export const configNameAtom = atom('NEWMIX');
/** Problems reading the last dropped files. */
export const loadIssuesAtom = atom<readonly Issue[]>([]);

/** False until the user loads files or starts from scratch: the welcome screen shows until then. */
export const startedAtom = atom(false);

/** The system as last loaded, created or exported, to tell whether there are unsaved edits. */
const baselineAtom = atom<Editable>(blank());
export const dirtyAtom = atom((get) => get(systemAtom) !== get(baselineAtom));

const draftAtom = atom((get) => clean(get(systemAtom)));
export const me1Atom = atom((get) => buildME1Config(get(draftAtom)));
export const meuAtom = atom((get) => buildMEUConfig(get(draftAtom)));
/** Why the ME-1 would reject the system as it stands; empty when it's valid. */
export const issuesAtom = atom((get): readonly Issue[] => {
  const me1 = get(me1Atom);
  return me1.isErr ? me1.error : [];
});

// ---- the editor ------------------------------------------------------------

export type View = 'keys' | 'channels';
export const viewAtom = atom<View>('keys');
/** The key open in the detail editor (0-based). */
export const selectedKeyAtom = atom(0);

// ---- history ---------------------------------------------------------------

const HISTORY_LIMIT = 200;
const pastAtom = atom<readonly Editable[]>([]);
const futureAtom = atom<readonly Editable[]>([]);
export const canUndoAtom = atom((get) => get(pastAtom).length > 0);
export const canRedoAtom = atom((get) => get(futureAtom).length > 0);

/** Apply a pure edit to the system, recording it for undo. No-op edits aren't recorded. */
export const editAtom = atom(null, (get, set, edit: (system: Editable) => Editable) => {
  const before = get(systemAtom);
  const after = edit(before);
  if (after === before) return;
  set(pastAtom, [...get(pastAtom), before].slice(-HISTORY_LIMIT));
  set(futureAtom, []);
  set(systemAtom, after);
});

export const undoAtom = atom(null, (get, set) => {
  const past = get(pastAtom);
  const previous = past.at(-1);
  if (!previous) return;
  set(pastAtom, past.slice(0, -1));
  set(futureAtom, [get(systemAtom), ...get(futureAtom)]);
  set(systemAtom, previous);
});

export const redoAtom = atom(null, (get, set) => {
  const [next, ...rest] = get(futureAtom);
  if (!next) return;
  set(futureAtom, rest);
  set(pastAtom, [...get(pastAtom), get(systemAtom)]);
  set(systemAtom, next);
});

// ---- toasts ----------------------------------------------------------------

export interface Toast {
  readonly id: number;
  readonly message: string;
  readonly tone: 'info' | 'success' | 'error';
}
export const toastsAtom = atom<readonly Toast[]>([]);
let nextToast = 1;
export const toastAtom = atom(null, (get, set, toast: Omit<Toast, 'id'>) => {
  set(toastsAtom, [...get(toastsAtom), { ...toast, id: nextToast++ }]);
});
export const dismissToastAtom = atom(null, (get, set, id: number) => {
  set(
    toastsAtom,
    get(toastsAtom).filter((t) => t.id !== id),
  );
});

// ---- lifecycle -------------------------------------------------------------

/** Replace the whole system (load, new, restore): resets history and the unsaved marker. */
export const replaceSystemAtom = atom(
  null,
  (_get, set, next: { system: Editable; files?: LoadedFiles; configName?: string }) => {
    set(systemAtom, next.system);
    set(baselineAtom, next.system);
    set(pastAtom, []);
    set(futureAtom, []);
    set(filesAtom, next.files ?? {});
    set(configNameAtom, next.configName ?? 'NEWMIX');
    set(loadIssuesAtom, []);
    set(selectedKeyAtom, 0);
    set(startedAtom, true);
  },
);

/** Start a blank system. */
export const resetAtom = atom(null, (_get, set) => {
  set(replaceSystemAtom, { system: blank() });
});

/** Mark the current system as saved (after an export). */
export const markSavedAtom = atom(null, (get, set) => {
  set(baselineAtom, get(systemAtom));
});

/** Load dropped or picked files on top of whatever is already loaded. */
export const loadAtom = atom(null, async (get, set, incoming: Iterable<File>) => {
  const loaded = await load(incoming, get(filesAtom));
  if (loaded.ok) {
    set(replaceSystemAtom, {
      system: fromSystem(loaded.system),
      files: loaded.files,
      configName: loaded.files.me1 ? configNameOf(loaded.files.me1.name) : get(configNameAtom),
    });
    const names = [loaded.files.me1?.name, loaded.files.meu?.name].filter(Boolean).join(' and ');
    set(toastAtom, { message: `Loaded ${names}`, tone: 'success' });
  } else if (loaded.issues) {
    set(loadIssuesAtom, loaded.issues);
    set(toastAtom, { message: 'Those files couldn’t be read', tone: 'error' });
  }
});

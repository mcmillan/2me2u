/**
 * App state as Jotai atoms. The source of truth is one editable system; what
 * it builds to, and whether the ME-1 would accept it, are derived from it.
 */

import { buildME1Config, buildMEUConfig, type Issue } from '@mcmillan/2me2u-core';
import { atom } from 'jotai';
import { blank, clean, type Editable, fromSystem } from './edit.ts';
import { configNameOf, type LoadedFiles, load } from './files.ts';

export const systemAtom = atom<Editable>(blank());
export const filesAtom = atom<LoadedFiles>({});
/** The 8.3 stem the `.ME1` is saved under; the ME-1 shows it as the config's name. */
export const configNameAtom = atom('NEWMIX');
export const loadIssuesAtom = atom<readonly Issue[]>([]);

const draftAtom = atom((get) => clean(get(systemAtom)));
export const me1Atom = atom((get) => buildME1Config(get(draftAtom)));
export const meuAtom = atom((get) => buildMEUConfig(get(draftAtom)));
/** Why the ME-1 would reject the system as it stands; empty when it's valid. */
export const issuesAtom = atom((get): readonly Issue[] => {
  const me1 = get(me1Atom);
  return me1.isErr ? me1.error : [];
});

/** Apply a pure edit to the system. */
export const editAtom = atom(null, (get, set, edit: (system: Editable) => Editable) => {
  set(systemAtom, edit(get(systemAtom)));
});

export const resetAtom = atom(null, (_get, set) => {
  set(systemAtom, blank());
  set(filesAtom, {});
  set(loadIssuesAtom, []);
  set(configNameAtom, 'NEWMIX');
});

/** Load dropped or picked files on top of whatever is already loaded. */
export const loadAtom = atom(null, async (get, set, incoming: Iterable<File>) => {
  const loaded = await load(incoming, get(filesAtom));
  if (loaded.ok) {
    set(filesAtom, loaded.files);
    set(systemAtom, fromSystem(loaded.system));
    set(loadIssuesAtom, []);
    if (loaded.files.me1) set(configNameAtom, configNameOf(loaded.files.me1.name));
  } else if (loaded.issues) {
    set(loadIssuesAtom, loaded.issues);
  }
});

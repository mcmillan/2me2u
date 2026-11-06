/** Getting files in from the browser and back out again. */

import {
  type Issue,
  parseConfig,
  parseME1Config,
  parseMEUConfig,
  type System,
} from '@mcmillan/2me2u-core';

export interface LoadedFile {
  readonly name: string;
  readonly data: Uint8Array;
}

export interface LoadedFiles {
  readonly me1?: LoadedFile;
  readonly meu?: LoadedFile;
}

export type Loaded =
  | { readonly ok: true; readonly files: LoadedFiles; readonly system: System }
  | { readonly ok: false; readonly issues: readonly Issue[] }
  | { readonly ok: false; readonly issues: null };

const kind = (file: File): 'me1' | 'meu' | null => {
  const ext = file.name.split('.').pop()?.toLowerCase();
  return ext === 'me1' || ext === 'meu' ? ext : null;
};

/**
 * Read dropped or picked files on top of what's already loaded, so an `.ME1`
 * and a `.meu` can arrive together or one after the other. Files of other
 * kinds are ignored; `issues: null` means nothing usable arrived.
 */
export const load = async (incoming: Iterable<File>, current: LoadedFiles): Promise<Loaded> => {
  // Copy first: a FileList is live, and the input that supplied it may be cleared
  // while we await the first file.
  const list = Array.from(incoming);
  let files: LoadedFiles = current;
  let any = false;
  for (const file of list) {
    const k = kind(file);
    if (!k) continue;
    any = true;
    files = { ...files, [k]: { name: file.name, data: new Uint8Array(await file.arrayBuffer()) } };
  }
  if (!any) return { ok: false, issues: null };

  const parsed =
    files.me1 && files.meu
      ? parseConfig({ me1: files.me1.data, meu: files.meu.data })
      : files.me1
        ? parseME1Config(files.me1.data)
        : files.meu
          ? parseMEUConfig(files.meu.data)
          : null;
  if (!parsed) return { ok: false, issues: null };
  return parsed.isOk
    ? { ok: true, files, system: parsed.value }
    : { ok: false, issues: parsed.error };
};

/** The 8.3 stem of a file name, as the ME-1 would show it. */
export const configNameOf = (fileName: string): string =>
  fileName
    .replace(/\.[^.]+$/, '')
    .toUpperCase()
    .replace(/[^0-9A-Z_-]/g, '')
    .slice(0, 8) || 'CONFIG';

/** Hand the browser a file to save. */
export const download = (data: Uint8Array | string, name: string, type: string) => {
  const blob = new Blob([data as BlobPart], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
};

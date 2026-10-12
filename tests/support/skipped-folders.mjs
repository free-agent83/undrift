// Folders a checkout of this package may hold that are not part of the package, by name. The tests that read the
// package's own files leave them out. A checkout that has such folders lists them in skipped-folders.json beside
// this file. The package on its own has no such file, and nothing is left out.
import { existsSync, readFileSync } from "node:fs";

const LIST = new URL("./skipped-folders.json", import.meta.url);

export const SKIPPED_FOLDERS = new Set(["node_modules", ...(existsSync(LIST) ? JSON.parse(readFileSync(LIST, "utf8")) : [])]);

/** Whether a path has a skipped folder among its parts. */
export const inSkippedFolder = (path) => path.split(/[\\/]/).some((part) => SKIPPED_FOLDERS.has(part));

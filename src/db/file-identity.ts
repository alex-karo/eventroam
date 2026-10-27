import { existsSync, realpathSync, statSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";

function canonicalPath(path: string): string {
  if (existsSync(path)) {
    return realpathSync(path);
  }
  const parent = dirname(path);
  return parent === path
    ? path
    : resolve(canonicalPath(parent), basename(path));
}

/** Compare path aliases and existing hard links, including future files. */
export function sameFile(left: string, right: string): boolean {
  if (canonicalPath(left) === canonicalPath(right)) {
    return true;
  }
  if (!existsSync(left) || !existsSync(right)) {
    return false;
  }
  const a = statSync(left),
    b = statSync(right);
  return a.dev === b.dev && a.ino === b.ino;
}

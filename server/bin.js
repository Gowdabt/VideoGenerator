import { existsSync } from "node:fs";

const roots = ["/opt/homebrew/bin", "/usr/local/bin"];

export function bin(name) {
  for (const root of roots) {
    const full = `${root}/${name}`;
    if (existsSync(full)) return full;
  }
  return name;
}

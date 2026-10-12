// The README is the first thing a stranger reads, on GitHub and on npm. It describes the package that is published.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { DEFAULT_RULES, OPT_IN_RULES, ALL_RULES } from "../src/rules.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const readme = readFileSync(join(ROOT, "README.md"), "utf8");
const usage = readFileSync(join(ROOT, "bin/undrift.mjs"), "utf8");
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
/** The text of a section, from its heading to the next heading of the same depth or higher. */
const section = (heading) => {
  const depth = heading.match(/^#+/)[0].length;
  const from = readme.indexOf(`\n${heading}\n`);
  expect(from, `a section called ${heading}`).toBeGreaterThan(-1);
  const rest = readme.slice(from + heading.length + 2);
  const next = rest.search(new RegExp(`^#{1,${depth}} `, "m"));
  return next === -1 ? rest : rest.slice(0, next);
};

describe("the README", () => {
  test("its Commands block is the usage text's lines for init, gate and later, and nothing else", () => {
    // The block between the first pair of fences after the heading, less the fence's own language line.
    const block = readme.split("## Commands")[1].split("```")[1].replace(/^\w*\n/, "");
    const commands = block.trim().split("\n").map((l) => l.trim().split(/\s+/)[1]);
    expect(commands).toEqual(["init", "gate", "later"]);
    for (const line of block.trim().split("\n")) expect(usage).toContain(line.trim());
  });

  test("says what it is for, and what it is not for yet", () => {
    expect(readme).toMatch(/React and Tailwind/);
    expect(readme).toMatch(/Claude Code/);
    expect(readme).toMatch(/MIT/);
  });

  test("opens with the package's description, and states the package's version", () => {
    expect(readme.split("\n")[2]).toBe(`**${pkg.description}**`);
    expect(section("## Status")).toContain(`Version ${pkg.version}.`);
  });

  test("never addresses the reader: the instructions are commands, and the prose is about the work", () => {
    expect(readme).not.toMatch(/\b(you|your|yours|yourself|yourselves)\b/i);
  });

  test("names every rule the package has, and no rule it does not", () => {
    const named = new Set([...readme.matchAll(/`(no-[a-z-]+)`/g)].map((m) => m[1]));
    expect([...named].filter((rule) => !ALL_RULES.includes(rule))).toEqual([]);
    expect(ALL_RULES.filter((rule) => !named.has(rule))).toEqual([]);
    const rows = (heading) => [...section(heading).matchAll(/^\| `(no-[a-z-]+)` \|/gm)].map((m) => m[1]);
    expect(rows("## The seven rules").sort()).toEqual([...DEFAULT_RULES].sort());
    expect(rows("## Opt-in rules").sort()).toEqual([...OPT_IN_RULES].sort());
  });

  test("registers the hook the package ships, by the command that reaches it", () => {
    const block = readme.split("Then register the hook")[1].split("```json")[1].split("```")[0];
    const command = JSON.parse(block).hooks.PostToolUse[0].hooks[0].command;
    expect(command).toBe("node node_modules/undrift/hooks/undrift-hook.mjs");
    expect(existsSync(join(ROOT, "hooks/undrift-hook.mjs"))).toBe(true);
    expect(pkg.files).toContain("hooks");
  });

  test("the names it gives the entry are names the entry exports", async () => {
    const entry = await import("../src/index.mjs");
    const names = [...section("## From code").matchAll(/`(\w+)`/g)].map((m) => m[1]).filter((n) => /^[a-z]+[A-Z]|^[A-Z_]+$/.test(n));
    expect(names.length).toBeGreaterThan(8);
    expect(names.filter((n) => !(n in entry))).toEqual([]);
  });

  test("every file it links to is in the package", () => {
    const targets = [...readme.matchAll(/\]\(([^)#]+)\)/g)].map((m) => m[1]).filter((t) => !/^[a-z]+:/.test(t));
    expect(targets.length).toBeGreaterThan(5);
    // The licence file belongs to the published repository, which adds it; this folder does not hold it.
    expect(targets.filter((t) => t !== "LICENSE" && !existsSync(join(ROOT, t)))).toEqual([]);
  });
});

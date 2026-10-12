// Words the command line says that other documents quote. They are held here so a rewording is a decision.
import { describe, expect, test } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { app, cli, INLINE_SYSTEM, LAYERED_TOKENS } from "./support/init-repos.mjs";

describe("the gate, after a violation", () => {
  test("says the messages name the exact fix, and asks for each to be applied", () => {
    const root = app(INLINE_SYSTEM);
    cli(root, ["init", "@acme/react"]);
    writeFileSync(join(root, "src/bad.tsx"), 'export const A = () => <div style={{ color: "#ff0000" }} />;\n');
    const r = cli(root, ["gate"]);
    expect(r.code).toBe(1);
    expect(r.out).toContain("The messages above name the exact fix. Apply each and re-run.");
  });
});

// A declared gap is the one thing the gate says about in a sentence of advice. Both sentences are held as written:
// an exemption cannot clear an unresolved gap (the gap is raised after the exemptions are read), so the strict message
// may not offer one, and the dev loop's line is the whole account of what a gap does there.
const GAP = 'import { Missing } from "./components/undrift-missing";\nexport const A = () => <Missing what="DateRangePicker" reason="the system has no date range picker" />;\n';

describe("the gate, about a declared gap", () => {
  test("in the dev loop it passes, and says in one sentence what a gap is and when it blocks", () => {
    const root = app(INLINE_SYSTEM);
    cli(root, ["init", "@acme/react"]);
    writeFileSync(join(root, "src/gap.tsx"), GAP);
    const r = cli(root, ["gate"]);
    expect(r.code).toBe(0);
    expect(r.out).toContain("Gaps are a success state here: the dev loop passes them, and `--strict` blocks them at release.");
  });

  test("under --strict it fails, and says how to resolve the gap with the two things that resolve it", () => {
    const root = app(INLINE_SYSTEM);
    cli(root, ["init", "@acme/react"]);
    writeFileSync(join(root, "src/gap.tsx"), GAP);
    const r = cli(root, ["gate", "--strict"]);
    expect(r.code).toBe(1);
    expect(r.out).toContain(
      'Unresolved gap "DateRangePicker" cannot ship. Resolve it first: add it to the system and use it, or replace it with an existing component.'
    );
    const message = r.out.split("\n").filter((line) => line.includes("cannot ship")).join("\n");
    expect(message).not.toMatch(/exempt/i);
  });
});

describe("the usage line", () => {
  // The opening is the package's own description, so the help and npm say the same thing.
  const DESCRIPTION = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).description;
  const OPENING = `Undrift ${DESCRIPTION[0].toLowerCase()}${DESCRIPTION.slice(1)}`;

  test("the usage text opens with what Undrift is", () => {
    expect(cli(app(INLINE_SYSTEM), ["--help"]).out.startsWith(OPENING)).toBe(true);
  });

  // Asking for help is not a mistake: it prints the usage and succeeds, whichever way it is asked.
  for (const asked of [["--help"], ["-h"], []]) {
    test(`undrift ${asked.join(" ")}`.trim() + " prints the usage and exits 0", () => {
      const r = cli(app(INLINE_SYSTEM), asked);
      expect(r.code).toBe(0);
      expect(r.out).toMatch(OPENING);
      expect(r.out).toMatch(/undrift init /);
      expect(r.out).toMatch(/undrift gate /);
      expect(r.out).toMatch(/undrift later /);
    });
  }

  // A mistake is said before the usage is shown, so the first thing read is what was wrong.
  test("a command it does not have is named, before the usage, and exits 2", () => {
    const r = cli(app(INLINE_SYSTEM), ["frobnicate"]);
    expect(r.code).toBe(2);
    expect(r.out.startsWith("Unknown command: frobnicate")).toBe(true);
    expect(r.out.indexOf("Unknown command: frobnicate")).toBeLessThan(r.out.indexOf("Usage:"));
    expect(r.out).toContain(OPENING);
  });

  test("a flag where the command goes is named too, not taken for a request for help", () => {
    const r = cli(app(INLINE_SYSTEM), ["--halp"]);
    expect(r.code).toBe(2);
    expect(r.out.startsWith("Unknown command: --halp")).toBe(true);
  });
});

// The header comment is what a person reads first in the file.
describe("the command line's header comment", () => {
  const source = readFileSync(new URL("../bin/undrift.mjs", import.meta.url), "utf8");
  const header = source.split("\n").slice(0, source.split("\n").findIndex((line) => !/^(#!|\/\/)/.test(line))).join("\n");

  test("lists init, gate and later", () => {
    for (const command of ["init", "gate", "later"]) expect(header).toContain(`undrift ${command} `);
  });

  test("says what an exit of 1 means", () => {
    expect(header).toContain("Exit codes: 0 = clean, 1 = violations");
  });
});

// (The sample's README shows what the hook says to an agent, and is held to what the hook prints. That check is about
// Plinth's README, so it runs in Plinth: packages/components/tests/undrift-adoption.test.ts.)

// The package's README says what init reads and what it prints. It is the product's README, so it is held to the
// command line: the form of the command, the folder form, and the line about the tags init leaves out.
const PACKAGE_README = new URL("../README.md", import.meta.url);
describe("the package README's account of init", () => {
  const readme = readFileSync(PACKAGE_README, "utf8");
  const bin = readFileSync(new URL("../bin/undrift.mjs", import.meta.url), "utf8");

  test("the Commands line is the usage line, and names --components", () => {
    const form = "undrift init <package> | --components <folder>  [--config <dir>] [--force]";
    expect(readme).toContain(form);
    expect(bin).toContain(form);
  });

  test("Quick start says what init reads, that it writes nothing when a reading finds nothing, and the folder form", () => {
    const quick = readme.slice(readme.indexOf("## Quick start"), readme.indexOf("Then register the hook")).replace(/\s+/g, " ");
    expect(quick).toContain("`init` reads what the system and the app already have");
    expect(quick).toContain("When a reading finds nothing it says what, and writes nothing unless `--force`.");
    expect(quick).toContain("npx undrift init --components components/ui");
    expect(quick).toContain("It ends by printing how many of the app's UI files the config covers.");
    expect(quick).toContain("undrift later --all");
  });

  test("Quick start says that a native element with no component is not checked, and not banned", () => {
    const quick = readme.slice(readme.indexOf("## Quick start"), readme.indexOf("Then register the hook")).replace(/\s+/g, " ");
    expect(quick).toContain("not checked by no-raw-elements");
    expect(quick).toContain("never bans an element it has no replacement for");
  });

  test("the words it quotes from init are words init prints", () => {
    const quick = readme.slice(readme.indexOf("## Quick start"), readme.indexOf("Then register the hook"));
    const initSource = readFileSync(new URL("../src/init.mjs", import.meta.url), "utf8");
    expect(initSource).toContain("not checked by no-raw-elements");
    expect(quick).not.toMatch(/[\u2014\u2013]/);
  });

  test("the README no longer says init sniffs a largest stylesheet", () => {
    expect(readme).not.toContain("its largest stylesheet");
    expect(readme).not.toContain("`init` sniffs");
  });
});

// A palette that dark mode re-declares step by step is never suggested as primitives, and init asks about it instead.
// The question is about the system, not the reader: the package's words never say "you" or "your".
describe("init, about palette families that each theme re-declares", () => {
  const REDECLARED =
    ":root {\n  --neutral-100: #f5f5f5; --neutral-200: #e5e5e5; --neutral-300: #d4d4d4;\n  --brand-500: #3355ff; --brand-600: #2244ee; --brand-700: #1133dd;\n" +
    "  --background: var(--neutral-100); --accent: var(--brand-500);\n}\n" +
    ".dark {\n  --neutral-100: #171717; --neutral-200: #262626; --neutral-300: #404040;\n  --brand-500: #6680ff; --brand-600: #5570ee; --brand-700: #4460dd;\n}\n";

  test("asks whether they are the system's palette, and says nothing to the reader", () => {
    const root = app({ ...LAYERED_TOKENS, "src/index.css": REDECLARED });
    const r = cli(root, ["init", "@acme/react"]);
    expect(r.out).toContain(
      'Not suggested, because each theme re-declares them: --neutral-*, --brand-*. Check whether they are the system\'s palette, and add the ones that are to "primitives" if so.'
    );
    expect(r.out).not.toMatch(/\b(you|your|yours|yourself)\b/i);
  });
});

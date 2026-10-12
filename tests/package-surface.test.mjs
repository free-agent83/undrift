// What the package publishes: its entry, the unstable path, and what its manifest says.
import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, test } from "vitest";

const PACKAGE = fileURLToPath(new URL("..", import.meta.url));
const pkg = JSON.parse(readFileSync(join(PACKAGE, "package.json"), "utf8"));
// Resolved by Node, as an adopter's code resolves them, not by the test runner's own resolver.
const load = (spec) => import(pathToFileURL(createRequire(import.meta.url).resolve(spec)).href);

describe("the package's surface", () => {
  test("the entry exports the gate, the contract, the colour index and the status line, and nothing else", async () => {
    const entry = await load("undrift");
    expect(Object.keys(entry).sort()).toEqual([
      "ALL_RULES", "DEFAULT_RULES", "compliance", "countDeclarations", "findConfig", "gapNotice", "gateFiles",
      "gatePaths", "gateProfile", "gateSource", "gateSourceWithGaps", "loadContract", "nearestToken", "parseCatalog",
      "statusLine", "tokenColorIndex",
    ]);
  });

  test("three exports: the entry, every module under undrift/unstable, and the manifest", () => {
    expect(pkg.exports).toEqual({ ".": "./src/index.mjs", "./unstable/*": "./src/*.mjs", "./package.json": "./package.json" });
  });

  test("every reader is the same module under undrift/unstable/readers as by its path", async () => {
    const readers = readdirSync(new URL("../src/readers/", import.meta.url)).filter((f) => f.endsWith(".mjs"));
    expect(readers.length).toBe(10);
    for (const file of readers) {
      const name = file.replace(/\.mjs$/, "");
      expect(await load(`undrift/unstable/readers/${name}`)).toBe(await import(`../src/readers/${name}.mjs`));
    }
  });

  test("the gate and init are reachable under undrift/unstable, by the names other code imports from them", async () => {
    expect((await load("undrift/unstable/gate")).VALUE_UTILITY_RE).toBeInstanceOf(RegExp);
    expect(Array.isArray((await load("undrift/unstable/init")).FOREIGN_UI)).toBe(true);
  });

  // npm stores a bin path without its leading "./" and, in 0.1.0, printed a warning that the entry was removed when a
  // manifest wrote it with one. The entry was never removed; the source says it the way npm stores it, so a publish is silent.
  test("the bin is written as npm stores it, with no leading ./", () => {
    expect(pkg.bin).toEqual({ undrift: "bin/undrift.mjs" });
  });

  test("the manifest names the product", () => {
    expect(pkg.name).toBe("undrift");
    expect(pkg.license).toBe("MIT");
    expect(pkg.repository).toEqual({ type: "git", url: "git+https://github.com/free-agent83/undrift.git" });
    expect(pkg.publishConfig).toEqual({ access: "public", provenance: true });
  });

  // Undrift's tests read the installed Tailwind (framework-tokens, tailwind-colours), so Undrift installs its own,
  // at the exact version every Tailwind finding was checked against. The override is Plinth's fix of its two critical
  // advisories in vitest 3's tinypool; npm ignores it in a workspace and applies it where this package is the root.
  test("the tests' own Tailwind is pinned, and vitest's tinypool is overridden", () => {
    expect(pkg.devDependencies.tailwindcss).toBe("4.3.2");
    expect(pkg.overrides).toEqual({ tinypool: "^2.1.2" });
  });
});

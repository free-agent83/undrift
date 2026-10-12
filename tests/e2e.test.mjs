// The outcome test: the gate holds a realistically implemented screen at ZERO
// drift, and catches every seeded violation in its drifted twin: by rule, with
// exact counts. It reads a real design system, Plinth, as the frozen copy of its
// contract in tests/fixtures/plinth, so it runs in Undrift's own repository.
// That the real Plinth codebase passes, and that its own configuration is honest,
// are checks about Plinth: they run there, in packages/components/tests/undrift-adoption.test.ts.
import { execFileSync, exited } from "./support/exec.mjs";
import { fileURLToPath } from "node:url";
import { resolve, dirname, join } from "node:path";
import { describe, expect, test } from "vitest";
import { loadContract } from "../src/contract.mjs";
import { gatePaths } from "../src/gate.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(here, "..");
const PLINTH = join(here, "fixtures/plinth");
const clean = join(here, "corpus/clean/settings-screen.tsx");
const drifted = join(here, "corpus/drift/settings-screen-drifted.tsx");
const contract = loadContract(PLINTH);
const appRules = contract.profiles.app.rules;

describe("a newly implemented screen", () => {
  test("clean settings screen: zero violations under the full app rule set", () => {
    const { files, violations } = gatePaths([clean], { rules: appRules, contract });
    expect(files).toBe(1);
    expect(violations).toEqual([]);
  });

  test("drifted twin: every seeded violation is caught, by rule, exact counts", () => {
    const { violations } = gatePaths([drifted], { rules: appRules, contract });
    const byRule = {};
    for (const v of violations) byRule[v.rule] = (byRule[v.rule] ?? 0) + 1;

    expect(byRule).toEqual({
      "no-foreign-ui-imports": 1, // @mui/material
      "no-raw-colors": 5, // hex const, hsl const, bg-[#f8fafc], template hex, inline style hex
      "no-arbitrary-values": 3, // bg-[#f8fafc], text-[#94a3b8], rounded-[8px]
      "no-inline-style-values": 3, // fontSize "22px", borderRadius 8, padding 14
      "no-raw-elements": 4, // input, select, button, table
    });
    expect(violations).toHaveLength(16);

    // messages are agent-legible: they name the fix, not just the crime
    const rawButton = violations.find((v) => v.found === "<button>");
    expect(rawButton.message).toContain("<Button>");
    const hex = violations.find((v) => v.found === "#e0481e");
    // Plinth's tokens have a primitive layer, so the nearest colour is a primitive and the advice
    // names the roles built on it, never the primitive.
    expect(hex.message).toContain("Roles built on it");
    expect(hex.message).toContain("var(--color-destructive)");
    expect(hex.message).not.toMatch(/use[^.]*var\(--color-primitive-/i);
  });
});

describe("the CLI end to end", () => {
  const bin = resolve(here, "../bin/undrift.mjs");

  test("undrift gate exits 1 on the drifted fixture", () => {
    let code = 0;
    let out = "";
    try {
      execFileSync(process.execPath, [bin, "gate", drifted, "--profile", "app", "--config", "tests/fixtures/plinth"], {
        cwd: packageRoot,
        encoding: "utf8",
      });
    } catch (err) {
      code = exited(err);
      out = String(err.stdout ?? "");
    }
    expect(code).toBe(1);
    // A config that is not there exits 1 as well, so the exit alone would pass for the wrong reason.
    expect(out.replace(/\x1b\[[0-9;]*m/g, "")).toContain("16 violations");
  });
});

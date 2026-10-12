import { expect, test } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadContract } from "../src/contract.mjs";

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "undrift-"));
  mkdirSync(join(dir, "ds"), { recursive: true });
  writeFileSync(join(dir, "ds/theme.css"), ":root{--color-primary:#3b5bdb;--space-4:1rem}");
  writeFileSync(join(dir, "ds/index.d.ts"), "export * from './Button';\nexport * from './Card';");
  writeFileSync(
    join(dir, "undrift.config.json"),
    JSON.stringify({
      system: "@acme/ds",
      tokensCss: "ds/theme.css",
      componentsFrom: "ds/index.d.ts",
      profiles: { app: { include: ["**/*.tsx"], rules: ["no-raw-colors"] } },
    })
  );
  return dir;
}

test("loads tokens from CSS when no DTCG json is configured", () => {
  const c = loadContract(fixture());
  expect(c.tokens["--color-primary"]).toBe("#3b5bdb");
  expect(Object.keys(c.tokens)).toHaveLength(2);
});

test("loads catalog from package type declarations", () => {
  const c = loadContract(fixture());
  expect(c.catalog.map((r) => r.name)).toEqual(["Button", "Card"]);
});

test("catalog entries from a package have no for/notFor prose", () => {
  const c = loadContract(fixture());
  expect(c.catalog[0]).toMatchObject({ name: "Button", source: "package" });
});

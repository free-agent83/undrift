// tests/readers/package-components-resolve.test.mjs
import { expect, test } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolvePackageComponents } from "../../src/readers/package-components.mjs";

function pkg() {
  const root = mkdtempSync(join(tmpdir(), "u-pkg-"));
  mkdirSync(join(root, "Table"), { recursive: true });
  writeFileSync(join(root, "index.d.ts"), "export * from './Table';\nexport * from './Button';");
  writeFileSync(join(root, "Table/index.d.ts"),
    "export { Table } from './Table';\nexport { TableRow, TableCell } from './parts';");
  writeFileSync(join(root, "Button.d.ts"), "export { Button } from './Button';");
  return join(root, "index.d.ts");
}

test("follows export * into sub-modules and collects their exports", () => {
  const names = resolvePackageComponents(pkg());
  expect(names).toContain("Table");
  expect(names).toContain("TableRow");
  expect(names).toContain("TableCell");
});

test("resolves both Dir/index.d.ts and Name.d.ts layouts", () => {
  expect(resolvePackageComponents(pkg())).toContain("Button");
});

test("returns sorted unique names and does not loop on cycles", () => {
  const entry = pkg();
  const names = resolvePackageComponents(entry);
  expect(names).toEqual([...new Set(names)].sort());
});

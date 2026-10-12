// tests/readers/package-components.test.mjs
import { expect, test } from "vitest";
import { readComponentNames, readReexportedModules } from "../../src/readers/package-components.mjs";

test("reads export-star declarations (Basalt style)", () => {
  const dts = `export * from './Button';\nexport * from './Card';`;
  expect(readComponentNames(dts)).toEqual(["Button", "Card"]);
});

test("reads named and default re-exports", () => {
  const dts = `export { default as Badge } from './Badge';\nexport { Tabs, TabsList } from './Tabs';`;
  expect(readComponentNames(dts)).toEqual(["Badge", "Tabs", "TabsList"]);
});

test("excludes types, hooks, and lowercase exports", () => {
  const dts = `export type { BaseProps } from './BaseProps';\nexport { useToast } from './useToast';\nexport * from './Button';`;
  expect(readComponentNames(dts)).toEqual(["Button"]);
});

test("deduplicates and sorts", () => {
  const dts = `export * from './Card';\nexport { Card } from './Card';\nexport * from './Avatar';`;
  expect(readComponentNames(dts)).toEqual(["Avatar", "Card"]);
});

test("reports the sub-modules an entry point re-exports", () => {
  const dts = `export * from './Table';\nexport * from './Card';`;
  expect(readReexportedModules(dts)).toEqual(["./Table", "./Card"]);
});

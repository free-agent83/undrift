import { expect, test } from "vitest";
import { countDeclarations } from "../src/gate.mjs";

const contract = {
  tokens: { "--color-primary": "#3b5bdb", "--space-4": "1rem" },
  exemptMarker: "token-exempt",
};
const count = (src) => countDeclarations(src, { fileName: "t.tsx", contract });

test("counts a var() reference to a real token as resolved", () => {
  expect(count(`const a = <div style={{ color: "var(--color-primary)" }} />;`))
    .toEqual({ total: 1, resolved: 1 });
});

test("counts a raw hex as unresolved", () => {
  expect(count(`const a = <div style={{ color: "#ff0000" }} />;`))
    .toEqual({ total: 1, resolved: 0 });
});

test("counts token-backed utility classes as resolved", () => {
  const r = count(`const a = <div className="bg-primary text-foreground" />;`);
  expect(r.total).toBe(2);
  expect(r.resolved).toBe(2);
});

test("counts arbitrary utility values as unresolved", () => {
  const r = count(`const a = <div className="bg-[#ff0000] rounded-[7px]" />;`);
  expect(r.total).toBe(2);
  expect(r.resolved).toBe(0);
});

test("ignores non-style classes and unitless numbers", () => {
  const r = count(`const a = <div className="flex items-center" style={{ opacity: 1 }} />;`);
  expect(r.total).toBe(0);
});

test("empty source has no declarations and does not divide by zero", () => {
  expect(count(`export const A = () => null;`)).toEqual({ total: 0, resolved: 0 });
});

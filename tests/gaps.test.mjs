import { expect, test } from "vitest";
import { findGaps, verifyGap } from "../src/gaps.mjs";

const contract = {
  system: "@acme/ds",
  tokens: { "--color-primary": "#3b5bdb" },
  catalog: [{ name: "Button" }, { name: "Badge" }],
};

test("finds declared gaps in source", () => {
  const src = `const a = <Missing what="DateRangePicker" reason="no range variant" />;`;
  const gaps = findGaps(src, { fileName: "a.tsx", contract });
  expect(gaps).toHaveLength(1);
  expect(gaps[0]).toMatchObject({ what: "DateRangePicker", reason: "no range variant", line: 1 });
});

test("rejects a gap for a component that exists", () => {
  expect(verifyGap({ what: "Button" }, contract)).toMatchObject({
    valid: false,
    message: expect.stringMatching(/Button exists/),
  });
});

test("accepts a gap for a component that does not exist", () => {
  expect(verifyGap({ what: "DateRangePicker" }, contract)).toMatchObject({ valid: true });
});

test("rejects a gap for a token that exists", () => {
  expect(verifyGap({ what: "--color-primary" }, contract)).toMatchObject({ valid: false });
});

test("requires a non-empty reason", () => {
  const src = `const a = <Missing what="X" reason="" />;`;
  const gaps = findGaps(src, { fileName: "a.tsx", contract });
  expect(gaps[0].valid).toBe(false);
  expect(gaps[0].message).toMatch(/reason/i);
});

test("a gap for something that exists reports that, not the missing reason", () => {
  // Both faults at once. "Use Button" is the actionable message; nagging about
  // the reason would send the agent off fixing a gap that shouldn't exist.
  const src = `const a = <Missing what="Button" reason="" />;`;
  const gaps = findGaps(src, { fileName: "a.tsx", contract });
  expect(gaps[0].valid).toBe(false);
  expect(gaps[0].message).toMatch(/Button exists/);
});

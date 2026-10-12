// The scans of the package's own files leave out folders that are not part of the package. node_modules is always one,
// and the list a checkout adds is read from the file beside the helper, if there is one.
import { describe, expect, test } from "vitest";
import { inSkippedFolder, SKIPPED_FOLDERS } from "./support/skipped-folders.mjs";

describe("the folders the scans leave out", () => {
  test("node_modules is always among them", () => {
    expect(SKIPPED_FOLDERS.has("node_modules")).toBe(true);
  });

  test("a path is skipped when any of its parts is a skipped folder, and only then", () => {
    expect(inSkippedFolder("node_modules/typescript/lib/typescript.js")).toBe(true);
    expect(inSkippedFolder("src/readers/node_modules/x.mjs")).toBe(true);
    expect(inSkippedFolder("src\\node_modules\\x.mjs")).toBe(true);
    expect(inSkippedFolder("src/gate.mjs")).toBe(false);
    expect(inSkippedFolder("src/node_modules_of_the_gate.mjs")).toBe(false);
  });
});

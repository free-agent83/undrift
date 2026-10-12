// Plinth's token layers as the graph alone reads them: Plinth's own config with `primitives` taken out,
// so nothing is declared and the graph's reading stands. Plinth declares its primitives, and a
// test that is about what the graph reads, or that compares the two, needs the undeclared reading.
// Plinth is read as the frozen copy in tests/fixtures/plinth, so the same test runs in Undrift's own repository.
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadContract } from "../../src/contract.mjs";

export const PLINTH = fileURLToPath(new URL("../fixtures/plinth/", import.meta.url));

export function plinthGraph() {
  const config = JSON.parse(readFileSync(join(PLINTH, "undrift.config.json"), "utf8"));
  delete config.primitives;
  const abs = (rel) => join(PLINTH, rel);
  const dir = mkdtempSync(join(tmpdir(), "undrift-plinth-graph-"));
  writeFileSync(join(dir, "undrift.config.json"), JSON.stringify({
    system: config.system, tokens: abs(config.tokens), tokensCss: config.tokensCss.map(abs), profiles: config.profiles,
  }));
  return loadContract(dir).layers;
}

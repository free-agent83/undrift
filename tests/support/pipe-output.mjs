// A command's output read the way a pipeline reads it, and the way a file holds it, for the tests that hold the two
// equal. See cli-output-size.test.mjs for why the two can differ. A reader that starts late fills the pipe, so a
// report cut short by the process ending shows up as a difference.
import { spawn, spawnSync } from "node:child_process";
import { closeSync, mkdtempSync, mkdirSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { expect } from "vitest";
import { ranToExit } from "./exec.mjs";
import { bin, strip } from "./init-repos.mjs";

export { strip };
export const PIPE = 64 * 1024;

/** stdout read from a pipe by a reader that starts late: what a `| jq` or a CI capture receives. */
export const piped = (root, argv) =>
  new Promise((done) => {
    const child = spawn(process.execPath, [bin, ...argv], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
    const chunks = [];
    child.stdout.on("data", (chunk) => chunks.push(chunk));
    child.stderr.resume();
    child.stdout.pause();
    setTimeout(() => child.stdout.resume(), 300);
    child.on("close", (code) => done({ code, out: Buffer.concat(chunks).toString("utf8") }));
  });

/** stdout written to a file: whole by construction. */
export const whole = (root, argv) => {
  const dir = mkdtempSync(join(tmpdir(), "u-size-out-"));
  const path = join(dir, "stdout.txt");
  const fd = openSync(path, "w");
  try {
    // Node's own spawnSync, once: the file is opened once, so a second run would append to the first's output.
    const r = ranToExit(spawnSync(process.execPath, [bin, ...argv], { cwd: root, stdio: ["ignore", fd, "pipe"] }), process.execPath, [bin, ...argv]);
    return { code: r.status, out: readFileSync(path, "utf8") };
  } finally {
    closeSync(fd);
  }
};

/** A repository with a stylesheet of one token, the files given, and a one-profile configuration over `app/`. */
export function repo(files, config) {
  const root = mkdtempSync(join(tmpdir(), "u-size-"));
  const write = (rel, body) => {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), body);
  };
  write("ds.css", ":root{--color-primary:#3b5bdb}\n");
  for (const [rel, body] of Object.entries(files)) write(rel, body);
  write(
    "undrift.config.json",
    JSON.stringify({
      system: "@acme/ds",
      tokensCss: "ds.css",
      profiles: { app: { include: ["app/**/*.tsx"], rules: ["no-raw-colors", "no-arbitrary-values"] } },
      ...config,
    })
  );
  return root;
}

export const gap = (i) =>
  `export const G${i} = () => <Missing what="Widget${i}" reason="nothing in the system does this yet, so it is declared" />;\n`;
export const named = (count, dir, body) => Object.fromEntries(Array.from({ length: count }, (_, i) => [`${dir}/f${i}.tsx`, body(i)]));

/**
 * The report through a pipe is the report to a file, and the fixture was long enough
 * to matter. A report written in one go is lost from the first 64 KiB on. One written
 * a line at a time is lost only once the reader's own buffer and the pipe are both
 * full, which takes about twice that, so it is given `min` to be well past it.
 */
export async function expectWhole(root, argv, code, min = PIPE + 16 * 1024) {
  const truth = whole(root, argv);
  expect(truth.out.length, "the fixture must be clearly longer than a pipe, or this proves nothing").toBeGreaterThan(min);
  const got = await piped(root, argv);
  expect(got.out.length).toBe(truth.out.length);
  expect(got.out).toBe(truth.out);
  expect(got.code).toBe(code);
  expect(truth.code).toBe(code);
  return got.out;
}

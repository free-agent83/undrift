// process.exit() ends the process with whatever it has not yet handed to stdout. Into a
// pipe (`undrift gate --format json | jq`, or a CI step capturing the output) the
// operating system takes 64 KiB and the rest waits inside the process, so a longer
// report was cut off mid-sentence, and JSON cut off is not JSON: whatever parses it
// reads nothing at all. The commands set the exit code and let the process end by
// itself, which is after everything has been written. The exit code is unchanged.
//
// The oracle is the same command with stdout going to a file, which is written
// synchronously and so is always whole. The pipe has to deliver exactly that. The
// reader is slow to start, as a pipeline's is when the next stage is still loading:
// the pipe fills while nothing reads it. (A JSON report is written in one go and
// abandoned, so even the fastest reader lost the end of it. A report written a line
// at a time loses its end only when the reader lags, hence the delay.)
import { describe, expect, test } from "vitest";
import { spawn, spawnSync } from "node:child_process";
import { ranToExit } from "./support/exec.mjs";
import { closeSync, mkdtempSync, openSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PIPE, expectWhole, gap, named, repo, strip, whole } from "./support/pipe-output.mjs";

const HOOK = resolve(dirname(fileURLToPath(import.meta.url)), "../hooks/undrift-hook.mjs");

const BAD = `export const B = () => <div style={{ color: "#ff0000", background: "#00ff00" }} className="bg-[#123456] p-[13px]" />;\n`;

/** The hook's stderr, read from a pipe by a reader that starts late. */
const hookPiped = (root, file) =>
  new Promise((done) => {
    const child = spawn(process.execPath, [HOOK], { cwd: root, stdio: ["pipe", "pipe", "pipe"] });
    const chunks = [];
    child.stdout.resume();
    child.stderr.on("data", (chunk) => chunks.push(chunk));
    child.stderr.pause();
    setTimeout(() => child.stderr.resume(), 300);
    child.on("close", (code) => done({ code, err: Buffer.concat(chunks).toString("utf8") }));
    child.stdin.end(JSON.stringify({ tool_input: { file_path: file } }));
  });

/** The hook's stderr written to a file: whole by construction. */
const hookWhole = (root, file) => {
  const dir = mkdtempSync(join(tmpdir(), "u-size-out-"));
  const path = join(dir, "stderr.txt");
  const fd = openSync(path, "w");
  try {
    const r = ranToExit(
      spawnSync(process.execPath, [HOOK], {
        cwd: root, input: JSON.stringify({ tool_input: { file_path: file } }), stdio: ["pipe", "pipe", fd],
      }),
      process.execPath,
      [HOOK]
    );
    return { code: r.status, err: readFileSync(path, "utf8") };
  } finally {
    closeSync(fd);
  }
};

describe("a report longer than a pipe holds arrives whole", () => {
  test("gate --format json is valid JSON with every violation in it", async () => {
    const root = repo(named(80, "app", () => BAD));
    const out = await expectWhole(root, ["gate", "--format", "json"], 1);
    // what one file contributes, so the total is not a number written into the test
    const one = JSON.parse(whole(root, ["gate", "--format", "json", "app/f0.tsx"]).out).runs[0].violations.length;
    expect(one).toBeGreaterThan(0);
    expect(JSON.parse(out).runs[0].violations).toHaveLength(80 * one);
  });

  test("the same under --strict, and the exit code still says the run failed", async () => {
    const root = repo(named(80, "app", () => BAD));
    const out = await expectWhole(root, ["gate", "--format", "json", "--strict"], 1);
    expect(JSON.parse(out).pass).toBe(false);
  });

  test("the text report carries every violation, and the lines that close it", async () => {
    const files = 250;
    const root = repo(named(files, "app", () => BAD));
    const text = strip(await expectWhole(root, ["gate"], 1, 3 * PIPE));
    const lines = (t) => t.split("\n").filter((l) => /\[no-[a-z-]+\]/.test(l)).length;
    const one = lines(strip(whole(root, ["gate", "app/f0.tsx"]).out));
    expect(one).toBeGreaterThan(0);
    expect(lines(text)).toBe(files * one);
    // the status line and the advice that follows it are the end of the report
    expect(text).toMatch(/violation/);
    expect(text.trimEnd().split("\n").at(-1)).toMatch(/\.$/);
  });

  test("a run that passes still exits 0", async () => {
    const root = repo(named(400, "app", gap));
    const out = await expectWhole(root, ["gate", "--format", "json"], 0);
    expect(JSON.parse(out).gaps).toBe(400);
  });

  // The hook is what blocks the agent, so the message it blocks with has to arrive with
  // its last line, which is the instruction. Attempts are counted per file, so the state
  // is cleared between the two runs to keep the message the same.
  test("the hook's message for a file with hundreds of violations arrives whole and still blocks", async () => {
    const many = Array.from({ length: 800 }, (_, i) => `  <div key={${i}} style={{ color: "#ff0000" }} />`).join("\n");
    const root = repo({ "app/huge.tsx": `export const H = () => (\n<>\n${many}\n</>\n);\n` });
    const file = join(root, "app/huge.tsx");
    const truth = hookWhole(root, file);
    expect(truth.err.length, "the message must be clearly longer than a pipe, or this proves nothing").toBeGreaterThan(PIPE + 16 * 1024);
    rmSync(join(root, ".undrift"), { recursive: true, force: true });
    const got = await hookPiped(root, file);
    expect(got.err.length).toBe(truth.err.length);
    expect(got.err).toBe(truth.err);
    expect(got.err.trimEnd().split("\n").at(-1)).toMatch(/instead of improvising\.$/);
    expect(got.code).toBe(2);
    expect(truth.code).toBe(2);
  });
});

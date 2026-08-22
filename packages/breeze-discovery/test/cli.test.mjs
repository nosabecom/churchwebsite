import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

test("refuses to write discovery output to a tracked repository path", () => {
  const result = spawnSync(
    process.execPath,
    [
      "scripts/discover-breeze-events.mjs",
      "--start",
      "2026-08-01",
      "--end",
      "2026-08-31",
      "--output",
      ".",
    ],
    { cwd: repositoryRoot, encoding: "utf8" },
  );

  assert.equal(result.status, 1);
  assert.match(result.stderr, /must be written below the ignored tmp\/ directory/);
});

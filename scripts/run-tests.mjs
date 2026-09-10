import { readdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

function testFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return testFiles(path);
    return entry.name.endsWith(".test.ts") ? [path] : [];
  });
}

const files = testFiles("tests");
if (files.length === 0) {
  console.error("Nenhum arquivo de teste foi encontrado.");
  process.exitCode = 1;
} else {
  const result = spawnSync(
    process.execPath,
    ["--conditions", "react-server", "--import", "tsx", "--test", ...(process.argv.includes("--runInBand") ? ["--test-concurrency=1"] : []), ...files],
    { stdio: "inherit" },
  );
  process.exitCode = result.status ?? 1;
}

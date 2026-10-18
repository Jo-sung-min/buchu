import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const task = process.argv[2];
const allowedTasks = new Set(["bootRun", "test"]);

if (!allowedTasks.has(task)) {
  console.error("사용법: node scripts/backend.mjs <bootRun|test>");
  process.exit(1);
}

const backendDirectory = fileURLToPath(new URL("../backend/", import.meta.url));
const environmentFile = fileURLToPath(new URL("../backend/.env", import.meta.url));
if (existsSync(environmentFile)) process.loadEnvFile(environmentFile);
const isWindows = process.platform === "win32";
const wrapperPath = fileURLToPath(
  new URL(isWindows ? "../backend/gradlew.bat" : "../backend/gradlew", import.meta.url),
);

if (!existsSync(wrapperPath)) {
  console.error(`Gradle Wrapper를 찾을 수 없습니다: ${wrapperPath}`);
  process.exit(1);
}

const command = isWindows ? process.env.ComSpec || "cmd.exe" : "sh";
const args = isWindows
  ? ["/d", "/s", "/c", `""${wrapperPath}" ${task}"`]
  : ["./gradlew", task];

const child = spawn(command, args, {
  cwd: backendDirectory,
  env: process.env,
  stdio: "inherit",
  windowsHide: true,
  windowsVerbatimArguments: isWindows,
});

child.on("error", (error) => {
  console.error(`백엔드를 실행하지 못했습니다: ${error.message}`);
  process.exitCode = 1;
});

child.on("exit", (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    if (!child.killed) child.kill(signal);
  });
}

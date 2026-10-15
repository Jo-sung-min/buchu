import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const action = process.argv[2] || "start";
if (!["start", "stop", "status"].includes(action)) throw new Error("사용법: node scripts/local-db.mjs start|stop|status");
const root = fileURLToPath(new URL("../", import.meta.url));
const local = path.join(root, ".local");
const data = path.join(local, "postgres");
const envFile = path.join(root, "backend", ".env");
let pgBin = process.env.PG_BIN || "";
if (!pgBin && process.platform === "win32") {
  const installed = path.join(process.env.ProgramFiles || "C:\\Program Files", "PostgreSQL");
  if (existsSync(installed)) {
    const versions = readdirSync(installed).filter(value => /^\d+$/.test(value)).sort((a, b) => Number(b) - Number(a));
    pgBin = versions.length ? path.join(installed, versions[0], "bin") : "";
  }
}
function binary(name) { return pgBin ? path.join(pgBin, `${name}${process.platform === "win32" ? ".exe" : ""}`) : name; }
function run(name, args, options = {}) {
  const result = spawnSync(binary(name), args, { windowsHide: true, encoding: "utf8", env: process.env, ...options });
  if (result.error) throw new Error(`PostgreSQL 실행 파일을 찾을 수 없습니다. PostgreSQL을 설치하거나 PG_BIN을 설정하세요. (${name})`);
  return result;
}
function required(name, args, options) {
  const result = run(name, args, options);
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${name} 실행에 실패했습니다.`);
  return result;
}
if (action !== "start") {
  if (!existsSync(path.join(data, "PG_VERSION"))) { console.log("부추 전용 로컬 DB가 아직 없습니다."); process.exit(0); }
  const result = run("pg_ctl", [action === "stop" ? "stop" : "status", "-D", data, ...(action === "stop" ? ["-m", "fast", "-w"] : [])]);
  console.log(result.stdout.trim() || result.stderr.trim());
  process.exitCode = result.status === 3 ? 0 : result.status;
} else {
  // Create only this project's ignored configuration; never replace existing credentials.
  mkdirSync(local, { recursive: true });
  if (!existsSync(envFile)) {
    const password = randomBytes(24).toString("hex");
    const adminPassword = randomBytes(24).toString("hex");
    const template = readFileSync(path.join(root, "backend", ".env.example"), "utf8")
      .replace("DB_PASSWORD=replace-with-your-local-database-password", `DB_PASSWORD=${password}`)
      .replace(/^ADMIN_PASSWORD=$/m, `ADMIN_PASSWORD=${adminPassword}`);
    writeFileSync(envFile, template, { mode: 0o600 });
    console.log("backend/.env에 로컬 DB와 관리자 암호를 생성했습니다. 기존 환경변수로 덮어쓸 수 있습니다.");
  }
  process.loadEnvFile(envFile);
  if (!/^jdbc:postgresql:\/\/(?:localhost|127\.0\.0\.1):5433\/buchu$/.test(process.env.DB_URL || "")) {
    throw new Error("backend/.env가 별도 DB를 가리키고 있습니다. 해당 DB를 직접 실행하거나 DB_URL을 로컬 5433/buchu로 설정하세요.");
  }
  if (!process.env.DB_PASSWORD || process.env.DB_PASSWORD === "replace-with-your-local-database-password") {
    throw new Error("backend/.env의 DB_PASSWORD를 설정해 주세요.");
  }
  if (!existsSync(path.join(data, "PG_VERSION"))) {
    const passwordFile = path.join(local, "init-password.tmp");
    try {
      writeFileSync(passwordFile, process.env.DB_PASSWORD, { mode: 0o600 });
      required("initdb", ["-D", data, "-U", process.env.DB_USERNAME || "buchu", "-A", "scram-sha-256", `--pwfile=${passwordFile}`, "--encoding=UTF8", "--locale=C"]);
    } finally { if (existsSync(passwordFile)) rmSync(passwordFile); }
  }
  const status = run("pg_ctl", ["status", "-D", data]);
  // Do not leave pipe handles inherited by the long-lived Windows postgres process.
  if (status.status !== 0) required("pg_ctl", ["start", "-D", data, "-l", path.join(local, "postgres.log"), "-o", "-p 5433 -h 127.0.0.1", "-w"], { stdio: "ignore", timeout: 60_000 });
  const connection = ["-h", "127.0.0.1", "-p", "5433", "-U", process.env.DB_USERNAME || "buchu"];
  const options = { env: { ...process.env, PGPASSWORD: process.env.DB_PASSWORD } };
  const database = required("psql", [...connection, "-d", "postgres", "-tAc", "SELECT 1 FROM pg_database WHERE datname = 'buchu'"], options);
  if (database.stdout.trim() !== "1") required("createdb", [...connection, "buchu"], options);
  console.log("부추 전용 PostgreSQL이 127.0.0.1:5433에서 실행 중입니다. 데이터: .local/postgres");
}

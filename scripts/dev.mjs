import { spawn } from "node:child_process";
import path from "node:path";

const projectRoot = process.cwd();
const viteCli = path.join(projectRoot, "node_modules", "vite", "bin", "vite.js");
const forwardedArgs = process.argv.slice(2).filter((arg) => arg !== "--");
const uiArgs = [viteCli, "--host", "127.0.0.1", ...forwardedArgs];
const children = [];
let shuttingDown = false;

const api = spawn(process.execPath, ["server/index.js"], {
  cwd: projectRoot,
  env: {
    ...process.env,
    SKILL_MANAGER_HOST: "127.0.0.1",
    SKILL_MANAGER_PORT: process.env.SKILL_MANAGER_PORT ?? "5174",
  },
  stdio: "inherit",
});
children.push(api);

const ui = spawn(process.execPath, uiArgs, {
  cwd: projectRoot,
  stdio: "inherit",
});
children.push(ui);

for (const child of children) {
  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    shutdown();
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    if (shuttingDown) return;
    shuttingDown = true;
    shutdown(signal);
  });
}

function shutdown(signal = "SIGTERM") {
  for (const child of children) {
    if (!child.killed) child.kill(signal);
  }
}

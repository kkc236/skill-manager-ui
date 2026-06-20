import { access, mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function getCodexSkillsRoot(env = process.env, homeDir = homedir()) {
  const codexHome = String(env.CODEX_HOME ?? "").trim() || path.join(homeDir, ".codex");
  return path.join(codexHome, "skills");
}

export async function ensureCodexSkillsRoot(env = process.env, homeDir = homedir()) {
  const skillsRoot = getCodexSkillsRoot(env, homeDir);
  await mkdir(skillsRoot, { recursive: true });
  return skillsRoot;
}

export async function needsDependencyInstall(projectRoot) {
  return !(await pathExists(path.join(projectRoot, "node_modules", "vite", "bin", "vite.js")));
}

export async function bootstrap({
  env = process.env,
  forceInstall = false,
  homeDir = homedir(),
  projectRoot = process.cwd(),
  runCommand = runCommandInherit,
} = {}) {
  await ensureCodexSkillsRoot(env, homeDir);

  if (forceInstall || (await needsDependencyInstall(projectRoot))) {
    await runCommand("corepack", ["enable"], { cwd: projectRoot, env });
    await runCommand("corepack", ["pnpm", "install"], { cwd: projectRoot, env });
  }
}

async function pathExists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

function runCommandInherit(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      shell: process.platform === "win32",
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
    });
  });
}

const entryPoint = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (entryPoint === fileURLToPath(import.meta.url)) {
  bootstrap({
    forceInstall: process.argv.includes("--force-install"),
  }).catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

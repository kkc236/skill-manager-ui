// @vitest-environment node
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  bootstrap,
  ensureCodexSkillsRoot,
  getCodexSkillsRoot,
  needsDependencyInstall,
} from "./bootstrap.mjs";

const tempRoots = [];

async function makeTempRoot() {
  const root = path.join(tmpdir(), `skill-deck-bootstrap-${Date.now()}-${Math.random()}`);
  await mkdir(root, { recursive: true });
  tempRoots.push(root);
  return root;
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

describe("bootstrap", () => {
  it("resolves the Codex skills root without installing Codex itself", () => {
    const codexHome = path.join("C:", "Users", "fixture", ".codex-custom");

    expect(getCodexSkillsRoot({ CODEX_HOME: codexHome }, path.join("C:", "Users", "fixture"))).toBe(
      path.join(codexHome, "skills"),
    );
    expect(getCodexSkillsRoot({}, path.join("C:", "Users", "fixture"))).toBe(
      path.join("C:", "Users", "fixture", ".codex", "skills"),
    );
  });

  it("creates only the skills directory Codex needs to access", async () => {
    const root = await makeTempRoot();
    const codexHome = path.join(root, "codex");

    const skillsRoot = await ensureCodexSkillsRoot({ CODEX_HOME: codexHome }, root);

    expect(skillsRoot).toBe(path.join(codexHome, "skills"));
    expect(await exists(skillsRoot)).toBe(true);
    expect(await exists(path.join(codexHome, "bin", "codex"))).toBe(false);
  });

  it("detects when pnpm dependencies still need to be installed", async () => {
    const projectRoot = await makeTempRoot();
    expect(await needsDependencyInstall(projectRoot)).toBe(true);

    await mkdir(path.join(projectRoot, "node_modules", "vite", "bin"), { recursive: true });
    await writeFile(path.join(projectRoot, "node_modules", "vite", "bin", "vite.js"), "", "utf8");

    expect(await needsDependencyInstall(projectRoot)).toBe(false);
  });

  it("installs dependencies when missing and always prepares the skills folder", async () => {
    const projectRoot = await makeTempRoot();
    const codexHome = path.join(projectRoot, "codex-home");
    const commands = [];

    await bootstrap({
      env: { CODEX_HOME: codexHome },
      homeDir: projectRoot,
      projectRoot,
      runCommand: async (command, args) => {
        commands.push([command, args]);
      },
    });

    expect(commands).toEqual([
      ["corepack", ["enable"]],
      ["corepack", ["pnpm", "install"]],
    ]);
    expect(await exists(path.join(codexHome, "skills"))).toBe(true);
  });

  it("starts through bootstrap before running pnpm dev", async () => {
    const startScript = await readFile(path.join("scripts", "start-skill-deck.ps1"), "utf8");

    expect(startScript).toContain("bootstrap.mjs");
    expect(startScript.indexOf("bootstrap.mjs")).toBeLessThan(startScript.indexOf("corepack pnpm dev"));
  });

  it("ships a Windows installer that creates a desktop shortcut", async () => {
    const installScript = await readFile(path.join("scripts", "install-skill-deck.ps1"), "utf8");

    expect(installScript).toContain("CreateShortcut");
    expect(installScript).toContain("Skill Deck.lnk");
    expect(installScript).toContain("start-skill-deck.ps1");
  });
});

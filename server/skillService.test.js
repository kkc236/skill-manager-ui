// @vitest-environment node
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  activateSkill,
  assignSkillCategory,
  createCategory,
  deactivateSkill,
  listSkills,
  parseGithubSkillUrl,
  readSkillFile,
  saveSkillFile,
} from "./skillService.js";

const tempRoots = [];

async function makeFixture() {
  const root = path.join(tmpdir(), `skill-deck-${Date.now()}-${Math.random()}`);
  await mkdir(root, { recursive: true });
  tempRoots.push(root);

  const projectRoot = path.join(root, "project");
  const codexHome = path.join(root, "codex");
  await mkdir(projectRoot, { recursive: true });
  await mkdir(path.join(codexHome, "skills"), { recursive: true });

  return {
    codexHome,
    options: { codexHome, projectRoot },
    projectRoot,
  };
}

async function writeSkill(skillDir, name, description = "Fixture skill") {
  await mkdir(skillDir, { recursive: true });
  await writeFile(
    path.join(skillDir, "SKILL.md"),
    `---\nname: ${name}\ndescription: ${description}\nversion: 1.0.0\n---\n\nUse this skill for tests.\n`,
    "utf8",
  );
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

describe("skill service", () => {
  it("mirrors existing user Codex skills into the project vault", async () => {
    const { codexHome, options, projectRoot } = await makeFixture();
    await writeSkill(
      path.join(codexHome, "skills", "paper-helper"),
      "paper-helper",
      "Draft and verify papers",
    );

    const inventory = await listSkills(options);
    const skill = inventory.skills.find((item) => item.name === "paper-helper");

    expect(skill).toMatchObject({
      enabled: true,
      installed: true,
      name: "paper-helper",
      source: "imported",
    });
    expect(await exists(path.join(projectRoot, "skill-vault", "skills", "paper-helper", "SKILL.md"))).toBe(
      true,
    );
  });

  it("activates and deactivates a vault skill without deleting the vault copy", async () => {
    const { codexHome, options, projectRoot } = await makeFixture();
    await writeSkill(
      path.join(projectRoot, "skill-vault", "skills", "japanese-tutor"),
      "japanese-tutor",
      "Practice Japanese conversation",
    );

    let inventory = await listSkills(options);
    expect(inventory.skills.find((item) => item.id === "japanese-tutor")).toMatchObject({
      enabled: false,
      installed: true,
    });

    await activateSkill("japanese-tutor", options);
    expect(await exists(path.join(codexHome, "skills", "japanese-tutor", "SKILL.md"))).toBe(true);

    inventory = await listSkills(options);
    expect(inventory.skills.find((item) => item.id === "japanese-tutor")).toMatchObject({
      enabled: true,
      installed: true,
    });

    await deactivateSkill("japanese-tutor", options);
    expect(await exists(path.join(codexHome, "skills", "japanese-tutor", "SKILL.md"))).toBe(false);
    expect(
      await readFile(path.join(projectRoot, "skill-vault", "skills", "japanese-tutor", "SKILL.md"), "utf8"),
    ).toContain("japanese-tutor");
  });

  it("parses GitHub tree URLs for skill downloads", () => {
    expect(
      parseGithubSkillUrl(
        "https://github.com/openclaw/skills/tree/main/skills/chndranndr/japanese-tutor",
      ),
    ).toEqual({
      branch: "main",
      owner: "openclaw",
      repo: "skills",
      skillPath: "skills/chndranndr/japanese-tutor",
    });
  });

  it("creates categories and persists skill filing inside the vault state", async () => {
    const { options, projectRoot } = await makeFixture();
    await writeSkill(
      path.join(projectRoot, "skill-vault", "skills", "frontend-helper"),
      "frontend-helper",
      "Build UI surfaces",
    );

    const created = await createCategory("前端工具", options);
    expect(created.categories.find((category) => category.name === "前端工具")).toMatchObject({
      id: "frontend-tools",
      name: "前端工具",
    });

    const assigned = await assignSkillCategory("frontend-helper", "frontend-tools", options);
    const skill = assigned.skills.find((item) => item.id === "frontend-helper");

    expect(skill).toMatchObject({
      categoryId: "frontend-tools",
      categoryName: "前端工具",
    });

    const reloaded = await listSkills(options);
    expect(reloaded.skills.find((item) => item.id === "frontend-helper")).toMatchObject({
      categoryId: "frontend-tools",
      categoryName: "前端工具",
    });
  });

  it("reads and saves a vault skill markdown file without deleting the active copy", async () => {
    const { codexHome, options, projectRoot } = await makeFixture();
    const vaultSkillDir = path.join(projectRoot, "skill-vault", "skills", "paper-helper");
    await writeSkill(vaultSkillDir, "paper-helper", "Draft and verify papers");
    await activateSkill("paper-helper", options);

    const file = await readSkillFile("paper-helper", options);
    expect(file).toMatchObject({
      id: "paper-helper",
      path: path.join(vaultSkillDir, "SKILL.md"),
    });
    expect(file.content).toContain("Draft and verify papers");

    const updated = "---\nname: paper-helper\ndescription: Updated live copy\n---\n\n# Paper Helper\n";
    const inventory = await saveSkillFile("paper-helper", updated, options);

    await expect(readFile(path.join(vaultSkillDir, "SKILL.md"), "utf8")).resolves.toBe(updated);
    await expect(readFile(path.join(codexHome, "skills", "paper-helper", "SKILL.md"), "utf8")).resolves.toBe(updated);
    expect(inventory.skills.find((item) => item.id === "paper-helper")).toMatchObject({
      description: "Updated live copy",
      enabled: true,
    });
  });
});

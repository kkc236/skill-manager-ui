import { createWriteStream } from "node:fs";
import {
  access,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { get } from "node:https";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const defaultState = {
  activity: [],
  assignments: {},
  categories: [],
  remotes: {},
  sources: {},
};

const defaultCategories = [
  { color: "#8b5cf6", id: "writing", name: "论文写作" },
  { color: "#0ea5e9", id: "frontend", name: "前端与界面" },
  { color: "#10b981", id: "automation", name: "自动化工具" },
  { color: "#f97316", id: "debugging", name: "调试测试" },
  { color: "#64748b", id: "documents", name: "文档文件" },
  { color: "#71717a", id: "uncategorized", name: "未分类" },
];

export function getServicePaths(options = {}) {
  const projectRoot = path.resolve(options.projectRoot ?? process.cwd());
  const codexHome = path.resolve(
    options.codexHome ?? process.env.CODEX_HOME ?? path.join(homedir(), ".codex"),
  );
  const vaultRoot = path.join(projectRoot, "skill-vault");

  return {
    codexHome,
    codexSkillsRoot: path.join(codexHome, "skills"),
    projectRoot,
    statePath: path.join(vaultRoot, "state.json"),
    vaultRoot,
    vaultSkillsRoot: path.join(vaultRoot, "skills"),
  };
}

export async function listSkills(options = {}) {
  const paths = getServicePaths(options);
  await ensureRoots(paths);
  const state = await loadState(paths);
  ensureCategoryState(state);
  await mirrorCodexSkills(paths, state);
  await saveState(paths, state);

  const entries = await readSkillDirectories(paths.vaultSkillsRoot);
  const skills = await Promise.all(
    entries.map(async (entry) => buildInventorySkill(entry, paths, state)),
  );

  skills.sort((a, b) => {
    if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return {
    activity: state.activity.slice(0, 20),
    categories: buildCategorySummary(state.categories, skills),
    codexHome: paths.codexHome,
    skills,
    vaultRoot: paths.vaultRoot,
  };
}

export async function createCategory(name, options = {}) {
  const paths = getServicePaths(options);
  await ensureRoots(paths);
  const state = await loadState(paths);
  ensureCategoryState(state);

  const trimmedName = String(name ?? "").trim();
  if (!trimmedName) throw httpError(400, "Category name is required.");

  const category = {
    color: pickCategoryColor(state.categories.length),
    id: normalizeCategoryId(trimmedName),
    name: trimmedName,
  };
  if (state.categories.some((item) => item.id === category.id)) {
    throw httpError(409, `Category "${category.name}" already exists.`);
  }

  state.categories.push(category);
  recordActivity(state, {
    detail: category.name,
    title: "已创建分类文件夹",
    tone: "good",
  });
  await saveState(paths, state);
  return listSkills(options);
}

export async function assignSkillCategory(id, categoryId, options = {}) {
  const paths = getServicePaths(options);
  await ensureRoots(paths);
  const skillId = normalizeSkillId(id);
  const state = await loadState(paths);
  ensureCategoryState(state);
  const targetCategoryId = normalizeCategoryId(categoryId);
  const category = state.categories.find((item) => item.id === targetCategoryId);

  if (!category) throw httpError(404, `Category "${targetCategoryId}" was not found.`);
  await assertSkillExists(getVaultSkillDir(paths, skillId), `Skill "${skillId}" is not in the project vault.`);

  state.assignments[skillId] = targetCategoryId;
  recordActivity(state, {
    detail: `${skillId} -> ${category.name}`,
    title: "已更新 skill 归类",
    tone: "good",
  });
  await saveState(paths, state);
  return listSkills(options);
}

export async function activateSkill(id, options = {}) {
  const paths = getServicePaths(options);
  await ensureRoots(paths);
  const skillId = normalizeSkillId(id);
  const vaultDir = getVaultSkillDir(paths, skillId);
  const codexDir = getCodexSkillDir(paths, skillId);

  await assertSkillExists(vaultDir, `Skill "${skillId}" is not in the project vault.`);
  await rm(codexDir, { force: true, recursive: true });
  await cp(vaultDir, codexDir, { recursive: true });

  const state = await loadState(paths);
  ensureCategoryState(state);
  recordActivity(state, {
    detail: skillId,
    title: "已激活到 Codex",
    tone: "good",
  });
  await saveState(paths, state);
  return listSkills(options);
}

export async function deactivateSkill(id, options = {}) {
  const paths = getServicePaths(options);
  await ensureRoots(paths);
  const skillId = normalizeSkillId(id);
  const codexDir = getCodexSkillDir(paths, skillId);

  await rm(codexDir, { force: true, recursive: true });

  const state = await loadState(paths);
  ensureCategoryState(state);
  recordActivity(state, {
    detail: skillId,
    title: "已从 Codex 关闭",
    tone: "neutral",
  });
  await saveState(paths, state);
  return listSkills(options);
}

export async function installSkillFromGithub(githubUrl, options = {}) {
  const paths = getServicePaths(options);
  await ensureRoots(paths);
  const parsed = parseGithubSkillUrl(githubUrl);
  const tempRoot = await mkdtemp(path.join(tmpdir(), "skill-deck-download-"));
  const zipPath = path.join(tempRoot, `${parsed.repo}.zip`);
  const extractRoot = path.join(tempRoot, "extract");

  try {
    await mkdir(extractRoot, { recursive: true });
    await downloadGithubArchive(parsed, zipPath);
    await extractZip(zipPath, extractRoot);

    const repoRoot = await findExtractedRepoRoot(extractRoot);
    const skillSourceDir = path.resolve(repoRoot, parsed.skillPath);
    assertInside(repoRoot, skillSourceDir, "GitHub skill path escapes the downloaded archive.");
    await assertSkillExists(skillSourceDir, "Downloaded folder does not contain a SKILL.md file.");

    const metadata = await readSkillMetadata(skillSourceDir);
    const skillId = normalizeSkillId(metadata.name || path.basename(skillSourceDir));
    const vaultDir = getVaultSkillDir(paths, skillId);
    const alreadyExists = await pathExists(vaultDir);
    if (alreadyExists && !options.replace) {
      throw httpError(409, `Skill "${skillId}" already exists in the vault.`);
    }

    await rm(vaultDir, { force: true, recursive: true });
    await cp(skillSourceDir, vaultDir, { recursive: true });

    const state = await loadState(paths);
    ensureCategoryState(state);
    state.sources[skillId] = "github";
    state.assignments[skillId] = state.assignments[skillId] ?? inferCategoryId(skillId, metadata, "github");
    state.remotes[skillId] = {
      ...parsed,
      url: githubUrl,
    };
    recordActivity(state, {
      detail: githubUrl,
      title: `已下载 ${skillId}`,
      tone: "good",
    });
    await saveState(paths, state);

    if (options.activate) {
      await activateSkill(skillId, options);
    }

    return listSkills(options);
  } finally {
    await rm(tempRoot, { force: true, recursive: true });
  }
}

export async function updateSkill(id, options = {}) {
  const paths = getServicePaths(options);
  const skillId = normalizeSkillId(id);
  const state = await loadState(paths);
  ensureCategoryState(state);
  const remote = state.remotes[skillId];

  if (!remote?.url) {
    const inventory = await listSkills(options);
    const current = inventory.skills.find((skill) => skill.id === skillId);
    if (!current) throw httpError(404, `Skill "${skillId}" was not found.`);
    recordActivity(state, {
      detail: skillId,
      title: "没有远程来源，已重新扫描",
      tone: "neutral",
    });
    await saveState(paths, state);
    return listSkills(options);
  }

  const wasEnabled = await pathExists(getCodexSkillDir(paths, skillId));
  await installSkillFromGithub(remote.url, { ...options, replace: true });
  if (wasEnabled) await activateSkill(skillId, options);
  return listSkills(options);
}

export async function readSkillFile(id, options = {}) {
  const paths = getServicePaths(options);
  await ensureRoots(paths);
  const skillId = normalizeSkillId(id);
  const skillDir = getVaultSkillDir(paths, skillId);
  const skillPath = path.join(skillDir, "SKILL.md");

  await assertSkillExists(skillDir, `Skill "${skillId}" is not in the project vault.`);
  return {
    content: await readFile(skillPath, "utf8"),
    id: skillId,
    path: skillPath,
  };
}

export async function saveSkillFile(id, content, options = {}) {
  const paths = getServicePaths(options);
  await ensureRoots(paths);
  const skillId = normalizeSkillId(id);
  const vaultDir = getVaultSkillDir(paths, skillId);
  const codexDir = getCodexSkillDir(paths, skillId);
  const skillPath = path.join(vaultDir, "SKILL.md");
  const markdown = String(content ?? "");

  if (!markdown.trim()) throw httpError(400, "SKILL.md content is required.");
  await assertSkillExists(vaultDir, `Skill "${skillId}" is not in the project vault.`);

  const wasEnabled = await pathExists(path.join(codexDir, "SKILL.md"));
  await writeFile(skillPath, markdown, "utf8");
  if (wasEnabled) {
    await rm(codexDir, { force: true, recursive: true });
    await cp(vaultDir, codexDir, { recursive: true });
  }

  const state = await loadState(paths);
  ensureCategoryState(state);
  recordActivity(state, {
    detail: skillId,
    title: wasEnabled ? "SKILL.md 已保存并同步" : "SKILL.md 已保存",
    tone: "good",
  });
  await saveState(paths, state);
  return listSkills(options);
}

export async function exportManifest(options = {}) {
  const inventory = await listSkills(options);
  return {
    codexHome: inventory.codexHome,
    categories: inventory.categories,
    exportedAt: new Date().toISOString(),
    skills: inventory.skills.map((skill) => ({
      codexPath: skill.codexPath,
      enabled: skill.enabled,
      id: skill.id,
      name: skill.name,
      source: skill.source,
      vaultPath: skill.vaultPath,
      version: skill.version,
    })),
    vaultRoot: inventory.vaultRoot,
  };
}

export function parseGithubSkillUrl(githubUrl) {
  const input = String(githubUrl ?? "").trim();
  if (!input) throw httpError(400, "GitHub URL is required.");

  const url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
  if (url.hostname !== "github.com") {
    throw httpError(400, "Only github.com skill URLs are supported.");
  }

  const parts = url.pathname.split("/").filter(Boolean);
  const [owner, repoWithSuffix] = parts;
  if (!owner || !repoWithSuffix) {
    throw httpError(400, "GitHub URL must include owner and repo.");
  }

  const repo = repoWithSuffix.replace(/\.git$/i, "");
  if (parts[2] === "tree") {
    const branch = parts[3];
    if (!branch) throw httpError(400, "GitHub tree URL must include a branch.");
    return {
      branch,
      owner,
      repo,
      skillPath: parts.slice(4).join("/"),
    };
  }

  return {
    branch: "main",
    owner,
    repo,
    skillPath: "",
  };
}

async function buildInventorySkill(entry, paths, state) {
  const metadata = await readSkillMetadata(entry.fullPath);
  const codexDir = getCodexSkillDir(paths, entry.id);
  const enabled = await pathExists(path.join(codexDir, "SKILL.md"));
  const entryStats = await stat(entry.fullPath);
  const source = enabled && state.sources[entry.id] == null ? "imported" : state.sources[entry.id] ?? "vault";
  const categoryId = state.assignments[entry.id] ?? inferCategoryId(entry.id, metadata, source);
  const category = state.categories.find((item) => item.id === categoryId) ?? getDefaultCategory("uncategorized");

  return {
    categoryId: category.id,
    categoryName: category.name,
    codexPath: codexDir,
    description: metadata.description || "本地 Skill Vault 中的技能。",
    enabled,
    id: entry.id,
    installed: true,
    name: metadata.name || entry.id,
    path: entry.fullPath,
    source,
    status: "healthy",
    triggers: metadata.triggers.length > 0 ? metadata.triggers : [source, entry.id],
    updatedAt: formatUpdatedAt(entryStats.mtime),
    vaultPath: entry.fullPath,
    version: metadata.version || "local",
  };
}

async function mirrorCodexSkills(paths, state) {
  const entries = await readSkillDirectories(paths.codexSkillsRoot, {
    excludeNames: new Set([".system"]),
  });

  for (const entry of entries) {
    const vaultDir = getVaultSkillDir(paths, entry.id);
    if (!(await pathExists(vaultDir))) {
      await cp(entry.fullPath, vaultDir, { recursive: true });
      state.sources[entry.id] = state.sources[entry.id] ?? "imported";
      state.assignments[entry.id] = state.assignments[entry.id] ?? inferCategoryId(entry.id, await readSkillMetadata(entry.fullPath), "imported");
      recordActivity(state, {
        detail: entry.id,
        title: "已导入现有 Codex skill",
        tone: "good",
      });
    }
  }
}

async function readSkillDirectories(root, options = {}) {
  if (!(await pathExists(root))) return [];

  const excludeNames = options.excludeNames ?? new Set();
  const entries = await readdir(root, { withFileTypes: true });
  const directories = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || excludeNames.has(entry.name) || entry.name.startsWith(".")) continue;
    const id = normalizeSkillId(entry.name);
    const fullPath = path.join(root, entry.name);
    if (await pathExists(path.join(fullPath, "SKILL.md"))) {
      directories.push({ fullPath, id });
    }
  }

  return directories;
}

async function readSkillMetadata(skillDir) {
  const skillPath = path.join(skillDir, "SKILL.md");
  const markdown = await readFile(skillPath, "utf8");
  const fallbackName = path.basename(skillDir);
  return parseSkillMarkdown(markdown, fallbackName);
}

export function parseSkillMarkdown(markdown, fallbackName) {
  const metadata = {
    description: "",
    name: fallbackName,
    triggers: [],
    version: "local",
  };
  const trimmed = markdown.trimStart();

  if (trimmed.startsWith("---")) {
    const end = trimmed.indexOf("\n---", 3);
    if (end !== -1) {
      const frontmatter = trimmed.slice(3, end).split(/\r?\n/);
      for (const line of frontmatter) {
        const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
        if (!match) continue;
        const key = match[1].toLowerCase();
        const value = cleanYamlValue(match[2]);
        if (key === "name" && value) metadata.name = value;
        if (key === "description" && value) metadata.description = value;
        if (key === "version" && value) metadata.version = value;
        if (key === "triggers" && value) {
          metadata.triggers = value
            .split(",")
            .map((item) => cleanYamlValue(item))
            .filter(Boolean);
        }
      }
    }
  }

  if (!metadata.description) {
    const paragraph = markdown
      .replace(/^---[\s\S]*?\n---/, "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line && !line.startsWith("#"));
    metadata.description = paragraph || "本地 Skill Vault 中的技能。";
  }

  return metadata;
}

async function ensureRoots(paths) {
  await mkdir(paths.codexSkillsRoot, { recursive: true });
  await mkdir(paths.vaultSkillsRoot, { recursive: true });
}

async function loadState(paths) {
  try {
    const raw = await readFile(paths.statePath, "utf8");
    const parsed = JSON.parse(raw);
    return {
      activity: Array.isArray(parsed.activity) ? parsed.activity : [],
      assignments: parsed.assignments && typeof parsed.assignments === "object" ? parsed.assignments : {},
      categories: Array.isArray(parsed.categories) ? parsed.categories : [],
      remotes: parsed.remotes && typeof parsed.remotes === "object" ? parsed.remotes : {},
      sources: parsed.sources && typeof parsed.sources === "object" ? parsed.sources : {},
    };
  } catch {
    return structuredClone(defaultState);
  }
}

function ensureCategoryState(state) {
  state.assignments = state.assignments && typeof state.assignments === "object" ? state.assignments : {};
  state.categories = Array.isArray(state.categories) ? state.categories : [];

  for (const category of defaultCategories) {
    if (!state.categories.some((item) => item.id === category.id)) {
      state.categories.push(category);
    }
  }
}

function buildCategorySummary(categories, skills) {
  return categories.map((category) => ({
    ...category,
    activeCount: skills.filter((skill) => skill.categoryId === category.id && skill.enabled).length,
    count: skills.filter((skill) => skill.categoryId === category.id).length,
  }));
}

async function saveState(paths, state) {
  await mkdir(path.dirname(paths.statePath), { recursive: true });
  await writeFile(paths.statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

function recordActivity(state, item) {
  const activity = {
    id: `act-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    time: "刚刚",
    ...item,
  };
  state.activity = [activity, ...(state.activity ?? [])].slice(0, 50);
}

function getVaultSkillDir(paths, id) {
  const skillId = normalizeSkillId(id);
  const target = path.resolve(paths.vaultSkillsRoot, skillId);
  assertInside(paths.vaultSkillsRoot, target, "Vault skill path escapes the vault root.");
  return target;
}

function getCodexSkillDir(paths, id) {
  const skillId = normalizeSkillId(id);
  if (skillId === ".system") throw httpError(400, "System skill folders cannot be managed here.");
  const target = path.resolve(paths.codexSkillsRoot, skillId);
  assertInside(paths.codexSkillsRoot, target, "Codex skill path escapes the Codex skills root.");
  return target;
}

function normalizeSkillId(value) {
  const id = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!id || id.startsWith(".")) throw httpError(400, "Invalid skill id.");
  return id;
}

function normalizeCategoryId(value) {
  const raw = String(value ?? "").trim();
  const knownCategoryIds = new Map([
    ["前端工具", "frontend-tools"],
    ["前端与界面", "frontend"],
    ["论文写作", "writing"],
    ["自动化工具", "automation"],
    ["调试测试", "debugging"],
    ["文档文件", "documents"],
    ["未分类", "uncategorized"],
  ]);
  const known = knownCategoryIds.get(raw);
  if (known) return known;

  const id = raw
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (id) return id;

  return `cat-${createHash("sha1").update(raw).digest("hex").slice(0, 8)}`;
}

function inferCategoryId(skillId, metadata, source) {
  const haystack = [
    skillId,
    metadata.name,
    metadata.description,
    source,
    ...(metadata.triggers ?? []),
  ]
    .join(" ")
    .toLowerCase();

  if (/paper|academic|thesis|论文|写作|composer|strategist/.test(haystack)) return "writing";
  if (/front|ui|ux|web|react|browser|figma|design|app-builder|前端|界面/.test(haystack)) return "frontend";
  if (/debug|test|verify|review|tdd|调试|测试|验证/.test(haystack)) return "debugging";
  if (/doc|pdf|sheet|slide|paper|document|文档|表格|演示/.test(haystack)) return "documents";
  if (/agent|automation|workflow|github|linear|drive|dispatch|自动化/.test(haystack)) return "automation";
  return "uncategorized";
}

function getDefaultCategory(id) {
  return defaultCategories.find((category) => category.id === id) ?? defaultCategories.at(-1);
}

function pickCategoryColor(index) {
  const colors = ["#8b5cf6", "#0ea5e9", "#10b981", "#f97316", "#ef4444", "#64748b"];
  return colors[index % colors.length];
}

async function assertSkillExists(skillDir, message) {
  if (!(await pathExists(path.join(skillDir, "SKILL.md")))) {
    throw httpError(404, message);
  }
}

function assertInside(root, target, message) {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw httpError(400, message);
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

function cleanYamlValue(value) {
  return value.trim().replace(/^["']|["']$/g, "");
}

function formatUpdatedAt(date) {
  return new Intl.DateTimeFormat("zh-CN", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
  }).format(date);
}

async function downloadGithubArchive(parsed, zipPath) {
  const archiveUrl = `https://codeload.github.com/${parsed.owner}/${parsed.repo}/zip/refs/heads/${encodeURIComponent(
    parsed.branch,
  )}`;
  await downloadFile(archiveUrl, zipPath);
}

async function downloadFile(url, outputPath, redirectCount = 0) {
  if (redirectCount > 4) throw httpError(502, "Too many redirects while downloading skill archive.");

  await new Promise((resolve, reject) => {
    const request = get(url, (response) => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location) {
        response.resume();
        downloadFile(new URL(response.headers.location, url).toString(), outputPath, redirectCount + 1)
          .then(resolve)
          .catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        response.resume();
        reject(httpError(response.statusCode ?? 502, `GitHub download failed with ${response.statusCode}.`));
        return;
      }

      const file = createWriteStream(outputPath);
      response.pipe(file);
      file.on("finish", () => file.close(resolve));
      file.on("error", reject);
    });

    request.on("error", reject);
  });
}

async function extractZip(zipPath, destination) {
  if (process.platform === "win32") {
    await execFileAsync("powershell.exe", [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      "Expand-Archive -LiteralPath $args[0] -DestinationPath $args[1] -Force",
      zipPath,
      destination,
    ]);
    return;
  }

  await execFileAsync("unzip", ["-q", zipPath, "-d", destination]);
}

async function findExtractedRepoRoot(extractRoot) {
  const entries = await readdir(extractRoot, { withFileTypes: true });
  const directory = entries.find((entry) => entry.isDirectory());
  if (!directory) throw httpError(502, "Downloaded archive did not contain a repository folder.");
  return path.join(extractRoot, directory.name);
}

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

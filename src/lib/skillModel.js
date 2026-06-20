const normalize = (value) => value.toLowerCase().trim();

export function applySkillFilter(skills, filters) {
  const query = normalize(filters.query ?? "");
  const status = filters.status ?? "all";

  return skills.filter((skill) => {
    const haystack = [
      skill.name,
      skill.description,
      skill.source,
      skill.status,
      ...(skill.triggers ?? []),
    ]
      .join(" ")
      .toLowerCase();

    const matchesQuery = !query || haystack.includes(query);
    const matchesStatus =
      status === "all" ||
      (status === "installed" && skill.installed) ||
      (status === "enabled" && skill.enabled) ||
      (status === "inactive" && !skill.enabled) ||
      (status === "updates" && skill.status === "update") ||
      (status === "available" && !skill.installed);

    return matchesQuery && matchesStatus;
  });
}

export function toggleSkill(skills, skillId) {
  return skills.map((skill) =>
    skill.id === skillId
      ? {
          ...skill,
          enabled: !skill.enabled,
          installed: skill.installed || !skill.enabled,
          status: skill.status === "available" ? "healthy" : skill.status,
        }
      : skill,
  );
}

export function installSkill(skills, githubUrl) {
  const skillName = parseSkillName(githubUrl);
  const existing = skills.find((skill) => skill.id === skillName);
  const now = new Date().toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const installedSkill = existing
    ? {
        ...existing,
        installed: true,
        enabled: true,
        source: existing.source === "available" ? "github" : existing.source,
        status: "healthy",
        updatedAt: "刚刚",
        version: existing.version === "remote" ? "1.0.0" : existing.version,
      }
    : {
        id: skillName,
        name: skillName,
        description: "从 GitHub URL 安装的自定义 skill。",
        installed: true,
        enabled: true,
        source: "github",
        status: "healthy",
        version: "1.0.0",
        updatedAt: "刚刚",
        path: githubUrl,
        triggers: ["custom", "github"],
      };

  const nextSkills = existing
    ? skills.map((skill) => (skill.id === skillName ? installedSkill : skill))
    : [installedSkill, ...skills];

  return {
    skills: nextSkills,
    selectedId: installedSkill.id,
    activity: [
      {
        id: `act-${Date.now()}`,
        title: `安装完成：${installedSkill.name}`,
        detail: `来源 ${githubUrl}`,
        tone: "good",
        time: now,
      },
    ],
  };
}

export function markUpdated(skills, skillId) {
  return skills.map((skill) =>
    skill.id === skillId
      ? {
          ...skill,
          status: "healthy",
          version: bumpPatch(skill.version),
          updatedAt: "刚刚",
        }
      : skill,
  );
}

export function removeSkill(skills, skillId) {
  return skills.map((skill) =>
    skill.id === skillId
      ? {
          ...skill,
          installed: false,
          enabled: false,
          status: "available",
          updatedAt: "已移除",
        }
      : skill,
  );
}

export function deleteSkillFromVault(skills, skillId) {
  return skills.filter((skill) => skill.id !== skillId);
}

export function buildManifest(skills) {
  return {
    exportedAt: new Date().toISOString(),
    skills: skills
      .filter((skill) => skill.installed)
      .map(({ id, name, source, version, enabled, path }) => ({
        id,
        name,
        source,
        version,
        enabled,
        path,
      })),
  };
}

function parseSkillName(githubUrl) {
  const cleanUrl = githubUrl.trim().replace(/\/$/, "");
  if (!cleanUrl) return "custom-skill";
  const parts = cleanUrl.split("/");
  return slugify(parts[parts.length - 1] || "custom-skill");
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "custom-skill";
}

function bumpPatch(version) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) return "1.0.0";
  const [major, minor, patch] = version.split(".").map(Number);
  return `${major}.${minor}.${patch + 1}`;
}

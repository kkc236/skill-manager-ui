export function buildSkillAudits(skills) {
  const triggerOwners = new Map();
  for (const skill of skills) {
    for (const trigger of skill.triggers ?? []) {
      const key = String(trigger).trim().toLowerCase();
      if (!key) continue;
      triggerOwners.set(key, [...(triggerOwners.get(key) ?? []), skill.id]);
    }
  }

  return Object.fromEntries(
    skills.map((skill) => {
      const conflictTriggers = (skill.triggers ?? []).filter((trigger) => {
        const owners = triggerOwners.get(String(trigger).trim().toLowerCase()) ?? [];
        return owners.length > 1;
      });
      const items = [
        {
          key: "description",
          label: (skill.description ?? "").trim().length >= 12 ? "描述完整" : "描述偏短",
          tone: (skill.description ?? "").trim().length >= 12 ? "ok" : "warn",
        },
        {
          key: "triggers",
          label: (skill.triggers ?? []).length ? "触发词已设置" : "缺少触发词",
          tone: (skill.triggers ?? []).length ? "ok" : "warn",
        },
        {
          key: "conflicts",
          label: conflictTriggers.length ? "触发词有冲突" : "触发词无冲突",
          tone: conflictTriggers.length ? "warn" : "ok",
        },
        {
          key: "sync",
          label: skill.status === "update" ? "需要同步" : "同步正常",
          tone: skill.status === "update" ? "warn" : "ok",
        },
      ];
      const issueCount = items.filter((item) => item.tone === "warn").length;

      return [
        skill.id,
        {
          issueCount,
          items,
          score: Math.max(0, 100 - issueCount * 18),
        },
      ];
    }),
  );
}

export function buildSidebarHealthSummary(skillAudits, skills) {
  const audits = Object.values(skillAudits);
  const countWarn = (key) =>
    audits.filter((audit) => audit.items.some((item) => item.key === key && item.tone === "warn")).length;

  return {
    issueCount: audits.reduce((total, audit) => total + audit.issueCount, 0),
    missingTriggerCount: countWarn("triggers"),
    conflictCount: countWarn("conflicts"),
    updateCount: skills.filter((skill) => skill.status === "update").length,
    syncedCount: skills.filter((skill) => skill.enabled).length,
  };
}

export function buildSkillMarkdown(skill) {
  if (!skill) return "";
  const triggers = (skill.triggers ?? []).map((trigger) => `"${escapeYamlValue(trigger)}"`).join(", ");

  return [
    "---",
    `name: ${escapeYamlValue(skill.name)}`,
    `description: ${escapeYamlValue(skill.description)}`,
    `triggers: [${triggers}]`,
    `version: ${escapeYamlValue(skill.version ?? "local")}`,
    "---",
    "",
    `# ${skill.name}`,
    "",
    skill.description,
    "",
  ].join("\n");
}

function escapeYamlValue(value) {
  return String(value ?? "").replaceAll("\"", "\\\"");
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function removeSelectedIds(current, ids) {
  const remove = new Set(ids);
  const next = new Set([...current].filter((id) => !remove.has(id)));
  return next.size === current.size ? current : next;
}

export function statusLabel(status) {
  const labels = {
    healthy: "正常",
    update: "需更新",
    available: "可安装",
  };
  return labels[status] ?? "未知";
}

export function apiStatusLabel(status) {
  const labels = {
    connecting: "连接中",
    live: "本地 API 在线",
    offline: "离线演示",
  };
  return labels[status] ?? "未知";
}

export function compactPath(value) {
  return String(value ?? "")
    .replaceAll("\\", "/")
    .replace(/^C:\/Users\/[^/]+/i, "~");
}

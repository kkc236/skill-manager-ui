const PRESET_STORAGE_KEY = "skill-deck-task-presets-v1";
export const BASE_PRESET_ID = "general-base";

export const defaultTaskPresets = [
  {
    id: BASE_PRESET_ID,
    name: "通用场景",
    description: "默认随专项场景叠加的基本盘，可按自己的 Codex 工作习惯调整。",
    mode: "merge",
    color: "#77f2bf",
    skillIds: ["test-driven-development", "verification-before-completion", "using-superpowers"],
  },
  {
    id: "paper-writing",
    name: "论文写作",
    description: "定稿、文档处理、PDF 校验和降重前置检查。",
    mode: "merge",
    color: "#8b5cf6",
    skillIds: ["academic-paper-strategist", "academic-paper-composer", "documents", "pdf", "verification-before-completion"],
  },
  {
    id: "frontend-shipping",
    name: "前端开发",
    description: "界面搭建、React 规范、浏览器验证和交互调试。",
    mode: "merge",
    color: "#0ea5e9",
    skillIds: ["frontend-app-builder", "react-best-practices", "frontend-testing-debugging", "browser", "playwright"],
  },
  {
    id: "debug-test",
    name: "调试测试",
    description: "复现、TDD、系统调试和完成前验证。",
    mode: "merge",
    color: "#f97316",
    skillIds: ["systematic-debugging", "test-driven-development", "verification-before-completion", "requesting-code-review"],
  },
  {
    id: "automation",
    name: "自动化",
    description: "Agent 编排、GitHub、批量任务和技能安装。",
    mode: "merge",
    color: "#10b981",
    skillIds: ["dispatching-parallel-agents", "subagent-driven-development", "skill-installer", "github", "linear"],
  },
  {
    id: "nihongo",
    name: "日语学习",
    description: "日语材料解析、语法练习和翻译辅助。",
    mode: "merge",
    color: "#14b8a6",
    skillIds: ["japanese-tutor", "nihongo", "openai-docs"],
  },
];

export function seedTaskPresets() {
  const storedPresets = readStoredTaskPresets();
  return ensureBasePreset(storedPresets.length ? storedPresets : defaultTaskPresets);
}

function readStoredTaskPresets() {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage?.getItem(PRESET_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeTaskPreset).filter((preset) => preset.id && preset.name);
  } catch {
    return [];
  }
}

export function persistTaskPresets(presets) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage?.setItem(
      PRESET_STORAGE_KEY,
      JSON.stringify(presets.map(normalizeTaskPreset)),
    );
  } catch {
    // Local storage is best-effort
  }
}

export function normalizeTaskPreset(preset) {
  return {
    color: typeof preset?.color === "string" && preset.color ? preset.color : "#111111",
    description: typeof preset?.description === "string" ? preset.description : "",
    id: typeof preset?.id === "string" && preset.id ? preset.id : `preset-${Date.now()}`,
    mode: preset?.mode === "focus" ? "focus" : "merge",
    name: typeof preset?.name === "string" && preset.name.trim() ? preset.name.trim() : "未命名预设",
    skillIds: normalizeSkillIds(preset?.skillIds),
  };
}

export function normalizeSkillIds(skillIds) {
  return [...new Set((Array.isArray(skillIds) ? skillIds : []).filter(Boolean).map(String))];
}

function ensureBasePreset(presets) {
  const normalizedPresets = (Array.isArray(presets) ? presets : []).map(normalizeTaskPreset);
  const basePreset = normalizeTaskPreset(defaultTaskPresets.find((preset) => preset.id === BASE_PRESET_ID));
  const hasBasePreset = normalizedPresets.some((preset) => preset.id === BASE_PRESET_ID);
  const withBase = hasBasePreset ? normalizedPresets : [basePreset, ...normalizedPresets];

  return [
    ...withBase.filter((preset) => preset.id === BASE_PRESET_ID),
    ...withBase.filter((preset) => preset.id !== BASE_PRESET_ID),
  ];
}

export function resolveInheritedPresetSkillIds(preset, presets) {
  const basePreset = presets.find((item) => item.id === BASE_PRESET_ID);
  if (!preset || !basePreset || preset.id === BASE_PRESET_ID || preset.mode !== "merge") return [];
  return normalizeSkillIds(basePreset.skillIds);
}

export function resolvePresetSkillIds(preset, presets) {
  if (!preset) return [];
  return normalizeSkillIds([...resolveInheritedPresetSkillIds(preset, presets), ...normalizeSkillIds(preset.skillIds)]);
}

export function buildPresetSummaries(presets, skills) {
  const skillMap = new Map(skills.map((skill) => [skill.id, skill]));

  return presets.map((preset) => {
    const storedIds = resolvePresetSkillIds(preset, presets);
    const skillIds = storedIds.filter((skillId) => skillMap.has(skillId));
    return {
      ...preset,
      activeCount: skillIds.filter((skillId) => skillMap.get(skillId)?.enabled).length,
      missingCount: storedIds.length - skillIds.length,
      skillIds,
    };
  });
}

export function filterPresetSkillOptions(skills, query) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return skills;

  return skills.filter((skill) => {
    const haystack = [
      skill.id,
      skill.name,
      skill.description,
      skill.source,
      skill.categoryId,
      skill.categoryName,
      skill.path,
      ...(skill.triggers ?? []),
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(normalizedQuery);
  });
}

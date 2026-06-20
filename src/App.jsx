import {
  Activity,
  Archive,
  ArrowRight,
  Bolt,
  CheckCircle2,
  ChevronRight,
  Download,
  FileJson,
  GitBranch,
  Layers3,
  PackageCheck,
  Power,
  RefreshCw,
  Search,
  Settings2,
  Sparkle,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  activateVaultSkill,
  assignVaultSkillCategory,
  createVaultCategory,
  deactivateVaultSkill,
  deleteVaultSkill,
  fetchInventory,
  fetchManifest,
  fetchVaultSkillFile,
  installVaultSkill,
  saveVaultSkillFile,
  updateVaultSkill,
} from "./lib/apiClient";
import {
  applySkillFilter,
  buildManifest,
  deleteSkillFromVault,
  installSkill,
  markUpdated,
  removeSkill,
  toggleSkill,
} from "./lib/skillModel";
import { initialActivity, seedSkills } from "./lib/seedSkills";
import { fallbackCategories, applyFrontendCategories, buildFolderCategories, slugifyCategory, categoryColor } from "./utils/categories";
import { BASE_PRESET_ID, defaultTaskPresets, seedTaskPresets, persistTaskPresets, normalizeTaskPreset, normalizeSkillIds, resolveInheritedPresetSkillIds, resolvePresetSkillIds, buildPresetSummaries, filterPresetSkillOptions } from "./utils/presets";
import { buildSkillAudits, buildSidebarHealthSummary, buildSkillMarkdown, clamp, removeSelectedIds, statusLabel, apiStatusLabel, compactPath } from "./utils/helpers";
import GuidePage, { guideSteps } from "./components/GuidePage";
import { useToast } from "./hooks/useToast";

const filterTabs = [
  { id: "all", label: "全部" },
  { id: "enabled", label: "已激活" },
  { id: "inactive", label: "未激活" },
  { id: "updates", label: "需同步" },
];

const navItems = [  { id: "cover", label: "封面", icon: Sparkle },
  { id: "library", label: "技能库", icon: Layers3 },
  { id: "presets", label: "预设", icon: Bolt },
  { id: "install", label: "安装源", icon: GitBranch },
  { id: "manifest", label: "清单", icon: FileJson },
  { id: "settings", label: "设置", icon: Settings2 },
];

const viewTitles = {
  install: "安装源",
  library: "技能库",
  presets: "场景预设",
  manifest: "Skill 清单",
  settings: "控制台设置",
};

const materialLibraries = [
  {
    name: "Pexels",
    note: "免费、可修改、无需署名，适合背景视频备选。",
    url: "https://www.pexels.com/search/videos/abstract%20technology%20background/",
  },
  {
    name: "Pixabay",
    note: "抽象科技视频量大，适合找 4K/HD 动态背景。",
    url: "https://pixabay.com/videos/search/abstract%20technology/",
  },
  {
    name: "Coverr",
    note: "商用友好，但免费素材现在通常需要按站点要求署名。",
    url: "https://coverr.co/search?q=technology%20abstract",
  },
  {
    name: "Mixkit",
    note: "动效类素材好找，但要逐个核对 Free/Restricted License。",
    url: "https://mixkit.co/free-stock-video/technology/",
  },
];

const sourceLibraryItems = [
  {
    id: "frontend-pack",
    name: "Frontend launch pack",
    note: "前端开发、React 规范、浏览器 QA 与视觉调试。",
    url: "https://github.com/openai/openai-cookbook",
    badge: "推荐",
  },
  {
    id: "paper-pack",
    name: "Academic writing pack",
    note: "论文规划、定稿、文档处理、PDF 校验组合。",
    url: "https://github.com/openai/openai-cookbook",
    badge: "场景包",
  },
  {
    id: "debug-pack",
    name: "Debugging toolkit",
    note: "系统调试、TDD、验证、代码审查工作流。",
    url: "https://github.com/openai/openai-cookbook",
    badge: "可更新",
  },
];

const guideCompleteStorageKey = "skill-deck-guide-complete";

function hasCompletedGuide() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(guideCompleteStorageKey) === "true";
  } catch {
    return false;
  }
}

function rememberGuideComplete() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(guideCompleteStorageKey, "true");
  } catch {
    // The app still works when storage is unavailable; it just shows the guide again.
  }
}

export default function App() {
  const [skills, setSkills] = useState(seedSkills);
  const [activity, setActivity] = useState(initialActivity);
  const [categories, setCategories] = useState(fallbackCategories);
  const [apiStatus, setApiStatus] = useState("connecting");
  const [apiMeta, setApiMeta] = useState({
    codexHome: "~/.codex",
    vaultRoot: "skill-vault",
  });
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [selectedCategoryId, setSelectedCategoryId] = useState("all");
  const [selectedId, setSelectedId] = useState(seedSkills[0].id);
  const [activeView, setActiveView] = useState("library");
  const [installOpen, setInstallOpen] = useState(false);
  const [installPending, setInstallPending] = useState(false);
  const [pendingSkillId, setPendingSkillId] = useState("");
  const [batchMode, setBatchMode] = useState(false);
  const [batchSelectedIds, setBatchSelectedIds] = useState(() => new Set());
  const [batchPendingIds, setBatchPendingIds] = useState(() => new Set());
  const [taskPresets, setTaskPresets] = useState(() => seedTaskPresets());
  const [selectedPresetId, setSelectedPresetId] = useState(BASE_PRESET_ID);
  const [activePresetId, setActivePresetId] = useState("");
  const [presetQuery, setPresetQuery] = useState("");
  const [skillDrafts, setSkillDrafts] = useState(() => ({}));
  const [draftPending, setDraftPending] = useState(false);
  const [readerFocus, setReaderFocus] = useState("description");
  const [readerHeight, setReaderHeight] = useState(280);
  const [workbenchStage, setWorkbenchStage] = useState("manager");
  const [workbenchSplit, setWorkbenchSplit] = useState(80);
  const [guideOpen, setGuideOpen] = useState(() => !hasCompletedGuide());
  const [guideStepId, setGuideStepId] = useState(guideSteps[0].id);
  const [githubUrl, setGithubUrl] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const { toast, showToast: setToast, clearToast } = useToast();
  const fileInputRef = useRef(null);
  const readerResizeRef = useRef(null);
  const workbenchRef = useRef(null);
  const workbenchResizeRef = useRef(null);
  const apiLive = apiStatus === "live";

  const applyInventory = useCallback((inventory) => {
    const nextSkills = inventory.skills ?? [];
    setSkills(nextSkills);
    setCategories(inventory.categories?.length ? inventory.categories : fallbackCategories);
    setActivity(inventory.activity?.length ? inventory.activity : []);
    setApiMeta({
      codexHome: inventory.codexHome ?? "~/.codex",
      vaultRoot: inventory.vaultRoot ?? "skill-vault",
    });
    setSelectedId((current) =>
      nextSkills.some((skill) => skill.id === current) ? current : nextSkills[0]?.id ?? "",
    );
  }, []);

  const loadInventory = useCallback(
    async ({ silent = false } = {}) => {
      if (typeof fetch !== "function") {
        setApiStatus("offline");
        return null;
      }

      try {
        if (!silent) setApiStatus("connecting");
        const inventory = await fetchInventory();
        applyInventory(inventory);
        setApiStatus("live");
        return inventory;
      } catch (error) {
        setApiStatus("offline");
        if (!silent) setToast(`本地 API 未连接：${error.message}`);
        return null;
      }
    },
    [applyInventory],
  );

  useEffect(() => {
    loadInventory({ silent: true });
  }, [loadInventory]);

  useEffect(() => {
    persistTaskPresets(taskPresets);
  }, [taskPresets]);

  useEffect(() => {
    if (!taskPresets.length) return;
    if (!taskPresets.some((preset) => preset.id === selectedPresetId)) {
      setSelectedPresetId(taskPresets[0].id);
    }
  }, [selectedPresetId, taskPresets]);

  const skillsWithCategories = useMemo(
    () => applyFrontendCategories(skills, categories),
    [categories, skills],
  );

  const folderCategories = useMemo(
    () => buildFolderCategories(categories, skillsWithCategories),
    [categories, skillsWithCategories],
  );

  const filteredSkills = useMemo(
    () =>
      applySkillFilter(skillsWithCategories, { query, status: activeFilter }).filter((skill) =>
        selectedCategoryId === "all" ? true : skill.categoryId === selectedCategoryId,
      ),
    [activeFilter, query, selectedCategoryId, skillsWithCategories],
  );

  const selectedSkill =
    skillsWithCategories.find((skill) => skill.id === selectedId) ??
    filteredSkills[0] ??
    skillsWithCategories[0];

  const guideStep = guideSteps.find((step) => step.id === guideStepId) ?? guideSteps[0];
  const guideStepIndex = guideSteps.findIndex((step) => step.id === guideStep.id);

  const stats = useMemo(
    () => [
      {
        label: "仓库内",
        value: skillsWithCategories.length,
        icon: PackageCheck,
      },
      {
        label: "已激活",
        value: skillsWithCategories.filter((skill) => skill.enabled).length,
        icon: Power,
      },
      {
        label: "需同步",
        value: skillsWithCategories.filter((skill) => skill.status === "update").length,
        icon: RefreshCw,
      },
    ],
    [skillsWithCategories],
  );

  const enabledCount = skillsWithCategories.filter((skill) => skill.enabled).length;
  const inactiveCount = skillsWithCategories.length - enabledCount;
  const coveragePercent = skillsWithCategories.length
    ? Math.round((enabledCount / skillsWithCategories.length) * 100)
    : 0;
  const activeSkills = filteredSkills.filter((skill) => skill.enabled);
  const inactiveSkills = filteredSkills.filter((skill) => !skill.enabled);
  const batchSelectedSkills = useMemo(
    () => skillsWithCategories.filter((skill) => batchSelectedIds.has(skill.id)),
    [batchSelectedIds, skillsWithCategories],
  );
  const batchSelectedActiveIds = batchSelectedSkills.filter((skill) => skill.enabled).map((skill) => skill.id);
  const batchSelectedInactiveIds = batchSelectedSkills.filter((skill) => !skill.enabled).map((skill) => skill.id);
  const visibleSkillIds = useMemo(() => filteredSkills.map((skill) => skill.id), [filteredSkills]);
  const currentFolder =
    folderCategories.find((category) => category.id === selectedCategoryId) ?? folderCategories[0];
  const skillAudits = useMemo(() => buildSkillAudits(skillsWithCategories), [skillsWithCategories]);
  const selectedAudit = selectedSkill ? skillAudits[selectedSkill.id] : null;
  const auditIssueCount = Object.values(skillAudits).reduce(
    (total, audit) => total + audit.issueCount,
    0,
  );
  const sidebarHealth = useMemo(
    () => buildSidebarHealthSummary(skillAudits, skillsWithCategories),
    [skillAudits, skillsWithCategories],
  );
  const presetSummaries = useMemo(
    () => buildPresetSummaries(taskPresets, skillsWithCategories),
    [skillsWithCategories, taskPresets],
  );
  const selectedPreset =
    taskPresets.find((preset) => preset.id === selectedPresetId) ?? taskPresets[0] ?? null;
  const basePreset = taskPresets.find((preset) => preset.id === BASE_PRESET_ID) ?? null;
  const activePresetSummary = presetSummaries.find((preset) => preset.id === activePresetId);
  const selectedPresetSummary = selectedPreset
    ? presetSummaries.find((preset) => preset.id === selectedPreset.id)
    : null;
  const selectedPresetSkillSet = useMemo(
    () => new Set(selectedPreset?.skillIds ?? []),
    [selectedPreset],
  );
  const inheritedPresetSkillSet = useMemo(
    () => new Set(resolveInheritedPresetSkillIds(selectedPreset, taskPresets)),
    [selectedPreset, taskPresets],
  );
  const selectedPresetDirectSkills = useMemo(
    () => skillsWithCategories.filter((skill) => selectedPresetSkillSet.has(skill.id)),
    [selectedPresetSkillSet, skillsWithCategories],
  );
  const selectedPresetInheritedSkills = useMemo(
    () =>
      skillsWithCategories.filter(
        (skill) => inheritedPresetSkillSet.has(skill.id) && !selectedPresetSkillSet.has(skill.id),
      ),
    [inheritedPresetSkillSet, selectedPresetSkillSet, skillsWithCategories],
  );
  const selectedSkillDraft = selectedSkill
    ? skillDrafts[selectedSkill.id] ?? buildSkillMarkdown(selectedSkill)
    : "";
  const detailRowHeight = Math.max(430, readerHeight + 152);
  const managerStageSize = Math.round(workbenchSplit);
  const inspectorStageSize = 100 - managerStageSize;

  useEffect(() => {
    const visibleIds = new Set(visibleSkillIds);
    setBatchSelectedIds((current) => {
      const next = new Set([...current].filter((id) => visibleIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [visibleSkillIds]);

  useEffect(() => {
    if (!apiLive || !selectedSkill?.id) return undefined;

    let cancelled = false;
    fetchVaultSkillFile(selectedSkill.id)
      .then((file) => {
        if (cancelled) return;
        setSkillDrafts((current) => ({
          ...current,
          [selectedSkill.id]: file.content,
        }));
      })
      .catch(() => {
        if (!cancelled) {
          setSkillDrafts((current) => ({
            ...current,
            [selectedSkill.id]: current[selectedSkill.id] ?? buildSkillMarkdown(selectedSkill),
          }));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [apiLive, selectedSkill?.id]);

  useEffect(() => {
    function handleReaderResizeMove(event) {
      if (!readerResizeRef.current) return;
      const nextHeight = clamp(
        readerResizeRef.current.startHeight + event.clientY - readerResizeRef.current.startY,
        220,
        520,
      );
      setReaderHeight(Math.round(nextHeight));
    }

    function handleReaderResizeEnd() {
      readerResizeRef.current = null;
      document.body?.removeAttribute("data-reader-resizing");
    }

    window.addEventListener("pointermove", handleReaderResizeMove);
    window.addEventListener("pointerup", handleReaderResizeEnd);

    return () => {
      window.removeEventListener("pointermove", handleReaderResizeMove);
      window.removeEventListener("pointerup", handleReaderResizeEnd);
      document.body?.removeAttribute("data-reader-resizing");
    };
  }, []);

  useEffect(() => {
    function handleWorkbenchResizeMove(event) {
      if (!workbenchResizeRef.current) return;
      const { rect } = workbenchResizeRef.current;
      const nextSplit = clamp(((event.clientY - rect.top) / rect.height) * 100, 20, 80);
      const roundedSplit = Math.round(nextSplit);
      setWorkbenchSplit(roundedSplit);
      setWorkbenchStage(roundedSplit >= 50 ? "manager" : "inspector");
    }

    function handleWorkbenchResizeEnd() {
      workbenchResizeRef.current = null;
      document.body?.removeAttribute("data-workbench-resizing");
    }

    window.addEventListener("pointermove", handleWorkbenchResizeMove);
    window.addEventListener("pointerup", handleWorkbenchResizeEnd);

    return () => {
      window.removeEventListener("pointermove", handleWorkbenchResizeMove);
      window.removeEventListener("pointerup", handleWorkbenchResizeEnd);
      document.body?.removeAttribute("data-workbench-resizing");
    };
  }, []);

  function pushActivity(item) {
    setActivity((current) => [
      {
        id: `act-${Date.now()}`,
        time: "刚刚",
        ...item,
      },
      ...current,
    ]);
  }

  async function handleToggle(skillId) {
    if (!skillId) return;
    const target = skills.find((skill) => skill.id === skillId);

    if (apiLive) {
      setPendingSkillId(skillId);
      try {
        const inventory = target?.enabled
          ? await deactivateVaultSkill(skillId)
          : await activateVaultSkill(skillId);
        applyInventory(inventory);
        setToast(target?.enabled ? "已从 Codex 关闭" : "已激活到 Codex");
        setBatchSelectedIds((current) => removeSelectedIds(current, [skillId]));
      } catch (error) {
        setToast(`操作失败：${error.message}`);
      } finally {
        setPendingSkillId("");
      }
      return;
    }

    setSkills((current) => toggleSkill(current, skillId));
    setBatchSelectedIds((current) => removeSelectedIds(current, [skillId]));
    pushActivity({
      title: target?.enabled ? "已停用" : "已启用",
      detail: target?.name ?? skillId,
      tone: target?.enabled ? "neutral" : "good",
    });
  }

  async function handleBatchToggle(skillIds, nextEnabled) {
    const uniqueIds = [...new Set(skillIds)].filter(Boolean);
    if (!uniqueIds.length) return;
    const idSet = new Set(uniqueIds);

    setBatchPendingIds(idSet);

    if (apiLive) {
      try {
        const results = await Promise.all(
          uniqueIds.map((skillId) =>
            nextEnabled ? activateVaultSkill(skillId) : deactivateVaultSkill(skillId),
          ),
        );
        const inventory = results[results.length - 1];
        if (inventory) applyInventory(inventory);
        setToast(`${nextEnabled ? "已批量激活" : "已批量关闭"} ${uniqueIds.length} 个 skill`);
        setBatchSelectedIds((current) => removeSelectedIds(current, uniqueIds));
      } catch (error) {
        setToast(`批量操作失败：${error.message}`);
      } finally {
        setBatchPendingIds(new Set());
      }
      return;
    }

    setSkills((current) =>
      current.map((skill) =>
        idSet.has(skill.id)
          ? {
              ...skill,
              enabled: nextEnabled,
              installed: skill.installed || nextEnabled,
              status: skill.status === "available" && nextEnabled ? "healthy" : skill.status,
            }
          : skill,
      ),
    );
    setBatchSelectedIds((current) => removeSelectedIds(current, uniqueIds));
    setBatchPendingIds(new Set());
    setToast(`${nextEnabled ? "已批量激活" : "已批量关闭"} ${uniqueIds.length} 个 skill`);
    pushActivity({
      title: nextEnabled ? "批量启动" : "批量关闭",
      detail: `${uniqueIds.length} 个 skill`,
      tone: nextEnabled ? "good" : "neutral",
    });
  }

  function handleCreatePreset() {
    const preset = normalizeTaskPreset({
      id: `preset-${Date.now()}`,
      name: "新任务预设",
      description: "选择任意分类下的 skills，组成一次任务需要的工具组。",
      mode: "merge",
      color: "#111111",
      skillIds: [],
    });
    setTaskPresets((current) => [...current, preset]);
    setSelectedPresetId(preset.id);
    setPresetQuery("");
    setToast("已创建新预设");
  }

  function handlePresetFieldChange(updates) {
    if (!selectedPreset) return;
    setTaskPresets((current) =>
      current.map((preset) => {
        if (preset.id !== selectedPreset.id) return preset;
        const nextPreset = { ...preset, ...updates };
        return {
          ...nextPreset,
          mode: nextPreset.mode === "focus" ? "focus" : "merge",
          skillIds: normalizeSkillIds(nextPreset.skillIds),
        };
      }),
    );
  }

  function handleTogglePresetSkill(skillId) {
    if (!selectedPreset || !skillId) return;
    setTaskPresets((current) =>
      current.map((preset) => {
        if (preset.id !== selectedPreset.id) return preset;
        const nextSkillIds = preset.skillIds.includes(skillId)
          ? preset.skillIds.filter((id) => id !== skillId)
          : [...preset.skillIds, skillId];
        return { ...preset, skillIds: normalizeSkillIds(nextSkillIds) };
      }),
    );
  }

  function handleDuplicatePreset() {
    if (!selectedPreset) return;
    const copy = normalizeTaskPreset({
      ...selectedPreset,
      id: `preset-${Date.now()}`,
      name: `${selectedPreset.name} 副本`,
    });
    setTaskPresets((current) => [...current, copy]);
    setSelectedPresetId(copy.id);
    setToast("预设已复制");
  }

  function handleDeletePreset() {
    if (selectedPreset?.id === BASE_PRESET_ID) {
      setToast("通用场景作为基本盘保留，可直接编辑内容");
      return;
    }
    if (!selectedPreset || taskPresets.length <= 1) {
      setToast("至少保留一个预设");
      return;
    }
    setTaskPresets((current) => current.filter((preset) => preset.id !== selectedPreset.id));
    if (activePresetId === selectedPreset.id) setActivePresetId("");
    setToast("预设已删除");
  }

  function handleSavePreset() {
    if (!selectedPreset) return;
    persistTaskPresets(taskPresets);
    setToast("预设已保存");
  }

  async function handleApplyPreset(presetId = selectedPreset?.id) {
    const preset = taskPresets.find((item) => item.id === presetId);
    if (!preset) return;

    const availableIds = new Set(skillsWithCategories.map((skill) => skill.id));
    const skillIds = resolvePresetSkillIds(preset, taskPresets).filter((skillId) => availableIds.has(skillId));
    if (!skillIds.length) {
      setToast(`${preset.name} 还没有可应用的 skill`);
      return;
    }

    const skillSet = new Set(skillIds);
    const inactiveIds = skillIds.filter((skillId) => {
      const skill = skillsWithCategories.find((item) => item.id === skillId);
      return skill && !skill.enabled;
    });
    const closeIds =
      preset.mode === "focus"
        ? skillsWithCategories.filter((skill) => skill.enabled && !skillSet.has(skill.id)).map((skill) => skill.id)
        : [];

    setSelectedId(skillIds[0]);
    setActivePresetId(preset.id);
    setSelectedPresetId(preset.id);
    setActiveFilter("all");
    setSelectedCategoryId("all");
    setQuery("");
    setBatchMode(false);
    setBatchSelectedIds(new Set());

    if (apiLive) {
      setBatchPendingIds(new Set([...inactiveIds, ...closeIds]));
      try {
        const results = await Promise.all([
          ...inactiveIds.map((skillId) => activateVaultSkill(skillId)),
          ...closeIds.map((skillId) => deactivateVaultSkill(skillId)),
        ]);
        const inventory = results[results.length - 1];
        if (inventory) applyInventory(inventory);
        setToast(`已应用 ${preset.name}`);
      } catch (error) {
        setToast(`预设应用失败：${error.message}`);
      } finally {
        setBatchPendingIds(new Set());
      }
      return;
    }

    setSkills((current) =>
      current.map((skill) => {
        if (skillSet.has(skill.id)) {
          return {
            ...skill,
            enabled: true,
            installed: true,
            status: skill.status === "available" || skill.status === "update" ? "healthy" : skill.status,
          };
        }

        if (preset.mode === "focus" && skill.enabled) {
          return {
            ...skill,
            enabled: false,
          };
        }

        return skill;
      }),
    );
    setToast(`已应用 ${preset.name}`);
    pushActivity({
      title: "预设应用",
      detail: `${preset.name} · ${skillIds.length} 个 skill`,
      tone: "good",
    });
  }

  function handleDraftChange(value) {
    if (!selectedSkill?.id) return;
    setSkillDrafts((current) => ({
      ...current,
      [selectedSkill.id]: value,
    }));
  }

  async function handleSaveSkillDraft() {
    if (!selectedSkill?.id) return;

    if (apiLive) {
      setDraftPending(true);
      try {
        const inventory = await saveVaultSkillFile(selectedSkill.id, selectedSkillDraft);
        applyInventory(inventory);
        setToast("SKILL.md 已保存并同步");
      } catch (error) {
        setToast(`保存失败：${error.message}`);
      } finally {
        setDraftPending(false);
      }
      return;
    }

    setToast("草稿已保存");
    pushActivity({
      title: "保存草稿",
      detail: selectedSkill.name,
      tone: "good",
    });
  }

  function handleReaderResizeStart(event) {
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    readerResizeRef.current = {
      startHeight: readerHeight,
      startY: event.clientY,
    };
    document.body?.setAttribute("data-reader-resizing", "true");
  }

  function handleSkillSelection(skillId, checked) {
    setBatchSelectedIds((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(skillId);
      } else {
        next.delete(skillId);
      }
      return next;
    });
  }

  function handleSectionSelection(sectionSkills, checked) {
    const ids = sectionSkills.map((skill) => skill.id);
    setBatchSelectedIds((current) => {
      const next = new Set(current);
      for (const id of ids) {
        if (checked) {
          next.add(id);
        } else {
          next.delete(id);
        }
      }
      return next;
    });
  }

  function handleBatchModeToggle() {
    const nextMode = !batchMode;
    setBatchMode(nextMode);
    if (!nextMode) {
      setBatchSelectedIds(new Set());
    }
  }

  function promoteWorkbenchStage(stage) {
    setWorkbenchStage(stage);
    setWorkbenchSplit(stage === "manager" ? 80 : 20);
  }

  function handleStageClickCapture(stage, event) {
    if (workbenchStage === stage) return;
    event.preventDefault();
    event.stopPropagation();
    promoteWorkbenchStage(stage);
  }

  function handleWorkbenchResizeStart(event) {
    const rect = workbenchRef.current?.getBoundingClientRect();
    if (!rect?.height) return;
    workbenchResizeRef.current = { rect };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    document.body?.setAttribute("data-workbench-resizing", "true");
  }

  function handleEnterConsole() {
    rememberGuideComplete();
    setGuideOpen(false);
  }

  function handleNavSelect(viewId) {
    if (viewId === "cover") {
      setGuideStepId(guideSteps[0].id);
      setGuideOpen(true);
      return;
    }

    setActiveView(viewId);
  }

  function handleOpenQualityDock() {
    setActiveView("library");
    setActiveFilter("all");
    setBatchMode(false);
    setBatchSelectedIds(new Set());
    setReaderFocus("description");
    promoteWorkbenchStage("inspector");
  }

  function handleOpenSkillEditor() {
    setActiveView("library");
    setActiveFilter("all");
    setBatchMode(false);
    setBatchSelectedIds(new Set());
    setReaderFocus("skill");
    promoteWorkbenchStage("inspector");
  }

  function handleOpenSourceLibrary() {
    setActiveView("install");
    setInstallOpen(false);
  }

  function isSkillPending(skillId) {
    return pendingSkillId === skillId || batchPendingIds.has(skillId);
  }

  async function handleAssignCategory(skillId, categoryId) {
    if (!skillId || !categoryId) return;
    const category = categories.find((item) => item.id === categoryId);
    const keepMovedSkillVisible = () => {
      setSelectedId(skillId);
      setSelectedCategoryId((current) =>
        current !== "all" && current !== categoryId ? categoryId : current,
      );
    };

    if (apiLive) {
      setPendingSkillId(skillId);
      try {
        const inventory = await assignVaultSkillCategory(skillId, categoryId);
        applyInventory(inventory);
        keepMovedSkillVisible();
        setToast(`已归类到 ${category?.name ?? categoryId}`);
      } catch (error) {
        setToast(`归类失败：${error.message}`);
      } finally {
        setPendingSkillId("");
      }
      return;
    }

    keepMovedSkillVisible();
    setSkills((current) =>
      current.map((skill) =>
        skill.id === skillId
          ? {
              ...skill,
              categoryId,
              categoryName: category?.name ?? categoryId,
            }
          : skill,
      ),
    );
    setToast(`已归类到 ${category?.name ?? categoryId}`);
  }

  async function handleCreateCategory(event) {
    event.preventDefault();
    const name = newCategoryName.trim();
    if (!name) return;

    if (apiLive) {
      try {
        const inventory = await createVaultCategory(name);
        applyInventory(inventory);
        setNewCategoryName("");
        setToast("分类文件夹已创建");
      } catch (error) {
        setToast(`创建失败：${error.message}`);
      }
      return;
    }

    const category = {
      color: "#8b5cf6",
      id: slugifyCategory(name),
      name,
    };
    setCategories((current) =>
      current.some((item) => item.id === category.id) ? current : [...current, category],
    );
    setNewCategoryName("");
    setToast("分类文件夹已创建");
  }

  async function handleInstall(event) {
    event.preventDefault();

    if (apiLive) {
      setInstallPending(true);
      try {
        const inventory = await installVaultSkill(githubUrl, { activate: true });
        applyInventory(inventory);
        setQuery("");
        setActiveFilter("all");
        setToast("已下载并激活");
        setGithubUrl("");
        setInstallOpen(false);
      } catch (error) {
        setToast(`安装失败：${error.message}`);
      } finally {
        setInstallPending(false);
      }
      return;
    }

    const result = installSkill(skills, githubUrl);
    setSkills(result.skills);
    setSelectedId(result.selectedId);
    setActivity((current) => [...result.activity, ...current]);
    setQuery("");
    setActiveFilter("all");
    setToast("安装完成");
    setGithubUrl("");
    setInstallOpen(false);
  }

  async function handleUpdate(skillId) {
    if (!skillId) return;
    const target = skills.find((skill) => skill.id === skillId);

    if (apiLive) {
      setPendingSkillId(skillId);
      try {
        const inventory = await updateVaultSkill(skillId);
        applyInventory(inventory);
        setToast("同步完成");
      } catch (error) {
        setToast(`同步失败：${error.message}`);
      } finally {
        setPendingSkillId("");
      }
      return;
    }

    setSkills((current) => markUpdated(current, skillId));
    pushActivity({
      title: "更新完成",
      detail: target?.name ?? skillId,
      tone: "good",
    });
  }

  async function handleRemove(skillId) {
    if (!skillId) return;
    const target = skills.find((skill) => skill.id === skillId);

    if (apiLive) {
      setPendingSkillId(skillId);
      try {
        const inventory = await deleteVaultSkill(skillId);
        applyInventory(inventory);
        setToast("已从仓库删除");
      } catch (error) {
        setToast(`删除失败：${error.message}`);
      } finally {
        setPendingSkillId("");
      }
      return;
    }

    setSkills((current) => deleteSkillFromVault(current, skillId));
    pushActivity({
      title: "已从仓库删除",
      detail: target?.name ?? skillId,
      tone: "warn",
    });
  }

  async function handleExport() {
    let manifest = buildManifest(skills);
    if (apiLive) {
      try {
        manifest = await fetchManifest();
      } catch (error) {
        setToast(`导出失败：${error.message}`);
        return;
      }
    }

    const blob = new Blob([JSON.stringify(manifest, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "codex-skills-manifest.json";
    link.click();
    URL.revokeObjectURL(url);
    setToast("清单已导出");
    pushActivity({
      title: "导出清单",
      detail: "已生成 codex-skills-manifest.json",
      tone: "good",
    });
  }

  function handleImport(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      try {
        const manifest = JSON.parse(loadEvent.target.result);
        const importedSkills = Array.isArray(manifest?.skills) ? manifest.skills : [];
        if (!importedSkills.length) {
          setToast("清单中没有可导入的 skill");
          return;
        }

        if (apiLive) {
          setToast(`清单包含 ${importedSkills.length} 个 skill，请通过安装源逐个下载`);
          return;
        }

        const existingIds = new Set(skills.map((skill) => skill.id));
        const newSkills = importedSkills
          .filter((skill) => skill.id && !existingIds.has(skill.id))
          .map((skill) => ({
            id: skill.id,
            name: skill.name ?? skill.id,
            description: skill.description ?? "从清单导入的 skill。",
            installed: true,
            enabled: skill.enabled ?? false,
            source: skill.source ?? "import",
            status: "healthy",
            version: skill.version ?? "local",
            updatedAt: "刚刚",
            path: skill.path ?? "",
            triggers: skill.triggers ?? [skill.source ?? "import"],
          }));

        if (!newSkills.length) {
          setToast("清单中的 skill 已全部存在");
          return;
        }

        setSkills((current) => [...newSkills, ...current]);
        setSelectedId(newSkills[0].id);
        setToast(`已导入 ${newSkills.length} 个新 skill`);
        pushActivity({
          title: "导入清单",
          detail: `${file.name} · ${newSkills.length} 个新 skill`,
          tone: "good",
        });
      } catch {
        setToast("清单文件格式错误，请上传有效的 JSON 文件");
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  if (guideOpen) {
    return (
      <GuidePage
        activeStep={guideStep}
        activeStepIndex={guideStepIndex}
        steps={guideSteps}
        onSelectStep={setGuideStepId}
        onEnter={handleEnterConsole}
      />
    );
  }

  return (
    <main className="app-shell">
      <video
        className="console-bg-video"
        data-testid="console-background-video"
        src="/media/pexels-circuit-console.mp4"
        autoPlay
        muted
        loop
        playsInline
        aria-hidden="true"
      />
      <aside className="sidebar" aria-label="主导航">
        <video
          className="sidebar-video"
          data-testid="sidebar-background-video"
          src="/media/mixkit-data-network.mp4"
          autoPlay
          muted
          loop
          playsInline
          aria-hidden="true"
        />
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <Sparkle size={18} />
          </span>
          <div>
            <strong>Skill Deck</strong>
            <small>本地 Codex</small>
          </div>
        </div>

        <nav className="nav-list">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = item.id !== "cover" && activeView === item.id;
            return (
              <button
                aria-pressed={active}
                className={active ? "nav-item active" : "nav-item"}
                key={item.id}
                onClick={() => handleNavSelect(item.id)}
                type="button"
              >
                <Icon size={17} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <section className="sidebar-preset-summary" aria-label="当前场景预设" data-testid="sidebar-preset-summary">
          <div className="sidebar-section-head">
            <span>预设</span>
            <strong>当前预设</strong>
          </div>
          <div className="preset-summary-orb" aria-hidden="true">
            <Bolt size={18} />
          </div>
          <strong>{activePresetSummary?.name ?? selectedPreset?.name ?? "未应用"}</strong>
          <small>
            {activePresetSummary
              ? `${activePresetSummary.activeCount}/${activePresetSummary.skillIds.length} 个技能 · ${
                  activePresetSummary.mode === "focus" ? "专注" : "叠加"
                }`
              : "自定义任务场景，按分类文件夹挑选 skills"}
          </small>
          <button className="ghost-button" type="button" onClick={() => setActiveView("presets")}>
            <Bolt size={15} />
            管理预设
          </button>
        </section>

        <section className="sidebar-panel">
          <p>项目仓库</p>
          <strong title={apiMeta.vaultRoot}>{compactPath(apiMeta.vaultRoot)}</strong>
          <small title={apiMeta.codexHome}>激活到 {compactPath(apiMeta.codexHome)}/skills</small>
          <button className="ghost-button" type="button" onClick={() => loadInventory()}>
            <Archive size={15} />
            重新扫描
          </button>
        </section>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyeline">本地技能控制台 · {apiStatusLabel(apiStatus)}</p>
            <h1>{viewTitles[activeView]}</h1>
          </div>
          <div className="top-actions">
            <button className="icon-button" type="button" onClick={handleExport} aria-label="导出清单">
              <Download size={18} />
            </button>
            <button
              className="icon-button"
              type="button"
              onClick={() => fileInputRef.current?.click()}
              aria-label="导入清单"
            >
              <Upload size={18} />
            </button>
            <input
              ref={fileInputRef}
              className="visually-hidden"
              type="file"
              accept="application/json"
              onChange={handleImport}
            />
            <button className="primary-button" type="button" onClick={() => setInstallOpen(true)}>
              <GitBranch size={18} />
              安装 Skill
            </button>
          </div>
        </header>

        {activeView === "library" ? (
          <>
        <section className="vault-hero command-deck" aria-label="Vault command deck">
          <video
            className="vault-hero-video"
            src="/media/coding-sequences-bg.mp4"
            poster="/media/coding-sequences-poster.jpg"
            autoPlay
            muted
            loop
            playsInline
            aria-hidden="true"
          />
          <div className="command-deck-copy">
            <span>仓库命令</span>
            <strong>{currentFolder?.name ?? "全部 Skills"}</strong>
            <p>{query ? `搜索锁定 "${query}"` : "浏览、归类、激活和关闭都围绕当前文件夹进行。"}</p>
          </div>
          <div className="command-deck-stats" aria-label="Skill 状态概览">
            <span>
              <strong>{skillsWithCategories.length}</strong>
              <small>总计</small>
            </span>
            <span>
              <strong>{enabledCount}</strong>
              <small>激活</small>
            </span>
            <span>
              <strong>{inactiveCount}</strong>
              <small>仓库</small>
            </span>
            <span>
              <strong>{auditIssueCount}</strong>
              <small>问题</small>
            </span>
          </div>
          <button
            className={batchMode ? "batch-mode-button active" : "batch-mode-button"}
            type="button"
            aria-pressed={batchMode}
            aria-label={batchMode ? "关闭批量模式" : "开启批量模式"}
            onClick={handleBatchModeToggle}
          >
            <CheckCircle2 size={17} />
            {batchMode ? "批量模式开启" : "批量模式"}
          </button>
          <div className="vault-hero-pulse" aria-hidden="true" />
        </section>

        <div
          ref={workbenchRef}
          className="workbench-main stage-workbench"
          aria-label="Stage manager workbench"
          data-stage={workbenchStage}
          style={{
            "--detail-row-height": `${detailRowHeight}px`,
            "--manager-stage-size": `${managerStageSize}%`,
            "--inspector-stage-size": `${inspectorStageSize}%`,
          }}
        >
        <section
          className="stage-region manager-stage"
          aria-label="Skill manager stage"
          data-promoted={workbenchStage === "manager"}
          onClickCapture={(event) => handleStageClickCapture("manager", event)}
        >
        <section className="vault-workbench" aria-label="Skill Vault 文件管理器">
          <aside className="folder-panel">
            <div className="folder-head">
              <div>
                <span>Skill 文件夹</span>
                <strong>{folderCategories.length} 组</strong>
              </div>
              <img src="/icons/tabler/folder-open.svg" alt="" aria-hidden="true" />
            </div>

            <div className="folder-grid" aria-label="Skill 分类文件夹">
              {folderCategories.map((category) => (
                <button
                  aria-label={`${category.name} ${category.count}`}
                  className={selectedCategoryId === category.id ? "folder-tile active" : "folder-tile"}
                  key={category.id}
                  onClick={() => setSelectedCategoryId(category.id)}
                  style={{ "--folder-color": category.color }}
                  type="button"
                >
                  <img src={category.id === "all" ? "/icons/tabler/archive.svg" : "/icons/tabler/folder.svg"} alt="" />
                  <span>{category.name}</span>
                  <strong>{category.count}</strong>
                  <small>{category.activeCount} 激活</small>
                </button>
              ))}
            </div>

            <form className="folder-create" onSubmit={handleCreateCategory}>
              <input
                value={newCategoryName}
                onChange={(event) => setNewCategoryName(event.target.value)}
                placeholder="新建分类"
                aria-label="新建分类名称"
              />
              <button type="submit" aria-label="新建分类">
                <img src="/icons/tabler/plus.svg" alt="" />
              </button>
            </form>
          </aside>

          <section className="explorer-panel" aria-label="Skill 列表">
            <div className="explorer-toolbar">
              <div>
                <span>技能浏览器</span>
                <strong>{currentFolder?.name ?? "全部 Skills"}</strong>
              </div>
              <label className="search-box explorer-search">
                <Search size={18} />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="搜索 skill、来源或描述"
                />
              </label>
              <div className="filter-tabs explorer-filters" role="tablist" aria-label="Skill 过滤">
                {filterTabs.map((tab) => (
                  <button
                    className={activeFilter === tab.id ? "filter-tab active" : "filter-tab"}
                    key={tab.id}
                    onClick={() => setActiveFilter(tab.id)}
                    type="button"
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="explorer-sections">
              <SkillSection
                label="已激活到 Codex"
                icon="/icons/tabler/file-check.svg"
                categories={categories}
                batchMode={batchMode}
                skills={activeSkills}
                selectedId={selectedSkill?.id}
                selectedSkillIds={batchSelectedIds}
                onSelect={setSelectedId}
                onAssignCategory={handleAssignCategory}
                onSelectionChange={handleSkillSelection}
                onSelectSection={handleSectionSelection}
                onBatchToggle={(skillIds) => handleBatchToggle(skillIds, false)}
                batchLabel="关闭所选"
                pendingSkillIds={batchPendingIds}
                onToggle={handleToggle}
                isSkillPending={isSkillPending}
              />
              <SkillSection
                label="Vault 未激活"
                icon="/icons/tabler/file-code.svg"
                categories={categories}
                batchMode={batchMode}
                skills={inactiveSkills}
                selectedId={selectedSkill?.id}
                selectedSkillIds={batchSelectedIds}
                onSelect={setSelectedId}
                onAssignCategory={handleAssignCategory}
                onSelectionChange={handleSkillSelection}
                onSelectSection={handleSectionSelection}
                onBatchToggle={(skillIds) => handleBatchToggle(skillIds, true)}
                batchLabel="启动所选"
                pendingSkillIds={batchPendingIds}
                onToggle={handleToggle}
                isSkillPending={isSkillPending}
              />
            </div>
          </section>
          {batchMode && batchSelectedSkills.length > 0 ? (
            <div className="bulk-action-bar" aria-label="Bulk action bar">
              <strong>{batchSelectedSkills.length} 已选</strong>
              <button
                type="button"
                aria-label="Activate selected skills"
                onClick={() => handleBatchToggle(batchSelectedInactiveIds, true)}
                disabled={!batchSelectedInactiveIds.length || batchPendingIds.size > 0}
              >
                <Bolt size={15} />
                启动 {batchSelectedInactiveIds.length}
              </button>
              <button
                type="button"
                aria-label="Close selected skills"
                onClick={() => handleBatchToggle(batchSelectedActiveIds, false)}
                disabled={!batchSelectedActiveIds.length || batchPendingIds.size > 0}
              >
                <Power size={15} />
                关闭 {batchSelectedActiveIds.length}
              </button>
              <button
                type="button"
                aria-label="Clear selected skills"
                onClick={() => setBatchSelectedIds(new Set())}
              >
                清空
              </button>
            </div>
          ) : null}
        </section>
        </section>

        <button
          className="stage-divider"
          type="button"
          aria-label="Adjust workbench split"
          onPointerDown={handleWorkbenchResizeStart}
        >
          <span />
        </button>

        <section
          className="stage-region inspector-stage"
          aria-label="Skill inspector stage"
          data-promoted={workbenchStage === "inspector"}
          onClickCapture={(event) => handleStageClickCapture("inspector", event)}
        >
          <aside className="detail-panel vault-detail skill-inspector" aria-label="技能检查器">
            <div className="detail-head">
              <span className="detail-icon">
                <img src={selectedSkill?.enabled ? "/icons/tabler/file-check.svg" : "/icons/tabler/file-code.svg"} alt="" />
              </span>
              <div>
                <small>技能检查 · {selectedSkill?.categoryName ?? selectedSkill?.source}</small>
                <h2>{selectedSkill?.name}</h2>
              </div>
            </div>

            <section
              className="inspector-reader"
              aria-label="Inspector 阅读窗口"
              data-focus={readerFocus}
              style={{ "--primary-reader-height": `${readerHeight}px` }}
            >
              <div className="reader-toolbar">
                <div>
                  <span>阅读窗口</span>
                  <strong>{readerFocus === "skill" ? "SKILL.md" : "描述"}</strong>
                </div>
                <small>{readerHeight}px</small>
              </div>

              <div className="reader-stage">
                <article className="reader-primary">
                  <div className="reader-pane-head">
                    <h3>{readerFocus === "skill" ? "SKILL.md" : "描述"}</h3>
                    <span>主窗口</span>
                  </div>
                  {readerFocus === "skill" ? (
                    <textarea
                      aria-label="SKILL.md 预览"
                      disabled={!selectedSkill || draftPending}
                      value={selectedSkillDraft}
                      onChange={(event) => handleDraftChange(event.target.value)}
                      spellCheck="false"
                    />
                  ) : (
                    <p>{selectedSkill?.description}</p>
                  )}
                </article>

                <button
                  className="reader-secondary"
                  type="button"
                  aria-label={readerFocus === "skill" ? "放大描述" : "放大 SKILL.md"}
                  onClick={() => setReaderFocus(readerFocus === "skill" ? "description" : "skill")}
                >
                  <strong>{readerFocus === "skill" ? "描述" : "SKILL.md"}</strong>
                  <small>
                    {readerFocus === "skill"
                      ? selectedSkill?.description
                      : selectedSkillDraft.slice(0, 220)}
                  </small>
                </button>

                <button
                  className="reader-resize-handle"
                  type="button"
                  aria-label="调整阅读窗口大小"
                  onPointerDown={handleReaderResizeStart}
                >
                  <span />
                  <small>拖动</small>
                </button>
              </div>
            </section>

            <section className="health-panel" aria-label="健康检查">
              <div className="health-head">
                <span>健康检查</span>
                <strong>{selectedAudit?.score ?? 0}</strong>
              </div>
              <div className="health-list">
                {(selectedAudit?.items ?? []).map((item) => (
                  <span className={`health-item ${item.tone}`} key={item.label}>
                    {item.label}
                  </span>
                ))}
              </div>
            </section>

            <label className="category-field">
              <span>归类文件夹</span>
              <select
                aria-label="归类文件夹"
                value={selectedSkill?.categoryId ?? "uncategorized"}
                onChange={(event) => handleAssignCategory(selectedSkill?.id, event.target.value)}
                disabled={!selectedSkill || isSkillPending(selectedSkill?.id)}
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>

            <dl className="detail-list">
              <div>
                <dt>激活状态</dt>
                <dd>{selectedSkill?.enabled ? "已激活到 Codex" : "保留在 Vault"}</dd>
              </div>
              <div>
                <dt>路径</dt>
                <dd>{selectedSkill?.path}</dd>
              </div>
              <div>
                <dt>触发词</dt>
                <dd>{selectedSkill?.triggers?.join(" / ")}</dd>
              </div>
              <div>
                <dt>最近更新</dt>
                <dd>{selectedSkill?.updatedAt}</dd>
              </div>
            </dl>

            <div className="detail-actions">
              <button
                className={selectedSkill?.enabled ? "secondary-button active" : "secondary-button"}
                type="button"
                onClick={() => handleToggle(selectedSkill?.id)}
                disabled={!selectedSkill || isSkillPending(selectedSkill?.id)}
              >
                <Power size={17} />
                {selectedSkill?.enabled ? "关闭" : "激活"}
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={() => handleUpdate(selectedSkill?.id)}
                disabled={!selectedSkill || isSkillPending(selectedSkill?.id) || (!apiLive && selectedSkill?.status !== "update")}
              >
                <RefreshCw size={17} />
                同步
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={handleSaveSkillDraft}
                disabled={!selectedSkill || draftPending}
              >
                <FileJson size={17} />
                保存草稿
              </button>
              <button
                className="danger-button"
                type="button"
                onClick={() => handleRemove(selectedSkill?.id)}
                disabled={!selectedSkill || isSkillPending(selectedSkill?.id)}
              >
                <Trash2 size={17} />
                从仓库删除
              </button>
            </div>
          </aside>
        </section>
        </div>
          </>
        ) : activeView === "presets" ? (
          <PresetStudio
            basePreset={basePreset}
            batchPendingIds={batchPendingIds}
            folders={folderCategories}
            presetQuery={presetQuery}
            presets={taskPresets}
            presetSkills={skillsWithCategories}
            selectedPreset={selectedPreset}
            selectedPresetDirectSkills={selectedPresetDirectSkills}
            selectedPresetInheritedSkills={selectedPresetInheritedSkills}
            selectedPresetInheritedSkillSet={inheritedPresetSkillSet}
            selectedPresetSkillSet={selectedPresetSkillSet}
            selectedPresetSummary={selectedPresetSummary}
            summaries={presetSummaries}
            onApplyPreset={handleApplyPreset}
            onCreatePreset={handleCreatePreset}
            onDeletePreset={handleDeletePreset}
            onDuplicatePreset={handleDuplicatePreset}
            onFieldChange={handlePresetFieldChange}
            onPresetQueryChange={setPresetQuery}
            onSavePreset={handleSavePreset}
            onSelectPreset={setSelectedPresetId}
            onToggleSkill={handleTogglePresetSkill}
          />
        ) : activeView === "install" ? (
          <section className="workspace-page source-workspace" aria-label="安装源工作区">
            <div className="view-card install-console">
              <div className="view-card-head">
                <div>
                  <span>GitHub 来源</span>
                  <strong>下载安装到 Vault，并可立即激活到 Codex</strong>
                </div>
                <GitBranch size={24} />
              </div>
              <form className="inline-install-form" onSubmit={handleInstall}>
                <label className="field">
                  <span>GitHub URL</span>
                  <input
                    value={githubUrl}
                    onChange={(event) => setGithubUrl(event.target.value)}
                    placeholder="https://github.com/owner/repo/tree/main/path/to/skill"
                    required
                  />
                </label>
                <button className="primary-button wide" type="submit" disabled={installPending}>
                  {apiLive ? "下载并激活" : "确认安装"}
                  <ArrowRight size={18} />
                </button>
              </form>
            </div>
            <div className="view-card source-library" data-testid="source-library" aria-label="推荐 Skill 资源库">
              <div className="view-card-head compact">
                <div>
                  <span>资源库</span>
                  <strong>推荐包、收藏源和可更新提示</strong>
                </div>
                <PackageCheck size={22} />
              </div>
              <div className="source-library-grid">
                {sourceLibraryItems.map((item) => (
                  <article className="source-library-card" key={item.id}>
                    <span>{item.badge}</span>
                    <strong>{item.name}</strong>
                    <p>{item.note}</p>
                    <button className="secondary-button" type="button" onClick={() => setGithubUrl(item.url)}>
                      预览来源
                      <ChevronRight size={15} />
                    </button>
                  </article>
                ))}
              </div>
            </div>
            <div className="view-card compact-guide">
              <span>安装逻辑</span>
              <strong>下载 → 放入本项目 Vault → 激活时复制到 Codex skills</strong>
              <p>安装源页面只保留一个主要动作，避免把“下载、归类、激活”揉成一堆按钮。</p>
            </div>
          </section>
        ) : activeView === "manifest" ? (
          <section className="workspace-page manifest-workspace" aria-label="清单工作区">
            <div className="view-card manifest-card">
              <div className="view-card-head">
                <div>
                  <span>清单数据</span>
                  <strong>当前 skill 清单预览</strong>
                </div>
                <FileJson size={24} />
              </div>
              <pre>{JSON.stringify(buildManifest(skillsWithCategories), null, 2)}</pre>
            </div>
            <div className="view-card manifest-actions">
              <button className="primary-button wide" type="button" onClick={handleExport}>
                <Download size={18} />
                导出清单
              </button>
              <button className="secondary-button" type="button" onClick={() => fileInputRef.current?.click()}>
                <Upload size={18} />
                导入清单
              </button>
              <p>清单页只处理导入导出和预览，不混进 skill 激活操作。</p>
            </div>
          </section>
        ) : (
          <section className="workspace-page settings-workspace" aria-label="设置工作区">
            <div className="view-card settings-card">
              <div className="view-card-head">
                <div>
                  <span>本地路径</span>
                  <strong>本地仓库与 Codex 目标路径</strong>
                </div>
                <Settings2 size={24} />
              </div>
              <dl className="settings-list">
                <div>
                  <dt>仓库</dt>
                  <dd>{compactPath(apiMeta.vaultRoot)}</dd>
                </div>
                <div>
                  <dt>Codex 技能</dt>
                  <dd>{compactPath(apiMeta.codexHome)}/skills</dd>
                </div>
                <div>
                  <dt>接口</dt>
                  <dd>{apiStatusLabel(apiStatus)}</dd>
                </div>
              </dl>
              <button className="secondary-button" type="button" onClick={() => loadInventory()}>
                <Archive size={17} />
                重新扫描
              </button>
            </div>
            <div className="view-card material-card">
              <div className="view-card-head">
                <div>
                  <span>素材库候选</span>
                  <strong>优先选许可清晰的抽象科技视频</strong>
                </div>
                <Sparkle size={24} />
              </div>
              <div className="material-list">
                {materialLibraries.map((library) => (
                  <a href={library.url} key={library.name} target="_blank" rel="noreferrer">
                    <strong>{library.name}</strong>
                    <span>{library.note}</span>
                    <ChevronRight size={17} />
                  </a>
                ))}
              </div>
            </div>
          </section>
        )}

      </section>

      {installOpen ? (
        <div className="overlay" role="dialog" aria-modal="true" aria-label="安装 Skill">
          <form className="install-panel" onSubmit={handleInstall}>
            <div className="install-head">
              <div>
                <small>GitHub 来源</small>
                <h2>安装 Skill</h2>
              </div>
              <button
                className="icon-button"
                type="button"
                onClick={() => setInstallOpen(false)}
                aria-label="关闭"
              >
                <X size={18} />
              </button>
            </div>
            <label className="field">
              <span>GitHub URL</span>
              <input
                value={githubUrl}
                onChange={(event) => setGithubUrl(event.target.value)}
                placeholder="https://github.com/owner/repo/tree/main/path/to/skill"
                required
              />
            </label>
            <div className="install-preview">
              <GitBranch size={18} />
              <span>将解析路径末尾目录名，并加入本地 skill 索引。</span>
            </div>
            <button className="primary-button wide" type="submit" disabled={installPending}>
              {apiLive ? "下载并激活" : "确认安装"}
              <ArrowRight size={18} />
            </button>
          </form>
        </div>
      ) : null}

      {toast ? (
        <div className="toast" role="status">
          {toast}
        </div>
      ) : null}
    </main>
  );
}


function PresetStudio({
  basePreset,
  batchPendingIds,
  folders,
  onApplyPreset,
  onCreatePreset,
  onDeletePreset,
  onDuplicatePreset,
  onFieldChange,
  onPresetQueryChange,
  onSavePreset,
  onSelectPreset,
  onToggleSkill,
  presetQuery,
  presets,
  presetSkills,
  selectedPreset,
  selectedPresetDirectSkills,
  selectedPresetInheritedSkills,
  selectedPresetInheritedSkillSet,
  selectedPresetSkillSet,
  selectedPresetSummary,
  summaries,
}) {
  const [pickerCategoryId, setPickerCategoryId] = useState("");
  const summaryMap = useMemo(() => new Map(summaries.map((summary) => [summary.id, summary])), [summaries]);
  const selectedCount = selectedPresetSummary?.skillIds.length ?? 0;
  const activeCount = selectedPresetSummary?.activeCount ?? 0;
  const pending = batchPendingIds.size > 0;
  const folderQuery = presetQuery.trim().toLowerCase();
  const pickerFolders = useMemo(
    () => {
      const skillIdsByFolder = new Map();
      for (const skill of presetSkills) {
        const list = skillIdsByFolder.get(skill.categoryId);
        if (list) list.push(skill);
        else skillIdsByFolder.set(skill.categoryId, [skill]);
      }

      return folders
        .filter((folder) => folder.id !== "all")
        .filter((folder) => {
          if (!folderQuery) return folder.count > 0;
          const folderHaystack = [folder.id, folder.name].join(" ").toLowerCase();
          if (folderHaystack.includes(folderQuery)) return true;
          const folderSkills = skillIdsByFolder.get(folder.id) ?? [];
          return folderSkills.some((skill) => {
            const skillHaystack = [
              skill.id,
              skill.name,
              skill.description,
              skill.source,
              skill.categoryId,
              skill.categoryName,
              skill.path,
              ...(skill.triggers ?? []),
            ].join(" ").toLowerCase();
            return skillHaystack.includes(folderQuery);
          });
        })
        .map((folder) => ({
          ...folder,
          inheritedCount: presetSkills.filter(
            (skill) => skill.categoryId === folder.id && selectedPresetInheritedSkillSet.has(skill.id),
          ).length,
          selectedCount: presetSkills.filter(
            (skill) => skill.categoryId === folder.id && selectedPresetSkillSet.has(skill.id),
          ).length,
        }));
    },
    [folderQuery, folders, presetSkills, selectedPresetInheritedSkillSet, selectedPresetSkillSet],
  );
  const activeFolder = pickerFolders.find((folder) => folder.id === pickerCategoryId);
  const visibleSkillOptions = useMemo(() => {
    const scopedSkills = pickerCategoryId
      ? presetSkills.filter((skill) => skill.categoryId === pickerCategoryId)
      : presetSkills;
    return filterPresetSkillOptions(scopedSkills, presetQuery);
  }, [pickerCategoryId, presetQuery, presetSkills]);

  function handleOpenFolder(categoryId) {
    setPickerCategoryId(categoryId);
    onPresetQueryChange("");
  }

  function handleBackToFolders() {
    setPickerCategoryId("");
    onPresetQueryChange("");
  }

  return (
    <section className="workspace-page preset-workspace preset-studio" aria-label="场景预设工作台" data-testid="preset-studio">
      <aside className="view-card preset-list-panel">
        <div className="view-card-head compact">
          <div>
            <span>预设工作台</span>
            <strong>任务预设</strong>
          </div>
          <button className="icon-button dark" type="button" onClick={onCreatePreset} aria-label="新建预设">
            <Bolt size={18} />
          </button>
        </div>

        <div className="preset-list" aria-label="预设列表">
          {presets.map((preset) => {
            const summary = summaryMap.get(preset.id);
            const active = preset.id === selectedPreset?.id;
            const isBasePreset = preset.id === BASE_PRESET_ID;
            return (
              <button
                aria-pressed={active}
                className={[
                  "preset-list-item",
                  active ? "active" : "",
                  isBasePreset ? "base" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                key={preset.id}
                onClick={() => onSelectPreset(preset.id)}
                style={{ "--preset-color": preset.color }}
                type="button"
              >
                <span className="preset-list-glow" aria-hidden="true" />
                <strong>{preset.name}</strong>
                <small>{preset.description || "未填写说明"}</small>
                <em>
                  {summary?.activeCount ?? 0}/{summary?.skillIds.length ?? 0}
                </em>
              </button>
            );
          })}
        </div>
      </aside>

      <section className="view-card preset-editor" aria-label="预设编辑器">
        <div className="view-card-head">
          <div>
            <span>自定义装载</span>
            <strong>{selectedPreset?.name ?? "新任务预设"}</strong>
          </div>
          <div className="preset-editor-meter">
            <strong>{activeCount}</strong>
            <span>/{selectedCount} 激活</span>
          </div>
        </div>

        <div className="preset-form-grid">
          <label className="field">
            <span>预设名称</span>
            <input
              aria-label="预设名称"
              value={selectedPreset?.name ?? ""}
              onChange={(event) => onFieldChange({ name: event.target.value })}
            />
          </label>
          <label className="field">
            <span>应用模式</span>
            <select
              aria-label="应用模式"
              value={selectedPreset?.mode ?? "merge"}
              onChange={(event) => onFieldChange({ mode: event.target.value })}
            >
              <option value="merge">叠加启用：只开启预设内 skills</option>
              <option value="focus">专注模式：开启预设并关闭其他已激活 skills</option>
            </select>
          </label>
        </div>

        <label className="field preset-description-field">
          <span>预设说明</span>
          <textarea
            aria-label="预设说明"
            value={selectedPreset?.description ?? ""}
            onChange={(event) => onFieldChange({ description: event.target.value })}
            placeholder="例如：写论文时同时开启定稿、PDF、文档和调试验证能力"
          />
        </label>

        <div className="preset-selected-list" data-testid="preset-selected-skills" aria-label="已选择 skill">
          {selectedPresetInheritedSkills.length ? (
            <div className="preset-selected-group base" aria-label="通用场景继承 skills">
              <span>通用场景</span>
              {selectedPresetInheritedSkills.map((skill) => (
                <button
                  className="preset-chip base"
                  key={`base-${skill.id}`}
                  onClick={() => basePreset && onSelectPreset(basePreset.id)}
                  type="button"
                  aria-label={`查看通用场景 ${skill.name}`}
                >
                  <span style={{ background: basePreset?.color ?? "#77f2bf" }} />
                  {skill.name}
                  <small>通用</small>
                </button>
              ))}
            </div>
          ) : null}

          {selectedPresetDirectSkills.length ? (
            <div className="preset-selected-group direct" aria-label="当前预设自选 skills">
              <span>{selectedPreset?.id === BASE_PRESET_ID ? "通用基本盘" : "当前预设"}</span>
              {selectedPresetDirectSkills.map((skill) => (
                <button
                  className="preset-chip direct"
                  key={skill.id}
                  onClick={() => onToggleSkill(skill.id)}
                  type="button"
                  aria-label={`从预设移除 ${skill.name}`}
                >
                  <span style={{ background: skill.categoryColor }} />
                  {skill.name}
                  <X size={13} />
                </button>
              ))}
            </div>
          ) : null}

          {!selectedPresetInheritedSkills.length && !selectedPresetDirectSkills.length ? (
            <small>还没有选择 skill。右侧先进入分类文件夹，再在二级页面勾选。</small>
          ) : (
            null
          )}
        </div>

        <div className="preset-actions">
          <button className="primary-button wide" type="button" onClick={onSavePreset}>
            <CheckCircle2 size={17} />
            保存预设
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={() => onApplyPreset(selectedPreset?.id)}
            disabled={!selectedCount || pending}
          >
            <Bolt size={17} />
            应用预设
          </button>
          <button className="secondary-button" type="button" onClick={onDuplicatePreset} disabled={!selectedPreset}>
            <FileJson size={17} />
            复制
          </button>
          <button className="danger-button" type="button" onClick={onDeletePreset} disabled={!selectedPreset}>
            <Trash2 size={17} />
            删除
          </button>
        </div>
      </section>

      <section className="view-card preset-skill-picker" aria-label="分类文件夹选择">
        <div className="view-card-head compact">
          <div>
            <span>分类选择</span>
            <strong>{activeFolder ? `${activeFolder.name} 技能` : "分类文件夹"}</strong>
          </div>
          <em>{activeFolder ? `${visibleSkillOptions.length} 个技能` : `${pickerFolders.length} 个分类`}</em>
        </div>

        <label className="search-box preset-search">
          <Search size={17} />
          <input
            value={presetQuery}
            onChange={(event) => onPresetQueryChange(event.target.value)}
            placeholder={activeFolder ? "筛选该分类的 skill" : "搜索分类文件夹"}
          />
        </label>

        {activeFolder ? (
          <>
            <button className="preset-back-button" type="button" onClick={handleBackToFolders} aria-label="返回分类文件夹">
              <ChevronRight size={15} />
              返回分类文件夹
            </button>
            <div className="preset-skill-list">
              {visibleSkillOptions.map((skill) => {
                const checked = selectedPresetSkillSet.has(skill.id);
                const inherited = selectedPresetInheritedSkillSet.has(skill.id) && !checked;
                return (
                  <label
                    className={[
                      "preset-skill-row",
                      checked ? "selected" : "",
                      inherited ? "inherited" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    data-enabled={skill.enabled ? "true" : "false"}
                    data-origin={inherited ? "base" : checked ? "direct" : "none"}
                    key={skill.id}
                    style={{ "--skill-color": inherited ? basePreset?.color ?? "#77f2bf" : skill.categoryColor }}
                  >
                    <input
                      type="checkbox"
                      aria-label={`选择 ${skill.name}`}
                      checked={checked}
                      onChange={() => onToggleSkill(skill.id)}
                    />
                    <span className="preset-skill-status" aria-hidden="true" />
                    <span className="preset-skill-copy">
                      <strong>{skill.name}</strong>
                      <small>
                        {skill.categoryName} · {skill.enabled ? "已激活" : "仓库内"} · {inherited ? "通用场景" : skill.source}
                      </small>
                    </span>
                    {inherited ? <em>通用</em> : null}
                  </label>
                );
              })}
            </div>
          </>
        ) : (
          <div className="preset-folder-grid" aria-label="预设分类文件夹">
            {pickerFolders.map((folder) => (
              <button
                className="preset-folder-card"
                key={folder.id}
                onClick={() => handleOpenFolder(folder.id)}
                style={{ "--folder-color": folder.color }}
                type="button"
                aria-label={`打开分类 ${folder.name}`}
              >
                <img src="/icons/tabler/folder.svg" alt="" aria-hidden="true" />
                <span>{folder.name}</span>
                <strong>{folder.count}</strong>
                <small>
                  {folder.inheritedCount ? `${folder.inheritedCount} 通用 · ` : ""}
                  {folder.selectedCount} 自选 · {folder.activeCount} 激活
                </small>
                <ChevronRight size={16} />
              </button>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

function SkillSection({
  batchMode,
  batchLabel,
  categories,
  icon,
  isSkillPending,
  label,
  onAssignCategory,
  onBatchToggle,
  onSelect,
  onSelectionChange,
  onSelectSection,
  onToggle,
  pendingSkillIds,
  selectedId,
  selectedSkillIds,
  skills,
}) {
  const selectedIds = skills.filter((skill) => selectedSkillIds.has(skill.id)).map((skill) => skill.id);
  const allSelected = skills.length > 0 && selectedIds.length === skills.length;
  const hasPending = skills.some((skill) => isSkillPending(skill.id));

  return (
    <section className={batchMode ? "skill-zone batch-mode" : "skill-zone"} aria-label={label}>
      <div className="zone-head">
        <span>
          <img src={icon} alt="" />
          {label}
        </span>
        <div className="zone-tools">
          <strong>{skills.length}</strong>
          {batchMode ? (
            <>
              <button
                className="zone-mini-button"
                type="button"
                onClick={() => onSelectSection(skills, !allSelected)}
                disabled={!skills.length || hasPending}
                aria-label={`${allSelected ? "清空选择" : "全选"} ${label}`}
              >
                {allSelected ? "清空" : "全选"}
              </button>
              <button
                className="zone-batch-button"
                type="button"
                onClick={() => onBatchToggle(selectedIds)}
                disabled={!selectedIds.length || hasPending || pendingSkillIds.size > 0}
                aria-label={`${batchLabel} ${label}`}
              >
                {batchLabel}
                <span>{selectedIds.length}</span>
              </button>
            </>
          ) : (
            <span className="zone-mode-chip">{label.includes("未激活") ? "待命" : "就绪"}</span>
          )}
        </div>
      </div>
      <div className="skill-card-grid">
        {skills.map((skill) => (
          <SkillFileCard
            batchMode={batchMode}
            key={skill.id}
            skill={skill}
            selected={selectedId === skill.id}
            selectedForBatch={selectedSkillIds.has(skill.id)}
            pending={isSkillPending(skill.id)}
            onSelect={onSelect}
            onAssignCategory={onAssignCategory}
            categories={categories}
            onSelectionChange={onSelectionChange}
            onToggle={onToggle}
          />
        ))}
        {skills.length === 0 ? (
          <div className="zone-empty">
            <img src="/icons/tabler/file-off.svg" alt="" />
            <span>这里暂时没有 skill</span>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function SkillFileCard({
  batchMode,
  categories,
  onAssignCategory,
  onSelect,
  onSelectionChange,
  onToggle,
  pending,
  selected,
  selectedForBatch,
  skill,
}) {
  const className = [
    "skill-file",
    selected ? "selected" : "",
    batchMode ? "selection-open" : "",
    batchMode && selectedForBatch ? "batch-selected" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article className={className} data-active={skill.enabled} style={{ "--file-color": categoryColor(skill.categoryId) }}>
      {batchMode ? (
        <label className="file-select">
          <input
            type="checkbox"
            checked={selectedForBatch}
            onChange={(event) => onSelectionChange(skill.id, event.target.checked)}
            disabled={pending}
            aria-label={`选择 ${skill.name}`}
          />
          <span aria-hidden="true" />
        </label>
      ) : null}
      <button className="skill-file-main" type="button" onClick={() => onSelect(skill.id)}>
        <span className="skill-file-icon" style={{ "--file-color": categoryColor(skill.categoryId) }}>
          <img
            src={skill.enabled ? "/icons/tabler/file-check.svg" : "/icons/tabler/file-code.svg"}
            alt=""
            aria-hidden="true"
          />
        </span>
        <span className="skill-file-text">
          <strong>{skill.name}</strong>
          <small>{skill.description}</small>
        </span>
      </button>
      <div className="skill-file-meta">
        <label className="file-group-select">
          <span>归类</span>
          <select
            aria-label={`将 ${skill.name} 归类到`}
            value={skill.categoryId}
            disabled={pending}
            onChange={(event) => {
              onSelect(skill.id);
              onAssignCategory(skill.id, event.target.value);
            }}
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <span>{skill.source}</span>
      </div>
      <button
        className={skill.enabled ? "quick-toggle active" : "quick-toggle"}
        type="button"
        onClick={() => onToggle(skill.id)}
        disabled={pending}
      >
        <img src={skill.enabled ? "/icons/tabler/power.svg" : "/icons/tabler/bolt.svg"} alt="" />
        {skill.enabled ? "关闭" : "激活"}
      </button>
    </article>
  );
}


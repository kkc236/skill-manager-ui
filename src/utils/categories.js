export const fallbackCategories = [
  { id: "writing", name: "论文写作", color: "#8b5cf6" },
  { id: "frontend", name: "前端与界面", color: "#0ea5e9" },
  { id: "automation", name: "自动化工具", color: "#10b981" },
  { id: "debugging", name: "调试测试", color: "#f97316" },
  { id: "documents", name: "文档文件", color: "#64748b" },
  { id: "uncategorized", name: "未分类", color: "#71717a" },
];

export function applyFrontendCategories(skills, categories) {
  return skills.map((skill) => {
    const categoryId = skill.categoryId ?? inferFrontendCategory(skill);
    const category =
      categories.find((item) => item.id === categoryId) ??
      fallbackCategories.find((item) => item.id === categoryId) ??
      fallbackCategories.at(-1);

    return {
      ...skill,
      categoryId: category.id,
      categoryColor: category.color,
      categoryName: category.name,
    };
  });
}

export function buildFolderCategories(categories, skills) {
  const enriched = categories.map((category) => ({
    ...category,
    activeCount: skills.filter((skill) => skill.categoryId === category.id && skill.enabled).length,
    count: skills.filter((skill) => skill.categoryId === category.id).length,
  }));

  return [
    {
      activeCount: skills.filter((skill) => skill.enabled).length,
      color: "#111111",
      count: skills.length,
      id: "all",
      name: "全部技能",
    },
    ...enriched,
  ];
}

function inferFrontendCategory(skill) {
  const haystack = [skill.id, skill.name, skill.description, skill.source, ...(skill.triggers ?? [])]
    .join(" ")
    .toLowerCase();

  if (/paper|academic|thesis|论文|写作|composer|strategist/.test(haystack)) return "writing";
  if (/front|ui|ux|web|react|browser|figma|design|前端|界面/.test(haystack)) return "frontend";
  if (/debug|test|verify|review|tdd|调试|测试|验证/.test(haystack)) return "debugging";
  if (/doc|pdf|sheet|slide|文档|表格/.test(haystack)) return "documents";
  if (/agent|automation|workflow|github|linear|drive|dispatch|自动化/.test(haystack)) return "automation";
  return "uncategorized";
}

export function slugifyCategory(value) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "") || `cat-${Date.now()}`
  );
}

export function categoryColor(categoryId) {
  return (
    [...fallbackCategories].find((category) => category.id === categoryId)?.color ??
    "#71717a"
  );
}

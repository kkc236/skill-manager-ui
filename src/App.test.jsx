import "@testing-library/jest-dom/vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

async function enterConsole(user) {
  await user.click(screen.getByRole("button", { name: "进入管理台" }));
}

describe("Skill Manager UI", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("starts with an interactive coverage guide before entering the console", async () => {
    const user = userEvent.setup();
    render(<App />);

    const guide = screen.getByLabelText("Skill manager guide");
    expect(within(guide).getByTestId("guide-video")).toHaveAttribute(
      "src",
      "/media/coding-technology-bg.mp4",
    );
    expect(within(guide).getByTestId("guide-video")).toHaveAttribute(
      "poster",
      "/media/coding-technology-poster.jpg",
    );
    expect(within(guide).getByTestId("guide-game-layer")).toBeInTheDocument();
    expect(within(guide).getByLabelText("Guide mission panel")).toBeInTheDocument();
    expect(within(guide).getByRole("heading", { name: "Skill Coverage" })).toBeInTheDocument();
    expect(within(guide).getByText("01 FIND")).toBeInTheDocument();
    expect(within(guide).getByText("02 INSTALL")).toBeInTheDocument();
    expect(within(guide).getByText("03 SYNC")).toBeInTheDocument();
    expect(screen.queryByLabelText("Skill 列表")).not.toBeInTheDocument();

    fireEvent.pointerMove(guide, { clientX: 900, clientY: 320 });
    expect(guide.style.getPropertyValue("--pointer-x")).toBe("900px");
    expect(guide.style.getPropertyValue("--pointer-y")).toBe("320px");
    expect(guide).toHaveAttribute("data-reticle-hit", "false");

    const installStep = within(guide).getByRole("button", { name: "Preview install step" });
    fireEvent.pointerMove(installStep, { clientX: 520, clientY: 420 });
    expect(guide.style.getPropertyValue("--pointer-x")).toBe("520px");
    expect(guide.style.getPropertyValue("--pointer-y")).toBe("420px");
    expect(guide).toHaveAttribute("data-reticle-hit", "true");

    await user.click(installStep);
    expect(installStep).toHaveAttribute("aria-pressed", "true");
    expect(within(guide).getByText("GitHub URL")).toBeInTheDocument();

    const syncStep = within(guide).getByRole("button", { name: "Preview sync step" });
    const syncRect = vi.spyOn(syncStep, "getBoundingClientRect").mockReturnValue({
      bottom: 580,
      height: 80,
      left: 480,
      right: 720,
      top: 500,
      width: 240,
      x: 480,
      y: 500,
      toJSON: () => ({}),
    });
    fireEvent.pointerMove(guide, { clientX: 520, clientY: 540 });
    expect(guide).toHaveAttribute("data-reticle-hit", "true");
    fireEvent.pointerMove(guide, { clientX: 728, clientY: 540 });
    expect(guide).toHaveAttribute("data-reticle-hit", "true");
    syncRect.mockRestore();

    await user.click(syncStep);
    expect(syncStep).toHaveAttribute("aria-pressed", "true");
    expect(within(guide).getByText("UPDATE QUEUE")).toBeInTheDocument();

    await enterConsole(user);
    expect(screen.getByLabelText("Skill 列表")).toBeInTheDocument();
  });

  it("returns to the cover guide after a browser refresh", async () => {
    const user = userEvent.setup();
    const firstRender = render(<App />);

    await enterConsole(user);
    expect(screen.getByTestId("console-background-video")).toBeInTheDocument();

    firstRender.unmount();
    render(<App />);

    expect(screen.getByLabelText("Skill manager guide")).toBeInTheDocument();
    expect(screen.queryByTestId("console-background-video")).not.toBeInTheDocument();
  });

  it("keeps the original cover guide recoverable from the console", async () => {
    const user = userEvent.setup();
    render(<App />);

    await enterConsole(user);
    expect(screen.queryByLabelText("Skill manager guide")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "封面" }));

    const guide = screen.getByLabelText("Skill manager guide");
    expect(within(guide).getByRole("heading", { name: "Skill Coverage" })).toBeInTheDocument();

    await enterConsole(user);
    expect(screen.getByLabelText("Skill 列表")).toBeInTheDocument();
  });

  it("keeps the guide reticle tracking immediate instead of easing behind the pointer", () => {
    const css = readFileSync(join(process.cwd(), "src", "styles.css"), "utf8");

    expect(css).toContain("will-change: transform");
    expect(css).toContain("cursor: none");
    expect(css).toContain("z-index: 30");
    expect(css).toContain("mix-blend-mode: normal");
    expect(css).toContain("transition: none;");
    expect(css).toContain(
      "transform: translate3d(var(--pointer-x), var(--pointer-y), 0) translate(-50%, -50%)",
    );
    expect(css).toContain('.guide-shell[data-reticle-hit="true"] .guide-reticle');
    expect(css).toContain("#ff1212");
    expect(css).not.toContain("left 80ms");
    expect(css).not.toContain("top 80ms");
    expect(css).not.toContain("transition: opacity 120ms");
    expect(css).not.toMatch(/@media \(max-width: 680px\)[\s\S]*?\.guide-reticle\s*\{[\s\S]*?display: none;/);

    const stepHoverBlock = css.match(
      /\.guide-step:hover,\s*\.guide-step:focus-visible \{([\s\S]*?)\n\}/,
    )?.[1];
    expect(stepHoverBlock).toBeDefined();
    expect(stepHoverBlock).not.toContain("transform");
  });

  it("keeps the management console focused without duplicate lower dashboards", async () => {
    const user = userEvent.setup();
    render(<App />);
    await enterConsole(user);

    expect(screen.queryByLabelText("Video style coverage")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Skill 状态统计")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("最近操作")).not.toBeInTheDocument();
    expect(screen.queryByText("FIND")).not.toBeInTheDocument();
  });

  it("renders the main management surface with practical controls", async () => {
    const user = userEvent.setup();
    render(<App />);
    await enterConsole(user);

    expect(screen.getByRole("heading", { name: "技能库" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("搜索 skill、来源或描述")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "安装 Skill" })).toBeInTheDocument();
    expect(screen.getByLabelText("Vault command deck")).toBeInTheDocument();
    expect(screen.getByTestId("sidebar-background-video")).toHaveAttribute("src", "/media/mixkit-data-network.mp4");
    expect(screen.getByRole("button", { name: "开启批量模式" })).toBeInTheDocument();
    expect(screen.getByText("Skill 文件夹")).toBeInTheDocument();
    expect(screen.getByLabelText("已激活到 Codex")).toBeInTheDocument();
    expect(screen.getByLabelText("Vault 未激活")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "预设" })).toBeInTheDocument();
    expect(screen.getByTestId("sidebar-preset-summary")).toBeInTheDocument();
    expect(screen.queryByLabelText("场景 Profiles")).not.toBeInTheDocument();
    expect(screen.getByLabelText("健康检查")).toBeInTheDocument();
    expect(screen.getByLabelText("Inspector 阅读窗口")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "放大 SKILL.md" })).toBeInTheDocument();
    expect(screen.queryByText("最近操作")).not.toBeInTheDocument();
  });

  it("promotes the manager and inspector like a stage-managed workbench", async () => {
    const user = userEvent.setup();
    render(<App />);
    await enterConsole(user);

    const workbench = screen.getByLabelText("Stage manager workbench");
    const managerStage = screen.getByLabelText("Skill manager stage");
    const inspectorStage = screen.getByLabelText("Skill inspector stage");

    expect(workbench).toHaveAttribute("data-stage", "manager");
    expect(workbench).toHaveStyle({
      "--manager-stage-size": "80%",
      "--inspector-stage-size": "20%",
    });
    expect(managerStage).toHaveAttribute("data-promoted", "true");
    expect(inspectorStage).toHaveAttribute("data-promoted", "false");

    await user.click(inspectorStage);

    expect(workbench).toHaveAttribute("data-stage", "inspector");
    expect(workbench).toHaveStyle({
      "--manager-stage-size": "20%",
      "--inspector-stage-size": "80%",
    });
    expect(managerStage).toHaveAttribute("data-promoted", "false");
    expect(inspectorStage).toHaveAttribute("data-promoted", "true");

    await user.click(managerStage);

    expect(workbench).toHaveAttribute("data-stage", "manager");
    expect(managerStage).toHaveAttribute("data-promoted", "true");
    expect(inspectorStage).toHaveAttribute("data-promoted", "false");
  });

  it("lets users drag the workbench divider to custom stage proportions", async () => {
    const user = userEvent.setup();
    render(<App />);
    await enterConsole(user);

    const workbench = screen.getByLabelText("Stage manager workbench");
    vi.spyOn(workbench, "getBoundingClientRect").mockReturnValue({
      bottom: 1000,
      height: 1000,
      left: 0,
      right: 1400,
      top: 0,
      width: 1400,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.pointerDown(screen.getByLabelText("Adjust workbench split"), {
      clientY: 500,
      pointerId: 1,
    });
    fireEvent.pointerMove(window, {
      clientY: 650,
      pointerId: 1,
    });
    fireEvent.pointerUp(window, { pointerId: 1 });

    expect(workbench).toHaveStyle({
      "--manager-stage-size": "65%",
      "--inspector-stage-size": "35%",
    });
  });

  it("lets users build and apply cross-category task presets", async () => {
    const user = userEvent.setup();
    render(<App />);
    await enterConsole(user);

    await user.click(screen.getByRole("button", { name: "预设" }));
    const studio = screen.getByTestId("preset-studio");

    expect(within(studio).getByLabelText("分类文件夹选择")).toBeInTheDocument();
    expect(within(studio).getByText("Folder Picker")).toBeInTheDocument();
    expect(within(studio).getByText("分类文件夹")).toBeInTheDocument();
    expect(within(studio).queryByText("跨分类选择")).not.toBeInTheDocument();
    expect(within(studio).getAllByText("通用场景").length).toBeGreaterThan(0);
    expect(screen.queryByTestId("sidebar-profile-dock")).not.toBeInTheDocument();

    await user.click(within(studio).getByRole("button", { name: "新建预设" }));
    await user.clear(within(studio).getByLabelText("预设名称"));
    await user.type(within(studio).getByLabelText("预设名称"), "论文 + 调试");
    await user.type(within(studio).getByLabelText("预设说明"), "论文写作时顺手带上定位和验证能力");
    await user.selectOptions(within(studio).getByLabelText("应用模式"), "merge");

    await user.click(within(studio).getByRole("button", { name: "打开分类 论文写作" }));
    expect(within(studio).getByText("论文写作 skills")).toBeInTheDocument();
    await user.click(within(studio).getByLabelText("选择 academic-paper-composer"));
    await user.click(within(studio).getByRole("button", { name: "返回分类文件夹" }));

    await user.click(within(studio).getByRole("button", { name: "打开分类 调试测试" }));
    expect(within(studio).getByText("调试测试 skills")).toBeInTheDocument();
    await user.click(within(studio).getByLabelText("选择 systematic-debugging"));

    expect(within(screen.getByTestId("preset-selected-skills")).getByText("academic-paper-composer")).toBeInTheDocument();
    expect(within(screen.getByTestId("preset-selected-skills")).getByText("systematic-debugging")).toBeInTheDocument();
    expect(within(screen.getByTestId("preset-selected-skills")).getByText("test-driven-development")).toBeInTheDocument();
    expect(within(screen.getByLabelText("通用场景继承 skills")).getByText("test-driven-development")).toBeInTheDocument();

    await user.click(within(studio).getByRole("button", { name: "保存预设" }));
    expect(screen.getByText("预设已保存")).toBeInTheDocument();

    await user.click(within(studio).getByRole("button", { name: "应用预设" }));
    expect(within(screen.getByTestId("sidebar-preset-summary")).getByText("论文 + 调试")).toBeInTheDocument();
    expect(within(screen.getByLabelText("已激活到 Codex")).getByText("academic-paper-composer")).toBeInTheDocument();
    expect(within(screen.getByLabelText("已激活到 Codex")).getByText("systematic-debugging")).toBeInTheDocument();
    expect(within(screen.getByLabelText("已激活到 Codex")).getByText("test-driven-development")).toBeInTheDocument();
  });

  it("shows skill health checks and lets users save a skill markdown draft", async () => {
    const user = userEvent.setup();
    render(<App />);
    await enterConsole(user);

    const healthPanel = screen.getByLabelText("健康检查");
    expect(within(healthPanel).getByText("描述完整")).toBeInTheDocument();
    expect(within(healthPanel).getByText("触发词已设置")).toBeInTheDocument();

    await user.click(screen.getByLabelText("Skill inspector stage"));
    await user.click(screen.getByRole("button", { name: "放大 SKILL.md" }));
    const editor = screen.getByLabelText("SKILL.md 预览");
    expect(editor.value).toContain("academic-paper-composer");

    fireEvent.change(editor, {
      target: {
        value: "---\nname: academic-paper-composer\n---\n# Draft",
      },
    });
    await user.click(screen.getByRole("button", { name: "保存草稿" }));

    expect(screen.getByText("草稿已保存")).toBeInTheDocument();
  });

  it("stacks inspector reading panes vertically and resizes only the main reader", async () => {
    const user = userEvent.setup();
    render(<App />);
    await enterConsole(user);

    const reader = screen.getByLabelText("Inspector 阅读窗口");
    await user.click(screen.getByLabelText("Skill inspector stage"));
    expect(reader).toHaveAttribute("data-focus", "description");
    expect(within(reader).getByRole("heading", { name: "描述" })).toBeInTheDocument();
    expect(within(reader).queryByText("点击交换窗口")).not.toBeInTheDocument();
    expect(within(reader).getByRole("button", { name: "放大 SKILL.md" })).toBeInTheDocument();
    expect(screen.getByLabelText("调整阅读窗口大小").parentElement).toHaveClass("reader-stage");

    await user.click(within(reader).getByRole("button", { name: "放大 SKILL.md" }));

    expect(reader).toHaveAttribute("data-focus", "skill");
    expect(within(reader).getByRole("heading", { name: "SKILL.md" })).toBeInTheDocument();
    expect(within(reader).getByRole("button", { name: "放大描述" })).toBeInTheDocument();

    fireEvent.pointerDown(screen.getByLabelText("调整阅读窗口大小"), {
      clientX: 800,
      clientY: 500,
      pointerId: 1,
    });
    fireEvent.pointerMove(window, {
      clientX: 920,
      clientY: 610,
      pointerId: 1,
    });
    fireEvent.pointerUp(window, { pointerId: 1 });

    expect(reader).toHaveStyle({ "--primary-reader-height": "390px" });
    expect(screen.getByText("390px")).toBeInTheDocument();
  });

  it("keeps batch controls behind an explicit batch mode", async () => {
    const user = userEvent.setup();
    render(<App />);
    await enterConsole(user);

    const inactiveZone = screen.getByLabelText("Vault 未激活");
    expect(within(inactiveZone).queryByLabelText("选择 frontend-app-builder")).not.toBeInTheDocument();
    expect(
      within(inactiveZone).queryByRole("button", { name: "启动所选 Vault 未激活" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "开启批量模式" }));

    expect(screen.getByRole("button", { name: "关闭批量模式" })).toHaveAttribute("aria-pressed", "true");
    expect(within(inactiveZone).getByLabelText("选择 frontend-app-builder")).toBeInTheDocument();
    expect(
      within(inactiveZone).getByRole("button", { name: "启动所选 Vault 未激活" }),
    ).toBeInTheDocument();
  });

  it("surfaces floating bulk actions as a primary workflow", async () => {
    const user = userEvent.setup();
    render(<App />);
    await enterConsole(user);

    await user.click(screen.getByRole("button", { name: "开启批量模式" }));
    await user.click(within(screen.getByLabelText("Vault 未激活")).getByLabelText("选择 frontend-app-builder"));

    const bulkBar = screen.getByLabelText("Bulk action bar");
    expect(within(bulkBar).getByText("1 selected")).toBeInTheDocument();

    await user.click(within(bulkBar).getByRole("button", { name: "Activate selected skills" }));

    expect(
      within(screen.getByLabelText("已激活到 Codex")).getByText("frontend-app-builder"),
    ).toBeInTheDocument();
  });

  it("switches the sidebar navigation into real workspaces", async () => {
    const user = userEvent.setup();
    render(<App />);
    await enterConsole(user);

    await user.click(screen.getByRole("button", { name: "预设" }));
    expect(screen.getByRole("heading", { name: "场景预设" })).toBeInTheDocument();
    expect(screen.getByTestId("preset-studio")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "安装源" }));
    expect(screen.getByRole("heading", { name: "安装源" })).toBeInTheDocument();
    expect(screen.getByLabelText("安装源工作区")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "清单" }));
    expect(screen.getByRole("heading", { name: "Skill 清单" })).toBeInTheDocument();
    expect(screen.getByLabelText("清单工作区")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "设置" }));
    expect(screen.getByRole("heading", { name: "控制台设置" })).toBeInTheDocument();
    expect(screen.getByLabelText("设置工作区")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "技能库" }));
    expect(screen.getByRole("heading", { name: "技能库" })).toBeInTheDocument();
    expect(screen.getByLabelText("Skill 列表")).toBeInTheDocument();
  });

  it("lets users browse by visual folders and file a selected skill", async () => {
    const user = userEvent.setup();
    render(<App />);
    await enterConsole(user);

    await user.click(screen.getByRole("button", { name: "论文写作 1" }));
    expect(within(screen.getByLabelText("已激活到 Codex")).getByText("academic-paper-composer")).toBeInTheDocument();

    await user.click(
      within(screen.getByLabelText("已激活到 Codex")).getByText("academic-paper-composer"),
    );
    await user.selectOptions(screen.getByLabelText("归类文件夹"), "frontend");

    expect(screen.getByText("已归类到 前端与界面")).toBeInTheDocument();
  });

  it("lets users move an already categorized skill to another group from its row", async () => {
    const user = userEvent.setup();
    render(<App />);
    await enterConsole(user);

    const moveControl = screen.getByLabelText("Move academic-paper-composer to group");
    expect(moveControl).toHaveValue("writing");

    await user.selectOptions(moveControl, "frontend");

    expect(moveControl).toHaveValue("frontend");
    expect(screen.getAllByText("academic-paper-composer").length).toBeGreaterThan(0);
  });

  it("embeds the downloaded console video as the management background", async () => {
    const user = userEvent.setup();
    render(<App />);
    await enterConsole(user);

    const video = screen.getByTestId("console-background-video");
    expect(video).toHaveAttribute("src", "/media/pexels-circuit-console.mp4");
    expect(video).toHaveAttribute("autoplay");
    expect(video).toHaveAttribute("loop");
  });

  it("batch activates and closes selected skills inside each group", async () => {
    const user = userEvent.setup();
    render(<App />);
    await enterConsole(user);
    await user.click(screen.getByRole("button", { name: "开启批量模式" }));

    const inactiveZone = screen.getByLabelText("Vault 未激活");
    await user.click(within(inactiveZone).getByLabelText("选择 frontend-app-builder"));
    await user.click(
      within(inactiveZone).getByRole("button", { name: "启动所选 Vault 未激活" }),
    );

    expect(
      within(screen.getByLabelText("已激活到 Codex")).getByText("frontend-app-builder"),
    ).toBeInTheDocument();

    const activeZone = screen.getByLabelText("已激活到 Codex");
    await user.click(within(activeZone).getByLabelText("选择 frontend-app-builder"));
    await user.click(
      within(activeZone).getByRole("button", { name: "关闭所选 已激活到 Codex" }),
    );

    expect(
      within(screen.getByLabelText("Vault 未激活")).getByText("frontend-app-builder"),
    ).toBeInTheDocument();
  });

  it("keeps active and inactive groups in independent scroll panes", () => {
    const css = readFileSync(join(process.cwd(), "src", "styles.css"), "utf8");

    expect(css).toContain("scrollbar-gutter: stable");
    expect(css).toContain("max-height: min(30vh, 340px)");
  });

  it("keeps the promoted manager explorer aligned to the stage bottom with internal scroll panes", () => {
    const css = readFileSync(join(process.cwd(), "src", "styles.css"), "utf8");
    const managerExplorerBlock =
      css.match(/\.stage-workbench\[data-stage="manager"\] \.explorer-panel \{[\s\S]*?\n\}/)?.[0] ?? "";
    const managerExplorerSectionsBlock =
      css.match(/\.stage-workbench\[data-stage="manager"\] \.explorer-sections \{[\s\S]*?\n\}/)?.[0] ?? "";
    const managerSkillZoneBlock =
      css.match(/\.stage-workbench\[data-stage="manager"\] \.skill-zone \{[\s\S]*?\n\}/)?.[0] ?? "";
    const managerSkillGridBlock =
      css.match(/\.stage-workbench\[data-stage="manager"\] \.skill-card-grid \{[\s\S]*?\n\}/)?.[0] ?? "";

    expect(managerExplorerBlock).toContain("align-self: stretch");
    expect(managerExplorerBlock).toContain("height: 100%");
    expect(managerExplorerBlock).toContain("max-height: none");
    expect(managerExplorerBlock).toContain("overflow: hidden");
    expect(managerExplorerSectionsBlock).toContain("align-items: stretch");
    expect(managerSkillZoneBlock).toContain("grid-template-rows: auto minmax(0, 1fr)");
    expect(managerSkillZoneBlock).toContain("align-self: stretch");
    expect(managerSkillGridBlock).toContain("max-height: none");
  });

  it("uses compact skill rows so action buttons are not clipped at scaled layouts", () => {
    const css = readFileSync(join(process.cwd(), "src", "styles.css"), "utf8");
    const skillFileBlock = css.match(/\.skill-file \{[\s\S]*?\n\}/)?.[0] ?? "";

    expect(skillFileBlock).toContain("grid-template-columns: minmax(0, 1fr) auto");
    expect(css).toContain(".skill-file.selection-open");
    expect(css).toContain("grid-template-columns: 28px minmax(0, 1fr) auto");
    expect(skillFileBlock).toContain("min-height: 60px");
    expect(skillFileBlock).toContain("overflow: visible");
    expect(css).toContain("place-self: center end");
    expect(skillFileBlock).not.toContain("min-height: 150px");
  });

  it("keeps the mobile top navigation inside the viewport", () => {
    const css = readFileSync(join(process.cwd(), "src", "styles.css"), "utf8");
    const mobileBlock = css.match(/@media \(max-width: 1060px\) \{[\s\S]*?\n\}/)?.[0] ?? "";

    expect(mobileBlock).toContain("grid-template-columns: minmax(0, auto) minmax(0, 1fr)");
    expect(mobileBlock).toContain("max-width: 100vw");
    expect(mobileBlock).toContain("min-width: 0");
    expect(mobileBlock).toContain("overscroll-behavior-x: contain");
  });

  it("keeps the explorer wide while aligning the folder rail with the right workbench column", () => {
    const css = readFileSync(join(process.cwd(), "src", "styles.css"), "utf8");
    const workbenchBlock = css.match(/\.vault-workbench \{[\s\S]*?\n\}/)?.[0] ?? "";
    const mainBlock = css.match(/\.workbench-main \{[\s\S]*?\n\}/)?.[0] ?? "";
    const folderBlock = css.match(/\.folder-panel \{[\s\S]*?\n\}/)?.[0] ?? "";
    const detailBlock =
      [...css.matchAll(/\.vault-detail \{[\s\S]*?\n\}/g)]
        .map((match) => match[0])
        .find((block) => block.includes("grid-template-areas")) ?? "";

    expect(workbenchBlock).toContain("grid-template-columns: minmax(174px, 0.34fr) minmax(0, 2.66fr)");
    expect(workbenchBlock).toContain("grid-template-rows: minmax(0, 1fr)");
    expect(mainBlock).toContain("grid-template-rows: minmax(180px, 1fr) minmax(var(--detail-row-height, 432px), auto)");
    expect(workbenchBlock).not.toContain("minmax(210px");
    expect(folderBlock).not.toContain("grid-row: 1 / span 2");
    expect(detailBlock).toContain("height: 100%");
    expect(detailBlock).toContain("position: relative");
    expect(detailBlock).toContain("min-height: 0");
    expect(detailBlock).toContain("max-height: none");
    expect(css).toContain(".detail-panel.vault-detail {\n  display: grid;");
    expect(css).toContain("grid-auto-rows: minmax(54px, auto)");
    expect(css).toContain("align-self: start;");
    expect(css).toMatch(/@media \(max-width: 1280px\)[\s\S]*?\.workbench-main:not\(\.stage-workbench\) \{/);
  });

  it("styles the workbench as a stage-managed vertical split", () => {
    const css = readFileSync(join(process.cwd(), "src", "styles.css"), "utf8");
    const stageBlock = css.match(/\.stage-workbench \{[\s\S]*?\n\}/)?.[0] ?? "";

    expect(stageBlock).toContain(
      "grid-template-rows: minmax(0, var(--manager-stage-size)) 10px minmax(0, var(--inspector-stage-size))",
    );
    expect(stageBlock).toContain("transition: grid-template-rows 320ms cubic-bezier(0.2, 0.8, 0.2, 1)");
    expect(css).toContain(".stage-region[data-promoted=\"false\"]");
    expect(css).toContain(".stage-divider");
    expect(css).toContain("body[data-workbench-resizing=\"true\"]");
    expect(css).toContain(".workbench-main:not(.stage-workbench)");
  });

  it("styles the inspector reader as vertical main and preview panes", () => {
    const css = readFileSync(join(process.cwd(), "src", "styles.css"), "utf8");
    const readerBlock = css.match(/\.reader-stage \{[\s\S]*?\n\}/)?.[0] ?? "";
    const inspectorReaderBlock = css.match(/\.inspector-reader \{[\s\S]*?\n\}/)?.[0] ?? "";

    expect(inspectorReaderBlock).toContain("z-index: 4");
    expect(css).toContain(".skill-inspector > .inspector-reader");
    expect(readerBlock).toContain("grid-template-columns: minmax(0, 1fr)");
    expect(readerBlock).toContain("position: relative");
    expect(readerBlock).toContain(
      "grid-template-rows: minmax(0, var(--primary-reader-height)) minmax(92px, 104px)",
    );
    expect(readerBlock).toContain("height: calc(var(--primary-reader-height) + 112px)");
    expect(css).not.toContain("grid-template-columns: minmax(0, 1fr) minmax(150px, 0.32fr)");
  });

  it("styles preset studio and bulk actions as fast control surfaces", () => {
    const css = readFileSync(join(process.cwd(), "src", "styles.css"), "utf8");

    expect(css).toContain(".preset-studio");
    expect(css).toContain(".preset-skill-picker");
    expect(css).toContain(".preset-folder-grid");
    expect(css).toContain(".preset-chip.base");
    expect(css).toContain(".sidebar-preset-summary");
    expect(css).toContain(".sidebar-video");
    expect(css).toContain(".bulk-action-bar");
    expect(css).toContain("animation: bulk-rise 180ms ease-out both");
    expect(css).toContain("@keyframes bulk-rise");
  });

  it("filters the visible skill list from the search box", async () => {
    const user = userEvent.setup();
    render(<App />);
    await enterConsole(user);

    await user.type(screen.getByPlaceholderText("搜索 skill、来源或描述"), "paper");

    const list = screen.getByLabelText("Skill 列表");
    expect(within(list).getByText("academic-paper-composer")).toBeInTheDocument();
    expect(within(list).queryByText("frontend-app-builder")).not.toBeInTheDocument();
  });

  it("opens install panel and adds a skill from a GitHub URL", async () => {
    const user = userEvent.setup();
    render(<App />);
    await enterConsole(user);

    await user.click(screen.getByRole("button", { name: "安装 Skill" }));
    await user.type(
      screen.getByLabelText("GitHub URL"),
      "https://github.com/openclaw/skills/tree/main/skills/chndranndr/japanese-tutor",
    );
    await user.click(screen.getByRole("button", { name: "确认安装" }));

    expect(within(screen.getByLabelText("Skill 列表")).getByText("japanese-tutor")).toBeInTheDocument();
    expect(screen.getByText("安装完成")).toBeInTheDocument();
  });

  it("clears stale filters after installing a skill", async () => {
    const user = userEvent.setup();
    render(<App />);
    await enterConsole(user);

    await user.type(screen.getByPlaceholderText("搜索 skill、来源或描述"), "paper");
    await user.click(screen.getByRole("button", { name: "安装 Skill" }));
    await user.type(
      screen.getByLabelText("GitHub URL"),
      "https://github.com/openclaw/skills/tree/main/skills/chndranndr/japanese-tutor",
    );
    await user.click(screen.getByRole("button", { name: "确认安装" }));

    expect(screen.getByPlaceholderText("搜索 skill、来源或描述")).toHaveValue("");
    expect(within(screen.getByLabelText("Skill 列表")).getByText("japanese-tutor")).toBeInTheDocument();
  });
});

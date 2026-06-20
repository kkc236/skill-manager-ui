import {
  ArrowRight,
  CheckCircle2,
  GitBranch,
  RefreshCw,
  Search,
  Sparkle,
} from "lucide-react";
import { useState } from "react";

const guideSteps = [
  { id: "find", number: "01", label: "FIND", title: "扫描本地技能", detail: "快速定位可用、已启用和需要更新的技能。", actionLabel: "Preview find step" },
  { id: "install", number: "02", label: "INSTALL", title: "从 GitHub 安装", detail: "粘贴仓库路径，生成本地技能索引。", actionLabel: "Preview install step" },
  { id: "sync", number: "03", label: "SYNC", title: "同步更新状态", detail: "检查版本、待更新项和最近操作。", actionLabel: "Preview sync step" },
];

const reticleTargetSelector = [
  "button:not(:disabled)", "a[href]", "input:not(:disabled)",
  "textarea:not(:disabled)", "select:not(:disabled)",
  "[role='button']", "[tabindex]:not([tabindex='-1'])",
].join(", ");
const reticleHitSlop = 16;

function findReticleTarget(root, eventTarget, clientX, clientY) {
  const viewportTarget = root.ownerDocument?.elementFromPoint?.(clientX, clientY);
  const viewportClosest = viewportTarget && typeof viewportTarget.closest === "function" ? viewportTarget.closest(reticleTargetSelector) : null;
  if (viewportClosest && root.contains(viewportClosest)) return viewportClosest;
  const targetByPoint = Array.from(root.querySelectorAll(reticleTargetSelector)).find((element) => {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && clientX >= rect.left - reticleHitSlop && clientX <= rect.right + reticleHitSlop && clientY >= rect.top - reticleHitSlop && clientY <= rect.bottom + reticleHitSlop;
  });
  if (targetByPoint) return targetByPoint;
  const closestTarget = typeof eventTarget.closest === "function" ? eventTarget.closest(reticleTargetSelector) : null;
  return closestTarget && root.contains(closestTarget) ? closestTarget : null;
}

export { guideSteps };

export default function GuidePage({ activeStep, activeStepIndex, steps, onSelectStep, onEnter }) {
  const progress = `${((activeStepIndex + 1) / steps.length) * 100}%`;
  const missionCopy = { find: "扫描本地索引", install: "锁定 GitHub 源", sync: "验证更新队列" };

  function handlePointerMove(event) {
    const { currentTarget, clientX, clientY, target } = event;
    const width = currentTarget.clientWidth || 1;
    const height = currentTarget.clientHeight || 1;
    const tiltX = ((clientY / height) - 0.5) * -4;
    const tiltY = ((clientX / width) - 0.5) * 5;
    const selectableTarget = findReticleTarget(currentTarget, target, clientX, clientY);
    currentTarget.style.setProperty("--pointer-x", `${Math.round(clientX)}px`);
    currentTarget.style.setProperty("--pointer-y", `${Math.round(clientY)}px`);
    currentTarget.style.setProperty("--tilt-x", `${tiltX.toFixed(2)}deg`);
    currentTarget.style.setProperty("--tilt-y", `${tiltY.toFixed(2)}deg`);
    currentTarget.dataset.reticleHit = selectableTarget && currentTarget.contains(selectableTarget) ? "true" : "false";
  }

  function handlePointerLeave(event) {
    event.currentTarget.style.setProperty("--pointer-x", "50vw");
    event.currentTarget.style.setProperty("--pointer-y", "50vh");
    event.currentTarget.style.setProperty("--tilt-x", "0deg");
    event.currentTarget.style.setProperty("--tilt-y", "0deg");
    event.currentTarget.dataset.reticleHit = "false";
  }

  return (
    <main className="guide-shell" aria-label="Skill manager guide" onPointerMove={handlePointerMove} onPointerLeave={handlePointerLeave}>
      <video className="guide-video" data-testid="guide-video" src="/media/coding-technology-bg.mp4" poster="/media/coding-technology-poster.jpg" autoPlay muted loop playsInline aria-hidden="true" />
      <div className="guide-scrim" aria-hidden="true" />
      <div className="guide-noise" aria-hidden="true" />
      <div className="guide-depth-field" data-testid="guide-game-layer" aria-hidden="true">
        <span className="guide-node guide-node-a" /><span className="guide-node guide-node-b" /><span className="guide-node guide-node-c" /><span className="guide-node guide-node-d" />
      </div>
      <div className="guide-reticle" data-testid="guide-reticle" aria-hidden="true" />
      <header className="guide-topbar">
        <div className="guide-brand">
          <span className="brand-mark" aria-hidden="true"><Sparkle size={18} /></span>
          <div><strong>Skill Deck</strong><small>本地 Codex</small></div>
        </div>
        <button className="guide-enter guide-enter-top" type="button" onClick={onEnter}>进入管理台 <ArrowRight size={18} /></button>
      </header>
      <section className="guide-layout">
        <div className="guide-hero">
          <h1>技能覆盖</h1>
          <p className="guide-lede">把本地技能变成一个能查、能装、能同步的导引式控制台。</p>
          <div className="guide-progress" aria-hidden="true"><span style={{ width: progress }} /></div>
          <div className="guide-steps" aria-label="Guide steps">
            {steps.map((step) => (
              <button className={activeStep.id === step.id ? "guide-step active" : "guide-step"} key={step.id} type="button" aria-label={step.actionLabel} aria-pressed={activeStep.id === step.id} onClick={() => onSelectStep(step.id)}>
                <span className="guide-step-code">{step.number} {step.label}</span><span>{step.title}</span><ArrowRight size={28} />
              </button>
            ))}
          </div>
        </div>
        <aside className="guide-preview" data-step={activeStep.id} aria-label={`${activeStep.label} preview`}>
          <div className="guide-preview-head"><span>{activeStep.number}</span><strong>{activeStep.label}</strong></div>
          <p>{activeStep.detail}</p>
          <GuidePreviewContent key={activeStep.id} step={activeStep.id} />
        </aside>
      </section>
      <aside className="guide-mission" aria-label="Guide mission panel">
        <span>任务</span><strong>COMBO x{activeStepIndex + 1}</strong><small>{missionCopy[activeStep.id]}</small>
        <div className="guide-mission-track" aria-hidden="true"><i style={{ width: progress }} /></div>
      </aside>
      <div className="guide-command-strip" aria-hidden="true"><span>扫描</span><span>安装</span><span>同步</span><span>本地</span><span>技能</span></div>
    </main>
  );
}

function GuidePreviewContent({ step }) {
  if (step === "install") return (<div className="guide-preview-card"><span className="guide-preview-status">安装就绪</span><label className="guide-preview-field"><span>GitHub 地址</span><input value="github.com/openclaw/skills/nihongy" readOnly /></label><div className="guide-preview-row active"><GitBranch size={18} /><span>nihongy 技能</span><strong>就绪</strong></div></div>);
  if (step === "sync") return (<div className="guide-preview-card"><span className="guide-preview-status">更新队列</span><div className="guide-preview-row active"><RefreshCw size={18} /><span>frontend-app-builder</span><strong>更新</strong></div><div className="guide-preview-row"><CheckCircle2 size={18} /><span>skill-installer</span><strong>已同步</strong></div></div>);
  return (<div className="guide-preview-card"><span className="guide-preview-status">扫描区域</span><label className="guide-preview-field"><span>搜索</span><input value="paper / japanese / frontend" readOnly /></label><div className="guide-preview-row active"><Search size={18} /><span>academic-paper-composer</span><strong>本地</strong></div></div>);
}

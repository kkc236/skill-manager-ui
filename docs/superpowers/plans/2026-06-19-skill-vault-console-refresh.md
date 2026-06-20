# Skill Vault Console Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the skill library from a dense demo-like dashboard into a calmer Vault console with clearer primary actions and stronger interaction feedback.

**Architecture:** Keep the existing React single-page app and local API model. The change is mostly state, JSX layout, and CSS: default browsing becomes lightweight, batch controls become an explicit mode, and selected skill details become an inspector surface.

**Tech Stack:** React, Vite, Testing Library, Vitest, CSS animations, local media assets.

---

### Task 1: Batch Mode Gate

**Files:**
- Modify: `src/App.jsx`
- Test: `src/App.test.jsx`

- [ ] Add a failing test that verifies checkboxes and batch buttons are hidden until the user enables `批量模式`.
- [ ] Add `batchMode` state in `App`, expose a toolbar toggle, and pass `batchMode` into each `SkillSection`.
- [ ] Render select-all and batch buttons only in batch mode.
- [ ] Keep existing batch activate/close behavior after batch mode is enabled.

### Task 2: Calmer Browsing Layout

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/styles.css`
- Test: `src/App.test.jsx`

- [ ] Add tests that assert the page exposes a compact command deck and keeps the explorer/detail sizing breathable.
- [ ] Replace the bulky hero with a slim command deck/status strip.
- [ ] Reduce default row density by hiding descriptions in rows and moving explanatory content to the inspector.

### Task 3: Skill Inspector

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/styles.css`

- [ ] Rename the selected detail region visually to `Skill Inspector`.
- [ ] Emphasize current skill state, category, path, trigger, and actions without showing everything as equal-weight cards.
- [ ] Add selection animation so choosing a skill feels like focusing a file.

### Task 4: Atmosphere And Motion

**Files:**
- Modify: `src/styles.css`

- [ ] Let the background video breathe through the workspace with a softer glass layer.
- [ ] Add subtle scan, pulse, and transfer animations for hover/active states.
- [ ] Verify desktop 90% zoom and one mobile viewport do not clip controls.

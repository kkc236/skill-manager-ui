# Stage Manager Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Skill Deck console around an iOS Stage Manager-inspired vertical workbench, with scene launch, file management, and a usable skill reader/editor as the three core entrances.

**Architecture:** Keep the existing React + Vite app and server APIs. Add stage state in `src/App.jsx`, restructure the existing manager and inspector DOM into promoted/collapsed workbench regions, and use CSS variables/classes in `src/styles.css` for the 80/20 stage proportions, motion, and reader panes.

**Tech Stack:** React, Vite, Vitest, Testing Library, CSS, existing Node server APIs.

---

### Task 1: Cover-First Entry

**Files:**
- Modify: `src/App.test.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Write the failing test**

Add a test that clears local storage, renders the app, expects the guide first, clicks `进入管理台`, then sees the console. Reloading by re-rendering should show the guide again.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- --run src/App.test.jsx`

Expected: failure because `guideOpen` currently depends on persisted completion state.

- [ ] **Step 3: Implement the minimal code**

Change `guideOpen` initialization in `src/App.jsx` from persisted completion to `true`, while keeping the console's `封面` navigation path intact.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- --run src/App.test.jsx`

Expected: all App tests pass.

### Task 2: Stage Manager Workbench State

**Files:**
- Modify: `src/App.test.jsx`
- Modify: `src/App.jsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Write the failing test**

Add a test for the console workbench:

- Default state has `data-stage="manager"`.
- Manager region has `data-promoted="true"`.
- Inspector region has `data-promoted="false"`.
- Clicking the inspector promotes it.
- Clicking the manager promotes it back.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- --run src/App.test.jsx`

Expected: failure because no workbench stage attributes or click promotion exist.

- [ ] **Step 3: Implement state and markup**

In `src/App.jsx`:

- Add `const [workbenchStage, setWorkbenchStage] = useState("manager");`
- Add `const [workbenchSplit, setWorkbenchSplit] = useState(80);`
- Wrap the manager and inspector in a parent with `className="stage-workbench"` and `data-stage={workbenchStage}`.
- Give manager and inspector regions `data-promoted` based on `workbenchStage`.
- Add click handlers that promote the clicked region when it is collapsed.

- [ ] **Step 4: Implement CSS proportions**

In `src/styles.css`:

- Make `.stage-workbench` a vertical grid.
- Use `grid-template-rows: minmax(0, var(--manager-stage-size)) 10px minmax(0, var(--inspector-stage-size));`.
- Default manager stage is 80%, inspector stage is 20%.
- In inspector mode, manager is 20%, inspector is 80%.
- Add transition easing, opacity, scale, depth, and compressed preview styles.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- --run src/App.test.jsx`

Expected: App tests pass.

### Task 3: Draggable Workbench Divider

**Files:**
- Modify: `src/App.test.jsx`
- Modify: `src/App.jsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Write the failing test**

Add a test that pointer-drags `调整工作台比例` and expects the stage split variable to change within a safe range such as `65`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- --run src/App.test.jsx`

Expected: failure because the divider does not exist.

- [ ] **Step 3: Implement drag logic**

Add a divider button between manager and inspector:

- `aria-label="调整工作台比例"`
- `onPointerDown={handleWorkbenchResizeStart}`

Use a ref to store start pointer Y, start split, and container height. On pointer move, clamp split between 20 and 80, update `workbenchSplit`, and set `workbenchStage` based on whether split is above or below 50.

- [ ] **Step 4: Add smooth divider CSS**

Style the divider as a thin stage rail with hover glow. During drag, disable transition and set resize cursor.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- --run src/App.test.jsx`

Expected: App tests pass.

### Task 4: Inspector Vertical Reader Panes

**Files:**
- Modify: `src/App.test.jsx`
- Modify: `src/App.jsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Write the failing test**

Replace the existing horizontal reader test with vertical behavior:

- Reader starts with description as primary.
- Secondary pane is below the primary pane.
- There is no visible `点击交换窗口` text.
- Clicking secondary pane swaps `SKILL.md` into primary.
- Dragging the primary reader resize handle changes only `--primary-reader-height`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- --run src/App.test.jsx`

Expected: failure because the current reader still uses horizontal primary/secondary proportions and the old variable.

- [ ] **Step 3: Implement vertical reader**

Change `.reader-stage` to a vertical grid. Use:

- `.reader-primary` for the large pane.
- `.reader-secondary` for the lower preview pane.
- `--primary-reader-height` for only the large pane.
- Remove visible helper copy.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- --run src/App.test.jsx`

Expected: App tests pass.

### Task 5: Scene, Batch, And File Manager Polish

**Files:**
- Modify: `src/App.test.jsx`
- Modify: `src/App.jsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Write failing interaction tests**

Add tests that:

- Scene launch buttons are visible as the primary command strip.
- Selecting multiple skills shows a floating bulk action bar.
- Changing a skill group still works for already categorized skills.

- [ ] **Step 2: Run the tests to verify they fail where behavior is missing**

Run: `npm test -- --run src/App.test.jsx`

Expected: at least the floating bar or primary command strip assertions fail before polish.

- [ ] **Step 3: Implement focused UI polish**

Reduce duplicated labels, emphasize scene launch, make batch action bar float, and add folder hover/active feedback. Keep existing APIs and data model.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- --run src/App.test.jsx`

Expected: App tests pass.

### Task 6: Full Verification

**Files:**
- No production files unless verification exposes a bug.

- [ ] **Step 1: Run full unit tests**

Run: `npm test -- --run`

Expected: all tests pass.

- [ ] **Step 2: Run production build**

Run: `npm run build`

Expected: Vite build succeeds.

- [ ] **Step 3: Browser QA**

Using the in-app Browser, verify:

- App opens to cover.
- Enter console.
- Default manager stage is 80%.
- Click inspector and it promotes to 80%.
- Click manager and it promotes back.
- Drag divider.
- Swap reader panes vertically.
- Resize the main reader.
- Check Chrome/desktop at 90% zoom for clipping and alignment.
- Confirm no console errors.

- [ ] **Step 4: Fix any QA findings**

If QA finds clipping, stale layout, console errors, or broken interactions, write a failing test when practical, then fix and rerun the relevant verification.

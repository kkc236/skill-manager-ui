# Skill Vault Manager Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the current Skill Deck frontend into a usable local skill manager where the project owns a persistent skill vault and Codex only receives activated skill copies.

**Architecture:** Add a local Node API beside the Vite app. The API stores all managed skills in `skill-vault/skills`, mirrors existing user skills from `$CODEX_HOME/skills`, downloads GitHub skill folders into the vault, activates skills by copying from the vault into `$CODEX_HOME/skills`, and deactivates skills by removing only the Codex copy. React calls this API and keeps the current visual shell while replacing demo-only mutations with real local operations.

**Tech Stack:** React + Vite frontend, Node.js ESM backend using built-in `http`, `fs/promises`, `child_process`, `https`, Vitest for unit tests, Vite proxy for `/api`.

---

## File Structure

- Create `server/skillService.js`: filesystem service for vault paths, skill scanning, metadata parsing, activation/deactivation, GitHub URL parsing, GitHub download/import helpers, manifest output.
- Create `server/index.js`: local JSON API server for `/api/health`, `/api/skills`, `/api/skills/:id/activate`, `/api/skills/:id/deactivate`, `/api/skills/install`, `/api/skills/:id/update`, `/api/manifest`.
- Create `server/skillService.test.js`: Node-environment tests for vault mirroring, activate/deactivate safety, and GitHub URL parsing.
- Create `src/lib/apiClient.js`: browser API wrapper with typed request helpers.
- Modify `src/App.jsx`: load real API data, use activate/deactivate/install/update endpoints, show local API/vault status, keep offline demo fallback only when backend is unreachable.
- Modify `vite.config.js`: proxy `/api` to local server on port `5174`.
- Modify `package.json`: run Vite and the API together via `node scripts/dev.mjs`; add direct `dev:ui`, `dev:api` scripts.
- Create `scripts/dev.mjs`: starts API server and Vite dev server as one local product command.
- Create `README.md`: documents how the vault works, how to run, where skills are stored, and safety rules.

---

### Task 1: Service Tests For Vault Semantics

**Files:**
- Create/Modify: `server/skillService.test.js`
- Later Implement: `server/skillService.js`

- [ ] **Step 1: Write tests for existing Codex skill mirroring**

```js
it("mirrors existing user Codex skills into the project vault", async () => {
  const { codexHome, options, projectRoot } = await makeFixture();
  await writeSkill(path.join(codexHome, "skills", "paper-helper"), "paper-helper");

  const inventory = await listSkills(options);
  const skill = inventory.skills.find((item) => item.name === "paper-helper");

  expect(skill).toMatchObject({
    enabled: true,
    installed: true,
    name: "paper-helper",
    source: "imported",
  });
  expect(await exists(path.join(projectRoot, "skill-vault", "skills", "paper-helper", "SKILL.md"))).toBe(true);
});
```

- [ ] **Step 2: Write tests for activation/deactivation**

```js
it("activates and deactivates a vault skill without deleting the vault copy", async () => {
  const { codexHome, options, projectRoot } = await makeFixture();
  await writeSkill(path.join(projectRoot, "skill-vault", "skills", "japanese-tutor"), "japanese-tutor");

  await activateSkill("japanese-tutor", options);
  expect(await exists(path.join(codexHome, "skills", "japanese-tutor", "SKILL.md"))).toBe(true);

  await deactivateSkill("japanese-tutor", options);
  expect(await exists(path.join(codexHome, "skills", "japanese-tutor", "SKILL.md"))).toBe(false);
  expect(await exists(path.join(projectRoot, "skill-vault", "skills", "japanese-tutor", "SKILL.md"))).toBe(true);
});
```

- [ ] **Step 3: Write tests for GitHub URL parsing**

```js
expect(parseGithubSkillUrl("https://github.com/openclaw/skills/tree/main/skills/chndranndr/japanese-tutor")).toEqual({
  branch: "main",
  owner: "openclaw",
  repo: "skills",
  skillPath: "skills/chndranndr/japanese-tutor",
});
```

- [ ] **Step 4: Run test to verify RED**

Run: `corepack pnpm vitest run server/skillService.test.js`

Expected: FAIL because `server/skillService.js` does not exist yet.

---

### Task 2: Implement Vault Service

**Files:**
- Create: `server/skillService.js`
- Test: `server/skillService.test.js`

- [ ] **Step 1: Implement path helpers**

Create helpers:

```js
export function getServicePaths(options = {}) {
  const projectRoot = path.resolve(options.projectRoot ?? process.cwd());
  const codexHome = path.resolve(options.codexHome ?? process.env.CODEX_HOME ?? path.join(homedir(), ".codex"));
  return {
    codexHome,
    codexSkillsRoot: path.join(codexHome, "skills"),
    statePath: path.join(projectRoot, "skill-vault", "state.json"),
    vaultRoot: path.join(projectRoot, "skill-vault"),
    vaultSkillsRoot: path.join(projectRoot, "skill-vault", "skills"),
  };
}
```

- [ ] **Step 2: Implement safe copy/remove primitives**

Use `fs.cp` to copy folders, `fs.rm` to remove only paths proven to be inside `codexSkillsRoot` or `vaultSkillsRoot`, and reject `.system` for deactivation.

- [ ] **Step 3: Implement metadata parsing**

Parse `SKILL.md` frontmatter keys `name`, `description`, and `version`. Fallbacks: name from directory, description from first non-empty markdown paragraph, version `"local"`.

- [ ] **Step 4: Implement `listSkills`**

Ensure vault folders exist, mirror user Codex skills into vault when missing, scan vault skills, mark `enabled` true when the matching folder exists in `$CODEX_HOME/skills`, and return:

```js
{
  codexHome,
  vaultRoot,
  skills: [
    {
      id,
      name,
      description,
      installed: true,
      enabled,
      source,
      status: "healthy",
      version,
      updatedAt,
      path,
      codexPath,
      vaultPath,
      triggers,
    }
  ],
  activity,
}
```

- [ ] **Step 5: Implement `activateSkill` and `deactivateSkill`**

`activateSkill(id)` copies `skill-vault/skills/<id>` into `$CODEX_HOME/skills/<id>` after removing any previous non-system copy. `deactivateSkill(id)` removes `$CODEX_HOME/skills/<id>` and leaves the vault unchanged.

- [ ] **Step 6: Verify GREEN**

Run: `corepack pnpm vitest run server/skillService.test.js`

Expected: PASS.

---

### Task 3: Implement Local API Server

**Files:**
- Create: `server/index.js`
- Modify/Test: `server/skillService.test.js`

- [ ] **Step 1: Add HTTP JSON helpers**

Implement `sendJson`, `readJson`, and `sendError` using built-in Node `http`.

- [ ] **Step 2: Add endpoints**

Routes:

```txt
GET    /api/health
GET    /api/skills
POST   /api/skills/:id/activate
POST   /api/skills/:id/deactivate
POST   /api/skills/install
POST   /api/skills/:id/update
GET    /api/manifest
```

- [ ] **Step 3: Wire routes to service functions**

Activate/deactivate return the refreshed inventory. Install accepts `{ "url": "https://github.com/..." }`. Manifest returns installed vault inventory and enabled flags.

- [ ] **Step 4: Run a smoke check**

Run:

```powershell
$env:SKILL_MANAGER_PORT='5174'; node server/index.js
```

Expected: logs `Skill Deck API listening on http://127.0.0.1:5174`.

---

### Task 4: GitHub Download Into Vault

**Files:**
- Modify: `server/skillService.js`
- Test: `server/skillService.test.js`

- [ ] **Step 1: Implement `parseGithubSkillUrl`**

Support `https://github.com/<owner>/<repo>/tree/<branch>/<path>` and `https://github.com/<owner>/<repo>`.

- [ ] **Step 2: Implement archive download**

Download from `https://codeload.github.com/<owner>/<repo>/zip/refs/heads/<branch>` to a temp zip file.

- [ ] **Step 3: Implement extraction**

On Windows use PowerShell `Expand-Archive -LiteralPath <zip> -DestinationPath <dir> -Force`. Then copy the requested skill folder into `skill-vault/skills/<skill-name>`.

- [ ] **Step 4: Validate the downloaded skill**

Require `SKILL.md` in the copied folder. If destination exists, fail with a clear `409` unless the API receives `replace: true`.

- [ ] **Step 5: Verify service tests**

Run: `corepack pnpm vitest run server/skillService.test.js`

Expected: PASS.

---

### Task 5: Frontend API Client

**Files:**
- Create: `src/lib/apiClient.js`
- Modify: `src/App.jsx`

- [ ] **Step 1: Add API wrapper**

```js
async function request(path, options) {
  const response = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error ?? `Request failed: ${response.status}`);
  return payload;
}
```

Export `fetchInventory`, `activateVaultSkill`, `deactivateVaultSkill`, `installVaultSkill`, `updateVaultSkill`, and `fetchManifest`.

- [ ] **Step 2: Load real inventory in `App.jsx`**

On mount call `fetchInventory()`. On success replace seed data with API data and set status to `live`. On failure keep seed data and show `离线演示`.

- [ ] **Step 3: Replace demo actions**

When status is `live`:
- 启用 button calls `activateVaultSkill`
- 停用 button calls `deactivateVaultSkill`
- 安装 form calls `installVaultSkill`
- 更新 button calls `updateVaultSkill`
- 导出 calls `fetchManifest`

When status is offline, keep current demo mutations so tests and UI remain usable.

- [ ] **Step 4: Add safe button states**

Disable destructive/real actions while a request is pending and show toast errors from the backend.

- [ ] **Step 5: Verify UI tests**

Run: `corepack pnpm test`

Expected: all tests pass.

---

### Task 6: Product Startup And Proxy

**Files:**
- Create: `scripts/dev.mjs`
- Modify: `package.json`
- Modify: `vite.config.js`
- Create: `README.md`

- [ ] **Step 1: Add Vite proxy**

`vite.config.js` should proxy `/api` to `http://127.0.0.1:5174`.

- [ ] **Step 2: Add dev orchestrator**

`scripts/dev.mjs` spawns:

```txt
node server/index.js
vite --host 127.0.0.1
```

and forwards signals to both child processes.

- [ ] **Step 3: Update scripts**

```json
{
  "dev": "node scripts/dev.mjs",
  "dev:api": "node server/index.js",
  "dev:ui": "vite --host 127.0.0.1",
  "build": "vite build",
  "test": "vitest run"
}
```

- [ ] **Step 4: Write README**

Document:
- `corepack pnpm dev`
- vault path `skill-vault/skills`
- active path `$CODEX_HOME/skills`
- activation/deactivation safety
- GitHub URL format

---

### Task 7: Verification And Browser QA

**Files:**
- No new files unless a verification issue requires a fix.

- [ ] **Step 1: Run unit tests**

Run: `corepack pnpm test`

Expected: all test files pass.

- [ ] **Step 2: Run production build**

Run: `corepack pnpm build`

Expected: Vite build exits with code 0.

- [ ] **Step 3: Start local product**

Run: `corepack pnpm dev -- --port 5173` or start `node server/index.js` plus Vite if the current dev server must be restarted.

Expected: `http://127.0.0.1:5173/` opens with API status `live` when the API is reachable.

- [ ] **Step 4: Browser smoke test**

Verify:
- guide still opens
- entering console loads real skill inventory from the API
- activation/deactivation buttons call the API without deleting vault copies
- install dialog is still reachable
- console has no runtime errors

---

## Self-Review

- Spec coverage: The plan covers ccswitch-style storage, activation, deactivation, download into the project, frontend API integration, startup, and verification.
- Placeholder scan: No `TBD`, `TODO`, or unspecified test step remains.
- Type consistency: Skill inventory fields are shared between service and frontend: `id`, `name`, `description`, `installed`, `enabled`, `source`, `status`, `version`, `updatedAt`, `path`, `vaultPath`, `codexPath`, `triggers`.

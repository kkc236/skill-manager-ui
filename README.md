# Skill Deck

Skill Deck is a local Codex skill manager. The project keeps a persistent vault of skills, and Codex only receives the skills you activate.

## Run

```powershell
corepack pnpm install
corepack pnpm dev -- --port 5173
```

Open `http://127.0.0.1:5173/`.

The dev command starts two local processes:

- React/Vite UI on `127.0.0.1:5173`
- Skill Deck API on `127.0.0.1:5174`

## Storage Model

- Vault: `skill-vault/skills`
- Active Codex skills: `$CODEX_HOME/skills`, or `~/.codex/skills` when `CODEX_HOME` is not set

Existing user skills in `~/.codex/skills` are copied into the project vault during scan. Activating a skill copies it from the vault into Codex. Closing a skill removes only the Codex copy and keeps the vault copy.

System skills under `~/.codex/skills/.system` are not managed or removed.

## GitHub Installs

Use a GitHub tree URL that points at a folder containing `SKILL.md`:

```txt
https://github.com/owner/repo/tree/main/path/to/skill
```

The backend downloads the repository archive, extracts the folder, validates `SKILL.md`, and stores the skill in `skill-vault/skills/<skill-name>`.

## Checks

```powershell
corepack pnpm test
corepack pnpm build
```

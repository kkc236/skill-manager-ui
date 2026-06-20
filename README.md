# Skill Deck

Skill Deck is a local Codex skill manager. The project keeps a persistent vault of skills, and Codex only receives the skills you activate.

## Run

For first-time setup on Windows, run:

```powershell
.\scripts\install-skill-deck.ps1
```

This installs missing `node_modules` with `corepack pnpm install`, creates the Codex skills folder used by the app, and adds a `Skill Deck` shortcut to your desktop. It does not install Codex itself or upload/copy this computer's skills into GitHub.

After that, launch Skill Deck from the desktop shortcut, or run:

```powershell
.\scripts\start-skill-deck.ps1
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

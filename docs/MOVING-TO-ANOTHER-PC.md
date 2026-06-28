# Moving ConnectOEE to Another PC

This guide explains how to continue working on **ConnectOEE** from a different computer. The project lives in git, so moving machines = clone the repo and re-create the local-only bits that are intentionally not committed.

Repository: `https://github.com/KphungFROMM/ConnectOEE.git` (branch `main`)

---

## 1. Prerequisites on the new PC

Install these (versions are guidance; newer is fine):

- **Git** - https://git-scm.com/download/win (includes Git Credential Manager for sign-in)
- **.NET SDK** - .NET 8 (this project targets `net8.0`; the .NET 9 SDK can also build it)
- **Node.js** - v20+ (v24 used on the original machine)
- **A database** - PostgreSQL 16 + TimescaleDB *(planned)*. See section 5 for the no-Docker note.
- Optional: **Cursor** / VS Code for editing.

Quick check after install (PowerShell):

```powershell
git --version
dotnet --version
node --version
npm --version
```

---

## 2. Clone the repository

```powershell
cd "$HOME\Projects"   # or wherever you keep code
git clone https://github.com/KphungFROMM/ConnectOEE.git
cd ConnectOEE
```

On first push/pull, Git Credential Manager opens a browser to sign in to GitHub. After that, credentials are cached.

> Tip: if you prefer SSH, add this machine's SSH public key to your GitHub account, then
> `git remote set-url origin git@github.com:KphungFROMM/ConnectOEE.git`.

---

## 3. Set your git identity (per machine)

The identity is repo-local and not committed, so set it once on each PC:

```powershell
git config user.name "KphungFROMM"
git config user.email "KphungFROMM@users.noreply.github.com"
```

---

## 4. What travels vs. what you re-create

**Travels via git (already in the repo):**

- `AGENTS.md` - project memory / entry point (Cursor auto-loads this)
- `docs/` - full plan, architecture, data model, branding, roadmap
- `.gitignore`

**NOT in the repo (re-created locally, by design):**

- `Logix Simulator/` - test-only PLC simulator; environment-specific, intentionally git-ignored
- Build artifacts: `bin/`, `obj/`, `node_modules/`, `dist/`
- Secrets/local config: `.env`, `appsettings.Development.local.json`
- Local database data (`pgdata/`, `.data/`)

Once application code exists (Phase 0+), restore dependencies on the new PC:

```powershell
# backend (when the .sln exists)
dotnet restore
dotnet build

# frontend (when frontend/ exists)
cd frontend
npm install
cd ..
```

---

## 5. Database note (no Docker)

The plan originally used Docker Compose for PostgreSQL + TimescaleDB, but Docker may not run in some VM environments. On a machine without Docker, install PostgreSQL + TimescaleDB natively:

- PostgreSQL: https://www.postgresql.org/download/windows/
- TimescaleDB (Windows): https://docs.timescale.com/self-hosted/latest/install/installation-windows/
- Then create the database and set the connection string in local config (e.g. `appsettings.Development.local.json` or `.env`).

(If desired, the project can be configured with a SQLite fallback for quick dev without Postgres.)

---

## 6. Daily sync workflow

Pull the latest before you start, push when you finish:

```powershell
# start of session
git pull

# after making changes
git add -A
git commit -m "Describe your change"
git push
```

If you switch PCs mid-task, always `git push` on the old machine and `git pull` on the new one so the docs/memory stay in sync.

---

## 7. Continue the build

Open the repo in Cursor on the new PC. `AGENTS.md` loads automatically and links to all docs. The build sequence (source of truth) is in [14-roadmap-phases.md](14-roadmap-phases.md), starting with Phase 0.

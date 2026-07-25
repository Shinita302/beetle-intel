# Beetles

React + TypeScript app (Vite). **This is not a Python project** — PyCharm’s green Run button on `.py` will not work here.

## 1. Install Node.js (required)

Download and install **Node.js LTS** from https://nodejs.org/

After install, open a **new** terminal and check:

```powershell
node -v
npm -v
```

## 2. Where to run this

Use a terminal in **either** of these folders:

| Folder | When to use |
|--------|-------------|
| `Beetles\project` | Recommended — this is the app (`package.json`, `src/`) |
| `Beetles` (repo root) | Also works — root `package.json` forwards to `project/` |

**First time only** — install dependencies:

```powershell
cd "C:\Users\User\Dropbox\PC\Desktop\Beetles\project"
npm install
```

**Every time you develop** — start the dev server:

```powershell
cd "C:\Users\User\Dropbox\PC\Desktop\Beetles\project"
npm run dev
```

Open the URL shown in the terminal (usually **http://localhost:5173**).

From the repo root instead:

```powershell
cd "C:\Users\User\Dropbox\PC\Desktop\Beetles"
npm run install:app
npm run dev
```

## 3. PyCharm / IDE

- **PyCharm Community** — Python only; use the terminal steps above, or use **VS Code / Cursor / WebStorm** for this app.
- **PyCharm Professional** — open the `Beetles` folder, install Node.js, then use the run configuration **Beetles Dev Server** (npm `dev` in `project/`).

Best practice: in PyCharm, **File → Open** → select `Beetles\project` if you only work on the frontend.

## 4. Production build

```powershell
cd "C:\Users\User\Dropbox\PC\Desktop\Beetles\project"
npm run build
npm run preview
```

Built files go to `project\dist\`.

## Korean UI (branch `i18n-ko`)

English / Korean switcher is developed on branch **`i18n-ko`**. See **[project/docs/I18N_KO.md](project/docs/I18N_KO.md)**. Keep beta users on `main` until you merge.

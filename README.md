# RepoWarp

Travel through the evolution of code.

RepoWarp turns public GitHub repositories into interactive 3D commit histories and historical codebase landscapes. Scrub through time, inspect a commit's files, compare two moments, and export or share exactly what was loaded.

## Highlights

- **History Warp** — commit lanes become a traversable 3D spine with branches, merges, tags, unloaded boundaries, filters, and playback.
- **Codebase Warp** — pause on a commit to reconstruct its tree as a floating directory/file city, color-coded by file type and annotated with changes.
- **Honest data** — only loaded history is shown or exported. Partial history, truncated trees, deferred snapshots, and rate limits are surfaced instead of hidden.
- **Deep links** — preserve view, branch, commit, comparison base, and selected file in the URL.
- **Exports** — download loaded history as JSON or CSV, or render a composed 1600×900 PNG of the active visualization.
- **Demo mode** — explore a curated, fictional repository without making GitHub requests.
- **Polished UI** — dark and light themes, reduced-motion support, keyboard shortcuts, responsive layout, WebGL fallback, and accessible dialogs.

## Quick start

Requirements: Node.js 22+ and npm.

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

No environment variables, tokens, backend, or database are required.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server. |
| `npm run build` | Type-check and create a production build in `dist/`. |
| `npm run preview` | Serve the production build locally. |
| `npm test` | Run the Vitest suite once. |
| `npm run test:watch` | Run tests in watch mode. |
| `npm run typecheck` | Run TypeScript without emitting files. |
| `npm run lint` | Run ESLint across the project. |

Verified on Node `22.22.1`: 5 test files / 39 tests pass, and typecheck, lint, and production build pass.

## Routes

| Route | Description |
| --- | --- |
| `/` | Landing page with live 3D preview. |
| `/workspace` | Repository input and recents. |
| `/r/:owner/:repo` | Repository workspace. |
| `/r/demo/atlas-lens?demo=1` | Curated demo repository. |
| `*` | Not-found page. |

### URL state

```text
/r/:owner/:repo
  ?view=history|codebase
  &commit=<sha>
  &branch=<ref>
  &base=<sha>
  &file=<path>
  &demo=1
```

- `view` defaults to `history`; unknown views fall back safely.
- `branch` preserves names containing `/` and `.`.
- `file` is preserved across view/commit/branch changes and included in copied share links.
- Comparison state is represented by `base` + `commit`.
- Demo mode is explicit via `demo=1` and never becomes a live repository or a recent entry.

### Scene controls

- Drag to orbit, right-drag or shift-drag to pan, and scroll or pinch to zoom.
- Use the on-screen pan pad or `Shift` + arrow keys to move the camera sideways, vertically, and diagonally.
- Use the reset, fit, and focus buttons in the lower-left scene HUD.
- Press `O` or use the orbit button to toggle a slow cinematic orbit when reduced motion is off.

## GitHub behavior

RepoWarp uses the **anonymous public GitHub REST API**. It does not ask for a token or access private repositories.

- The anonymous limit is typically 60 requests/hour per IP. Rate-limit headers are surfaced in the UI, and blocked requests wait for the reset when known.
- The active branch loads 50 commits per page. Use **Load more** to extend the loaded window.
- The graph only contains loaded commits. Boundary markers indicate missing parents instead of inventing history.
- Commit details and changed files are fetched for the selected revision.
- Small repositories load a recursive tree. Large or truncated trees load the root only and fetch directories on demand.
- Snapshot reconstruction is deferred during playback to keep scrubbing responsive. Pause playback to load the selected tree.
- RepoWarp fetches tree metadata and commit/diff metadata, not full file contents.
- Network failures, rate limits, empty repositories, missing refs, and malformed responses have explicit UI states.

Live verification can be blocked by an exhausted anonymous limit. Demo mode and mocked tests remain available.

## Demo mode

The demo repository is `demo/atlas-lens`, a fictional spatial-observability studio defined in `src/fixtures/demo/atlas.ts`.

- Includes branches, merges, tags, changed files, and historical snapshots.
- Never appears as a real GitHub repository, never enters recents, and never claims live data.
- All GitHub links are suppressed or labeled as fixture data.

## Architecture

```text
src/
  app/          App shell, routing, error boundary
  components/   Landing, layout, UI primitives, workspace panels
  features/     Graph/codebase layouts, exports, loaders
  fixtures/     Curated demo data
  hooks/        Routing, bootstrap, playback, snapshots, details
  pages/        Landing, workspace, repository, not-found
  services/     GitHub API/client, parsing, caching, scheduling, storage
  store/        Zustand repositories, preferences, playback, scene bus, toasts
  styles/       Tailwind layers, tokens, scene palettes
  three/        History/codebase scenes, camera, labels, capture, WebGL
  types/        Domain and GitHub response types
  utils/        URL state, formatting, CSV, clipboard, downloads, HTML escaping
```

Key decisions:

- **URL is the source of truth** for view, reference, commit, comparison, and file. Store-to-URL syncing is explicit to avoid update loops.
- **Loaded data is the only data** rendered and exported. Completeness is carried into export metadata.
- **Snapshot trees are metadata**, so Codebase Warp stays fast and avoids downloading repository contents.
- **3D labels use CSS2DRenderer** through a small custom component rather than nested React roots inside the canvas.
- **Scene labels are clamped** to the stage so selected/hover labels stay readable near edges.
- **Instanced colors** drive commit/file category colors without per-object materials.
- **WebGL fallback** keeps the workspace usable when 3D is unavailable.

## Testing

Tests cover URL parsing/building, graph layout, codebase layout, export builders, and GitHub snapshot/directory loading.

```bash
npm test
```

Browser QA was performed with headless Chrome/CDP at desktop and mobile sizes, in both themes, including:

- history/codebase switching and scene labels
- help, filters, comparison, export/share
- playback and branch switching
- deep links with a selected file
- production preview and SPA deep-link fallback
- console errors and React unmount exceptions

The only remaining console warning is an upstream React Three Fiber/Three.js deprecation: `THREE.Clock` suggests `THREE.Timer`. It is harmless and does not affect behavior.

## Deployment

The app is a static SPA. `vercel.json` configures:

- Vite framework/build/output
- SPA rewrites to `index.html`
- immutable caching for `/assets/*`
- basic security headers

Any static host with SPA fallback works:

```bash
npm run build
# serve dist/ and rewrite unknown routes to /index.html
```

## Known limitations

- Anonymous GitHub rate limits apply; there is no auth or private-repository support.
- History is limited to pages explicitly loaded in the session.
- Large/truncated trees are partially loaded until directories are expanded.
- File contents are not fetched; the app visualizes tree and diff metadata.
- WebGL is required for 3D scenes; a fallback is shown when unavailable.
- The development console may show the upstream `THREE.Clock` deprecation warning.
- `jsdom@30` prefers Node `^22.22.2`; tests also pass on `22.22.1` with a version warning.

## License

No license file is included. Add one before distributing the project publicly.

# Releasing

New versions go to npm from GitHub – no terminal, no npm token.

1. **Actions → Release to npm → Run workflow**
2. Branch `main`, choose the bump:
   - `patch` – bug fixes (0.1.0 → 0.1.1)
   - `minor` – new features (0.1.1 → 0.2.0)
   - `major` – breaking changes (0.2.0 → 1.0.0)
3. **Run workflow.** (If the `production` environment requires approval, approve the run.)

The workflow (`.github/workflows/publish.yml`) runs the tests, bumps the version,
publishes to npm with provenance, then pushes the commit + tag `vX.Y.Z` and creates
a GitHub release with generated notes. If anything fails before publishing, nothing
is changed.

## One-time setup

1. First version was published manually: `npm publish --provenance=false`
   (Trusted Publishing can only be configured for a package that exists).
2. npmjs.com → `@awwwesome-cz/og-cards` → Settings → **Trusted Publisher** → GitHub Actions:
   organization `awwwesome-cz`, repository `og-cards`, workflow `publish.yml`
   (environment `production`, or leave it empty).
3. npmjs.com, same page → Publishing access → **Require two-factor authentication and disallow tokens**.
4. GitHub → Settings → Environments → **production** (created by the first run, or create it):
   optionally add *Required reviewers* (approve before each release) and limit
   *Deployment branches* to `main`.
5. If `main` is protected against direct pushes, allow GitHub Actions to bypass the rule
   (the release pushes the version commit and tag).

# Releasing

Releases are published to npm automatically by `.github/workflows/publish.yml`
when a GitHub release is published. No npm token is used – npm trusts this
repository's workflow (Trusted Publishing, OIDC) and adds provenance.

## New version

```bash
npm version patch            # or minor / major – bumps package.json, commits, tags vX.Y.Z
git push --follow-tags
```

Then on GitHub: **Releases → Draft a new release → choose the tag `vX.Y.Z` →
Generate release notes → Publish release**. The workflow runs the tests and publishes.
The release tag must equal the version in `package.json`, otherwise the workflow stops.

## One-time setup (already done once)

1. First version published manually: `npm publish --provenance=false`
   (Trusted Publishing can only be configured for a package that exists).
2. npmjs.com → `@awwwesome-cz/og-cards` → Settings → **Trusted Publisher** → GitHub Actions:
   organization `awwwesome-cz`, repository `og-cards`, workflow `publish.yml`.
3. Same page → Publishing access → **Require two-factor authentication and disallow tokens**.

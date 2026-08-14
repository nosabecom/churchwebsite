# Newsletter migration

This deterministic migration inventories the Git-backed newsletters from both sites, converts
Markdown directly to Portable Text, resolves local cover assets, and produces reviewable JSON
snapshots and a validation report. Generated files default to `tmp/newsletter-migration/` at the
repository root. Validation derives its expected per-site counts and source keys from the current
source directories, so adding an edition does not require updating a hard-coded count.

Install the workspace dependencies, then inspect and test the migration:

```sh
pnpm install --frozen-lockfile
pnpm --filter @churchwebsite/newsletter-migration test
pnpm --filter @churchwebsite/newsletter-migration extract
pnpm --filter @churchwebsite/newsletter-migration verify:build
```

The token-based import command accepts only `dev`, `development`, `review`, `staging`, or `test`
dataset names (optionally followed by a hyphenated suffix), rejects any production segment, and
requires the exact dataset name to be repeated as confirmation:

```sh
SANITY_STUDIO_PROJECT_ID=... \
SANITY_STUDIO_DATASET=newsletter-review \
SANITY_AUTH_TOKEN=... \
pnpm --filter @churchwebsite/newsletter-migration import:review -- \
  --confirm-review-dataset newsletter-review
```

It uploads assets by SHA-1, finds documents by `migrationMetadata.sourceKey`, lets Sanity generate IDs
for new records, and updates the matching published or draft document on reruns. Run extraction and
review `reports/validation.json` before authorizing an import. The import is deliberately serial and
waits for each small write to become queryable so its post-import checks are reliable. New records are
created with their complete content at deferred visibility before the final published/draft transaction;
an incomplete placeholder document is never published. No import is part of CI.

For an authenticated local development import, use the Sanity CLI user token without copying it into
an environment variable:

```sh
SANITY_STUDIO_PROJECT_ID=... \
SANITY_STUDIO_DATASET=development \
pnpm --filter @churchwebsite/studio exec sanity exec \
  migrations/newsletters/scripts/import-local.mjs --with-user-token -- \
  --confirm-review-dataset development
```

Rerun the same command and verify that document and asset counts remain stable before enabling the
frontend flag against the development dataset.

After building both frontends, `verify:build` derives the expected routes from the source inventory and
checks every archive/detail route for its title, excerpt, Portable Text/Markdown body blocks, related
link, and cover-image source. CI runs this against the default Markdown build; run it again after a
Sanity-backed development build to exercise both render paths.

# Newsletter migration

This deterministic migration reads the four Git-backed newsletters from each site, converts Markdown
directly to Portable Text, resolves local cover assets, and produces reviewable JSON snapshots and a
validation report. Generated files default to `tmp/newsletter-migration/` at the repository root.
The expected inventory is eight documents (four `churchMain`, four `womanExcel`) and four cover assets.

Install the workspace dependencies, then inspect and test the migration:

```sh
pnpm install --frozen-lockfile
pnpm --filter @churchwebsite/newsletter-migration test
pnpm --filter @churchwebsite/newsletter-migration extract
```

The import command refuses production-like datasets and requires an exact review dataset confirmation:

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
waits for each small write to become queryable so its post-import checks are reliable; no import is
part of CI.

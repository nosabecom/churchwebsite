# Media migration inventory

This directory is the repeatable source inventory for RCC-53 and the input contract for RCC-33 and RCC-50.

Run the audit from the repository root:

```sh
pnpm audit:media
```

The command scans both Astro apps, the Studio, and the shared UI package. It computes file sizes, image dimensions, SHA-256 hashes, and exact duplicates, then combines those facts with the reviewed classification and disposition in `inventory.config.json`.

Generated, reviewable outputs are committed under `reports/`:

- `media-manifest.csv` contains one row per in-scope media file.
- `media-summary.md` contains counts, known blind spots, migration rules, and the current action list.

The audit intentionally fails when it finds an unclassified media file or a stale configured path. Add an explicit record with ownership, accessibility, approval, original-file status, and disposition before accepting a new asset.

No command in this directory uploads to Sanity or publishes to YouTube. Those writes belong to the downstream migration issues after the inventory is reviewed and the target dataset is confirmed.

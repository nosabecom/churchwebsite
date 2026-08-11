# RCCG Cornerstone Sanity Studio

This standalone Studio is the shared editorial workspace for Church Main and Woman Excel.
It connects to Sanity project `qd5xjyx2` and the `production` dataset.

Run it from the repository root:

```sh
pnpm dev:studio
```

Build, extract the schema, or regenerate frontend types with:

```sh
pnpm build:studio
pnpm schema:extract
pnpm typegen
```

See [`../../docs/sanity-foundation.md`](../../docs/sanity-foundation.md) for authentication,
SSH tunnelling, CORS, deployment, system ownership, and rollback instructions.

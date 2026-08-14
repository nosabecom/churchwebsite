# Sanity foundation

## Current scope

The Studio is a standalone workspace in `apps/studio`. Church Main and Woman Excel have site-scoped
newsletter schemas, typed queries, and build-time read clients. The newsletter integration remains
behind `PUBLIC_SANITY_NEWSLETTERS_ENABLED`; existing Git-backed content stays in place as a temporary
explicit rollback source until the production import and render-parity checks pass.

The Sanity connection is supplied at build time:

- Church Main: `PUBLIC_SANITY_PROJECT_ID` and `PUBLIC_SANITY_DATASET`
- Woman Excel: `PUBLIC_SANITY_PROJECT_ID` and `PUBLIC_SANITY_DATASET`
- Newsletter cutover per app: `PUBLIC_SANITY_NEWSLETTERS_ENABLED=true`
- Private production read access: server-only `SANITY_API_READ_TOKEN`
- Studio: `SANITY_STUDIO_PROJECT_ID` and `SANITY_STUDIO_DATASET`
- API mode: anonymous reads in public development; authenticated read-only builds in private production

## Environment variables

Copy the `.env.example` files in `apps/churchmain`, `apps/womanexcel`, and `apps/studio` to matching
`.env.local` files, then replace the placeholders. No project ID, dataset name, or token is checked
into Git. Never put a Sanity token in a `PUBLIC_` or `SANITY_STUDIO_` variable.

The private production dataset requires `SANITY_API_READ_TOKEN`. Create a Viewer/read-only token in
Sanity Manage and store it only in the server-side environment for each Vercel project. Keep it out
of browser code, logs, generated static assets, and every `PUBLIC_` or `SANITY_STUDIO_` variable.

## Dataset strategy

| Dataset          | Purpose                                                          | Frontend flag                              |
| ---------------- | ---------------------------------------------------------------- | ------------------------------------------ |
| `production`     | Private approved content used by authenticated production builds | Enable only after migration sign-off       |
| `development`    | Shared integration testing for Studio, migrations, and Astro     | May be enabled explicitly in local/dev env |
| `review-<issue>` | Optional short-lived rehearsal for a risky migration             | Enable only in that issue's preview env    |

The shared `development` dataset is public so local static frontends can use anonymous reads and a
server-side mutation listener can reload connected Astro browsers after published newsletter changes.
Do not put private, member, subscriber, or unapproved sensitive data in it. Prefer a
temporary `review-<issue>` dataset when a migration needs destructive rehearsal or isolation from
other development work, and remove that dataset only after its review evidence is captured.

## Install and authenticate

Install workspace dependencies from the repository root:

```sh
pnpm install --frozen-lockfile
```

Studio development and builds do not use a checked-in token. A developer who needs to edit content
or deploy the Studio authenticates interactively:

```sh
pnpm --filter @churchwebsite/studio exec sanity login
```

## Remote development over SSH

On the development server, start Studio on the loopback interface:

```sh
pnpm dev:studio
```

On the developer's computer, forward local port 3333 to the server:

```sh
ssh -N -L 3333:127.0.0.1:3333 <ssh-host>
```

Then open `http://localhost:3333`. Keeping Studio bound to loopback prevents the development server
from being exposed directly to the internet.

## CORS

`http://localhost:3333` is the required authenticated development origin. List configured origins
with:

```sh
pnpm --filter @churchwebsite/studio exec sanity cors list
```

Add only an origin controlled by the church, and enable credentials only for Studio or authenticated
preview use:

```sh
pnpm --filter @churchwebsite/studio exec sanity cors add https://<trusted-origin> --credentials
```

Public static builds that query Sanity from the build server do not need an authenticated browser
origin.

## Deployment environment

GitHub Actions reads `SANITY_PROJECT_ID` and `SANITY_DATASET` from repository variables and maps them
to the frontend and Studio variable names. Church Main and Woman Excel production environments
must define both `PUBLIC_SANITY_` connection variables, enable the newsletter flag, and provide a
server-only `SANITY_API_READ_TOKEN`. A build with the newsletter flag disabled intentionally uses the
Git rollback source without contacting Sanity. Once enabled, a build fails if its connection is
missing or rejected in any environment, preventing an empty or stale fallback deployment.

## Development, TypeGen, and builds

```sh
pnpm dev:studio
pnpm schema:extract
pnpm typegen
pnpm typegen:check
pnpm build:studio
pnpm build:churchmain
pnpm build:womanexcel
pnpm build
```

`pnpm typegen` extracts the Studio schema, scans named GROQ queries in both applications, and writes
the same complete generated contract to `apps/churchmain/src/sanity.types.ts` and
`apps/womanexcel/src/sanity.types.ts`. Commit both files whenever either schema or query changes. The
intermediate `apps/studio/schema.json` file is intentionally ignored.

## Newsletter migration and cutover

The deterministic tooling in `apps/studio/migrations/newsletters/` inventories the committed sources,
derives expected counts from those directories, converts Markdown directly to Portable Text, resolves
local cover assets, and validates site/slug uniqueness, dates, links, SEO, assets, keys, and source
metadata. Its import command accepts only an explicitly confirmed dev/development/review/staging/test
dataset and rejects production names or segments.

Use this sequence:

1. Run `pnpm --filter @churchwebsite/newsletter-migration test` and `validate`.
2. Extract review artifacts and inspect the validation report, especially its editorial warnings.
3. Import into a review dataset using the guarded command documented beside the migration.
4. Rerun the import and confirm it updates the same eight source keys without duplicate documents or assets.
5. Compare representative image, no-image, related-link, date, SEO, and Portable Text routes for both sites.
6. Point a review deployment at that dataset and enable `PUBLIC_SANITY_NEWSLETTERS_ENABLED=true`.
7. After approval and a dataset export, use the triple-guarded production procedure in the migration
   README, rerun its count checks, then enable the flag per site.

Use a reusable public `development` dataset for Sanity-backed local/static-build testing. Keep
production deployment variables pointed at `production`; developers opt into `development` explicitly:

```sh
SANITY_STUDIO_PROJECT_ID=<project-id> \
SANITY_STUDIO_DATASET=development \
pnpm --filter @churchwebsite/studio exec sanity exec \
  migrations/newsletters/scripts/import-local.mjs --with-user-token -- \
  --confirm-review-dataset development

PUBLIC_SANITY_PROJECT_ID=<project-id> \
PUBLIC_SANITY_DATASET=development \
PUBLIC_SANITY_NEWSLETTERS_ENABLED=true \
pnpm build:churchmain
```

Run the equivalent Woman Excel build after the import. The same variables with `pnpm dev:churchmain`
or `pnpm dev:womanexcel` also start a site-scoped Sanity listener. A published mutation in
`development` sends Vite a debounced full-reload message, and development requests bypass the
build-wide promise cache so the refreshed page fetches current content. The listener is disabled for
other datasets and when the newsletter flag is off.

This keeps development content and destructive migration exercises isolated from production. The
production path uses the same queries with a Viewer token supplied only during the static Vercel build.

When the flag is off, no Sanity newsletter request is made. When it is on, a successful Sanity result
is authoritative—even an empty result—so an intentionally unpublished issue cannot reappear from
Markdown. Missing configuration and failed requests stop enabled development, preview, and production
builds. Set the flag to `false` only as an explicit, separately deployed rollback.

Publishing, unpublishing, or republishing a newsletter triggers only its owning site's deployment
through the repository-managed Sanity Function described in
[`newsletter-deployments.md`](./newsletter-deployments.md). The function keeps Vercel hook URLs in its
server-side environment, coalesces rapid events per site, and retries observable failures.

## Deployment

Build before deploying:

```sh
pnpm typegen:check
pnpm build
pnpm deploy:studio
```

The first Studio deployment may ask for a Sanity-hosted hostname. Record the chosen hostname in the
deployment environment and add only its trusted origin to CORS. Deployment requires an authenticated
Sanity account; normal site builds do not.

## Source-of-truth boundaries

| System      | Owns                                                                                                                                       | Must not own                                                              |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| Sanity      | Public website copy, newsletter issues, editorial images, website event presentation, ministries, departments, conference content, and SEO | Member records, subscriber consent, attendance, or production video files |
| Breeze ChMS | People, families, subscriber consent, Do Not Email status, tags, attendance, and operational event scheduling                              | Website presentation or editorial media                                   |
| YouTube     | Production video hosting and playback                                                                                                      | Canonical website copy or member data                                     |
| Git assets  | Existing static content and rollback assets until each migration is verified                                                               | Newly migrated editorial content after an approved cutover                |
| Astro       | Public rendering, static builds, and the temporary explicit rollback path                                                                  | Editorial source data or subscriber records                               |

Member and subscriber records must never be copied into Sanity. Store YouTube identifiers or URLs in
Sanity instead of uploading production video to ordinary Sanity file assets.

## Rollback

The newsletter cutover is reversible while the fallback remains. If it causes a deployment problem:

1. Redeploy the last known-good commit or revert the foundation commit.
2. Set `PUBLIC_SANITY_NEWSLETTERS_ENABLED=false` for the affected application and redeploy to restore the Git-backed routes and assets.
3. Remove any newly added CORS origin that is no longer required.
4. Revoke any developer or deployment credential that may have been exposed.
5. Leave the configured dataset intact; rollback must not delete shared content or assets.

After rollback, run all four builds again before attempting a corrected deployment.

Delete the Markdown sources and the rollback flag only after both production datasets have passed the
count, route, image, link, SEO, empty-state, publish, unpublish, and republish checks. That final removal
is deliberately gated on production evidence rather than inferred from a preview build.

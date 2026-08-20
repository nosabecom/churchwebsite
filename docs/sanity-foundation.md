# Sanity foundation

## Current scope

The Studio is a standalone workspace in `apps/studio`. Church Main and Woman Excel have site-scoped
newsletter schemas, typed queries, and build-time read clients. Sanity is the only newsletter source;
the former Git-backed Markdown collections have been retired.

The Sanity connection is supplied at build time:

- Church Main: `PUBLIC_SANITY_PROJECT_ID` and `PUBLIC_SANITY_DATASET`
- Woman Excel: `PUBLIC_SANITY_PROJECT_ID` and `PUBLIC_SANITY_DATASET`
- Private production read access: server-only `SANITY_API_READ_TOKEN`
- Studio: `SANITY_STUDIO_PROJECT_ID` and `SANITY_STUDIO_DATASET`
- API mode: anonymous reads in public development; authenticated read-only builds in private production

## Environment variables

Copy the root `.env.example` to `.env.development` at the repository root, then replace the
placeholders. Both Astro development servers use that root as their Vite environment directory, and
the Studio, TypeGen, Blueprint, hook-configuration, and deployment-watcher commands load the same file.
No project ID, dataset name, or token is checked into Git. Never put a Sanity token in a `PUBLIC_` or
`SANITY_STUDIO_` variable.

```powershell
Copy-Item .env.example .env.development
```

The shared file is development-only. Production and preview deployments continue to receive their
own environment variables from Vercel or CI; do not commit `.env.production`.

The private production dataset requires `SANITY_API_READ_TOKEN`. Create a Viewer/read-only token in
Sanity Manage and store it only in the server-side environment for each Vercel project. Keep it out
of browser code, logs, generated static assets, and every `PUBLIC_` or `SANITY_STUDIO_` variable.

## Dataset strategy

| Dataset          | Purpose                                                          |
| ---------------- | ---------------------------------------------------------------- |
| `production`     | Private approved content used by authenticated production builds |
| `development`    | Shared integration testing for Studio and Astro                  |
| `review-<issue>` | Optional short-lived rehearsal for risky content-model changes   |

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

GitHub Actions reads `SANITY_PROJECT_ID` from a repository variable and builds against the public
`development` dataset so pull requests never require a production secret. Church Main and Woman Excel
production environments must define both `PUBLIC_SANITY_` connection variables and provide a
server-only `SANITY_API_READ_TOKEN`. Every build fails if its Sanity connection is missing or rejected.

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

## Newsletter publishing

Use the public `development` dataset for local integration testing and keep production deployments
pointed at the private `production` dataset. Running `pnpm dev:churchmain` or
`pnpm dev:womanexcel` against `development` starts a site-scoped Sanity listener. A published mutation
sends Vite a debounced full reload, and development requests bypass the build-wide promise cache so
the refreshed page fetches current content.

Sanity results are authoritative, including an empty result. Missing configuration and failed requests
stop development, preview, and production builds rather than publishing stale content. Production uses
the same queries with a Viewer token supplied only during the static Vercel build.

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
| Git assets  | Static design assets                                                                                                                       | Newsletter editorial content                                              |
| Astro       | Public rendering and static builds                                                                                                         | Editorial source data or subscriber records                               |

Member and subscriber records must never be copied into Sanity. Store YouTube identifiers or URLs in
Sanity instead of uploading production video to ordinary Sanity file assets.

## Rollback

If the newsletter integration causes a deployment problem:

1. Redeploy the last known-good commit or revert the faulty code change.
2. Remove any newly added CORS origin that is no longer required.
3. Revoke any developer or deployment credential that may have been exposed.
4. Leave the configured dataset intact; rollback must not delete shared content or assets.

After rollback, run all four builds again before attempting a corrected deployment.

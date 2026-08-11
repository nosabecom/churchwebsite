# Sanity foundation

## Current scope

The Studio is a standalone workspace in `apps/studio`. Church Main has a configured read client,
but no production route fetches Sanity content yet. Woman Excel remains disconnected until its own
migration issue is implemented.

The verified Sanity connection is:

- Project ID: `qd5xjyx2`
- Dataset: `production`
- API mode: public, read-only queries with no token

## Environment variables

Copy `apps/churchmain/.env.example` to `apps/churchmain/.env.local` only when overriding the checked-in
defaults. The project ID and dataset name are public identifiers. Never put a Sanity token in a
`PUBLIC_` variable or commit one to Git.

If a future private dataset requires a token, use a server-only variable such as
`SANITY_API_READ_TOKEN` and keep it out of browser code, logs, and generated static assets.

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

`pnpm typegen` extracts the Studio schema, scans named GROQ queries in Church Main, and writes
`apps/churchmain/src/sanity.types.ts`. Commit that generated TypeScript file whenever it changes.
The intermediate `apps/studio/schema.json` file is intentionally ignored.

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
| Astro       | Public rendering, static builds, and fallback behavior                                                                                     | Editorial source data or subscriber records                               |

Member and subscriber records must never be copied into Sanity. Store YouTube identifiers or URLs in
Sanity instead of uploading production video to ordinary Sanity file assets.

## Rollback

This foundation does not replace any live content source. If it causes a deployment problem:

1. Redeploy the last known-good commit or revert the foundation commit.
2. Keep the existing Git-backed routes and assets active; there is no Sanity content cutover to undo.
3. Remove any newly added CORS origin that is no longer required.
4. Revoke any developer or deployment credential that may have been exposed.
5. Leave the `production` dataset intact; rollback must not delete shared content or assets.

After rollback, run all four builds again before attempting a corrected deployment.

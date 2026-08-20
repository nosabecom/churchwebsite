# RCCG Cornerstone Assembly websites

This repository is a pnpm workspace containing multiple Astro websites for RCCG Cornerstone Assembly.

## Project Overview

- `apps/churchmain` is the main RCCG Cornerstone Assembly site.
- `apps/womanexcel` is the Woman Excel site.
- `apps/studio` is the standalone Sanity Studio shared by both sites.
- `packages/ui` contains the UI components shared by both sites.
- Shared dependency versions are managed from the root `pnpm-workspace.yaml` catalog.
- Each app is an Astro project using Tailwind CSS through `@tailwindcss/vite`.
- Static public assets live in each app's `public/` directory.
- Astro-imported assets live in each app's `src/assets/` directory.

## Requirements

- Node.js `>=22.13.0`
- pnpm `11.9.0` or compatible with the lockfile

If pnpm is not already installed, use Corepack:

```sh
corepack enable
corepack prepare pnpm@11.9.0 --activate
```

## Getting Started

Install dependencies from the repository root:

```sh
pnpm install
```

Create one development environment file at the repository root. Church Main, Woman Excel, and the
Studio all read this file when their development servers start:

```powershell
Copy-Item .env.example .env.development
```

Fill in `.env.development` once, then start any app normally. Production builds continue to use
environment variables configured by their deployment platform rather than this development file.

Run one app locally:

```sh
pnpm dev:churchmain
pnpm dev:womanexcel
pnpm dev:studio
```

Short aliases are also available:

```sh
pnpm d/c
pnpm d/w
pnpm d/s
```

## Building

Build everything:

```sh
pnpm build
```

Build one app:

```sh
pnpm build:churchmain
pnpm build:womanexcel
pnpm build:studio
```

Short aliases are also available:

```sh
pnpm b
pnpm b/c
pnpm b/w
pnpm b/s
```

## Sanity content

Church Main and Woman Excel share a Sanity Studio. Newsletter routes can read site-scoped Sanity
content when `PUBLIC_SANITY_NEWSLETTERS_ENABLED=true` is set for that application. Enabled builds fail
closed if Sanity is missing or unavailable; committed Markdown is used only when the flag is deliberately
disabled for rollback. Run `pnpm typegen` whenever the Studio schema or a typed GROQ query changes.

See [`docs/sanity-foundation.md`](docs/sanity-foundation.md) for environment variables,
authentication, SSH tunnelling, CORS, architecture, and rollback instructions. See
[`docs/newsletter-deployments.md`](docs/newsletter-deployments.md) for the site-routed Sanity Function,
Vercel hooks, retries, debounce behavior, and publishing verification.

The remaining Sanity commands also have short aliases:

| Command               | Alias       |
| --------------------- | ----------- |
| `pnpm deploy:studio`  | `pnpm dp/s` |
| `pnpm schema:extract` | `pnpm s/e`  |
| `pnpm typegen`        | `pnpm t/g`  |
| `pnpm typegen:check`  | `pnpm t/c`  |

## Shared components

The workspace already includes `packages/*`. Shared Astro components can be
published from a package there and linked into an app with a `workspace:*`
dependency. The shared UI package exposes both components:

```astro
---
import { Quote, Slideshow } from "@churchwebsite/ui";

const slides = [
  { src: "/images/photo-1.jpg", alt: "People worshipping" },
  { src: "/images/photo-2.jpg", alt: "The church building" },
];
---

<Slideshow slides={slides} interval={8000} aspectRatio="16 / 9" />

<Quote quote="In the beginning was the Word..." citation="John 1:1" />
```

Keep the images in the consuming app's `public/` directory. This ensures each
site deploys with its own content while the component behavior stays shared.
The controls use neutral colors by default and can be themed from an app with
the `--slideshow-control-bg`, `--slideshow-control-bg-hover`,
`--slideshow-control-color`, `--slideshow-dot-bg`, and
`--slideshow-dot-bg-active` custom properties.

Apps can theme the quote card with the `--quote-bg`, `--quote-color`, `--quote-padding`,
`--quote-font-size`, `--quote-radius`, and `--quote-mark-size` custom properties.

## Contributing

Thanks for helping improve this project. Use the notes below to keep contributions consistent with the existing workspace.

### Development Guidelines

- Keep changes scoped to the app you are working on unless the root workspace configuration also needs to change.
- Prefer Astro components in `src/components/` for reusable page sections.
- Put route-level files in `src/pages/`.
- Put shared page wrappers in `src/layouts/`.
- Put global Tailwind theme tokens, custom utilities, and app-wide CSS in `src/styles/global.css`.
- Use `public/` for files that should be served directly by URL.
- Use `src/assets/` for images imported by Astro components, especially when using `astro:assets`.
- Keep image names descriptive and lowercase with hyphens.
- Follow the existing component naming style in each app.

### Styling

This project uses Tailwind CSS 4. App-specific design tokens and utilities are defined in each app's `src/styles/global.css`.

When adding styles:

- Use existing colors, fonts, and utility classes before introducing new tokens.
- Add new theme tokens only when they will be reused.
- Keep responsive behavior in mind for navigation, hero sections, image grids, and form controls.
- Respect `prefers-reduced-motion` when adding animation.

### Content And Assets

- Check spelling, dates, names, and ministry/event details before submitting content changes.
- Optimize large images before adding them to the repository.
- Use meaningful `alt` text for images that communicate content.
- Avoid committing generated output or local-only files.

### Church Main Newsletter Updates

The designated church communications lead owns newsletter copy and publishing. A developer or repository maintainer reviews and deploys the resulting pull request.

New editions are authored in the Church Main section of Sanity Studio. Select the correct site-owned
newsletter template, fill the editorial fields, and use Sanity's draft/publish state for review. Studio
assigns the next Church Main issue number and generates the slug from the publication month. A second
issue in one month adds its issue number to keep both routes stable. Woman Excel may use the same slug
without a collision because uniqueness is site-scoped.

The files in `apps/churchmain/src/content/newsletters/` stay committed as rollback content during the
temporary migration window. To test or update that fallback:

1. Copy an existing Markdown file and name it `YYYY-MM.md`.
2. Update `title`, `publishedAt`, `excerpt`, and the Markdown body.
3. Optionally add `issue`, an image path plus meaningful `imageAlt`, or a related `link`.
4. Keep `draft: true` while the fallback edition is being reviewed; change it to `false` to publish.
5. Run `pnpm build:churchmain`, review `/newsletters` and the new detail page, then open a pull request.

The newest published date automatically becomes the featured edition and the target of every “View latest newsletter” button. Older editions move to the archive automatically. Entries without images use a branded cover treatment, and an empty collection shows a friendly fallback. Content is loaded during the static build, so there is no client-side loading state or runtime content request to fail.

### Dependency Changes

- Add shared dependency versions to the `catalog` in `pnpm-workspace.yaml` when possible.
- Keep `pnpm-lock.yaml` committed when dependencies change.
- Avoid adding a dependency for something Astro, Tailwind, or standard browser APIs already handle well.

### Verification

Before opening a pull request, run the relevant build:

```sh
pnpm build
```

For smaller app-specific changes, at minimum run the affected app build:

```sh
pnpm build:churchmain
pnpm build:womanexcel
```

Then quickly check the changed pages locally with the matching dev command.

### Pull Requests

- Describe what changed and why.
- Check Linear for related open issues, duplicate work, or follow-up tasks, and link any relevant issues in the PR.
- Include screenshots for visible UI changes.
- Note which build command you ran.
- Mention any content that still needs confirmation from church leadership or event organizers.
- Request review from the code owner listed in `.github/CODEOWNERS` when appropriate.

## Current Gaps

There are no dedicated test, lint, or formatting scripts in the root `package.json` yet. Until those are added, successful Astro builds and manual browser checks are the main verification steps.

# Church Website

This repository is a pnpm workspace containing multiple Astro sites for church-related web properties.

## Project Overview

- `apps/churchmain` is the main RCCG Cornerstone Assembly site.
- `apps/womanexcel` is the Woman Excel site.
- Shared dependency versions are managed from the root `pnpm-workspace.yaml` catalog.
- Each app is an Astro project using Tailwind CSS through `@tailwindcss/vite`.
- Static public assets live in each app's `public/` directory.
- Astro-imported assets live in each app's `src/assets/` directory.

## Requirements

- Node.js `>=22.12.0`
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

Run one app locally:

```sh
pnpm dev:churchmain
pnpm dev:womanexcel
```

Short aliases are also available:

```sh
pnpm d/c
pnpm d/w
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
```

Short aliases are also available:

```sh
pnpm b
pnpm b/c
pnpm b/w
```

## Repository Structure

```text
.
|-- apps/
|   |-- churchmain/
|   |   |-- public/
|   |   `-- src/
|   |       |-- assets/
|   |       |-- components/
|   |       |-- layouts/
|   |       |-- pages/
|   |       `-- styles/
|   `-- womanexcel/
|       |-- public/
|       `-- src/
|           |-- assets/
|           |-- components/
|           |-- layouts/
|           |-- pages/
|           `-- styles/
|-- package.json
|-- pnpm-lock.yaml
`-- pnpm-workspace.yaml
```

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
- Include screenshots for visible UI changes.
- Note which build command you ran.
- Mention any content that still needs confirmation from church leadership or event organizers.
- Request review from the code owner listed in `.github/CODEOWNERS` when appropriate.

## Current Gaps

There are no dedicated test, lint, or formatting scripts in the root `package.json` yet. Until those are added, successful Astro builds and manual browser checks are the main verification steps.

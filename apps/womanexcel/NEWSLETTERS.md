# Newsletter publishing workflow

The Woman Excel newsletter is authored in the Woman Excel section of the shared Sanity Studio.
Sanity validates each issue and Astro builds the newsletter archive and individual edition pages at
deploy time. Slugs are scoped to Woman Excel, so Church Main may use the same month slug.

The Markdown in `apps/womanexcel/src/content/newsletters/` remains a temporary rollback source while
the migration is reviewed. It is used as a whole-source fallback until
`PUBLIC_SANITY_NEWSLETTERS_ENABLED=true`, and again if a configured Sanity build-time request fails.

The Cornerstone Excellent Women communications lead owns the wording, dates,
links, and image selection. A repository maintainer adds the approved content,
runs the build, and opens the publishing pull request.

## Publish an edition in Sanity

1. Open the Woman Excel section of Studio and create a newsletter issue with its site-owned template.
2. Complete the title, slug, publication date, excerpt, body, and any issue number, cover, link, or SEO overrides.
3. Keep the issue as a Sanity draft while it is reviewed; publish it when approved.
4. Run `pnpm build:womanexcel` and confirm the archive and detail route before deployment.

## Maintain the temporary Markdown fallback

1. Duplicate the newest Markdown file in `src/content/newsletters/`.
2. Rename it to `YYYY-MM.md`, using the edition's publication month.
3. Replace the frontmatter and body with the approved content.
4. Put new images in `public/images/newsletters/` and reference them with a
   root-relative path such as `/images/newsletters/2026-09-cover.jpg`.
5. Set `draft: true` while the fallback edition is being reviewed. Drafts do not appear
   anywhere on the built site.
6. Set `draft: false`, run `pnpm build:womanexcel` from the repository root,
   and submit the change for review.

`publishedAt` controls display order but does not schedule publication. Keep a
future edition at `draft: true` until it is ready to appear on the site.

The newest published `publishedAt` value automatically becomes the large
editorial feature. Every older published edition automatically appears in the
magazine-cover archive beneath it.

## Frontmatter fields

| Field | Required | Purpose |
| --- | --- | --- |
| `title` | Yes | Edition title shown on the feature, cover, and detail page. |
| `publishedAt` | Yes | Publication date in `YYYY-MM-DD` format; controls sorting. |
| `excerpt` | Yes | Short summary shown on the newsletter landing page. |
| `issue` | No | Positive issue number shown as a label. |
| `image` | No | Root-relative cover image path. A branded type treatment is used when omitted. |
| `imageAlt` | No | Meaningful alternative text when the image conveys information; use an empty string for decorative artwork. |
| `link` | No | Related internal path or full external URL. |
| `draft` | No | Defaults to `false`; set to `true` to keep an entry out of production. |

The Markdown after the frontmatter is the full newsletter body. Standard
headings, paragraphs, lists, quotations, and links are supported.

## Empty, loading, and fallback behaviour

- With no published entries, `/newsletters` shows a friendly empty state and a
  contact link instead of a broken layout.
- With only one published entry, the archive explains that past editions will
  appear later.
- Entries without an image receive a branded typographic cover.
- Entries without a related link still link to their complete internal page.
- Newsletter data is rendered into static HTML during the build, so visitors
  do not wait on a client-side content request and no runtime loading state is
  necessary.

Email subscriptions and subscriber-data handling remain separate from this
publishing workflow and are tracked in RCC-37.

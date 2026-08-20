# Newsletter publishing workflow

The Woman Excel newsletter is authored in the Woman Excel section of the shared Sanity Studio.
Sanity validates each issue and Astro builds the newsletter archive and individual edition pages at
deploy time. Slugs are scoped to Woman Excel, so Church Main may use the same month slug.

The Cornerstone Excellent Women communications lead owns the wording, dates,
links, and image selection. Sanity is the only newsletter content source.

## Publish an edition in Sanity

1. Open the Woman Excel section of Studio and create a newsletter issue with its site-owned template.
2. Complete the title, publication date, excerpt, body, and any cover, link, or SEO overrides. Studio
   assigns the next site-specific issue number and derives the slug automatically.
3. Keep the issue as a Sanity draft while it is reviewed; publish it when approved.
4. Run `pnpm build:womanexcel` and confirm the archive and detail route before deployment.

The first issue in a month uses `YYYY-MM`. If another issue is published in that same month, its slug
adds the automatically assigned issue number (for example, `2026-08-10`) so both permanent routes
remain valid. Existing published slugs do not change when titles or dates are later edited.

When the local Astro server is connected to the `development` dataset,
publishing, unpublishing, or deleting a Woman Excel issue automatically reloads connected browser
pages. Draft edits do not reload the public-content preview. Production remains statically rendered
and updates through a Vercel rebuild.

`publishedAt` and the automatic issue number control display order but do not schedule publication.
Keep a future edition as a Sanity draft until it is ready to appear on the site.

The newest published `publishedAt` value automatically becomes the large
editorial feature. Every older published edition automatically appears in the
magazine-cover archive beneath it.

## Empty and loading behaviour

- With no published entries, `/newsletters` shows a friendly empty state and a
  contact link instead of a broken layout.
- With only one published entry, no archive section is shown.
- Entries without an image receive a branded typographic cover.
- Entries without a related link still link to their complete internal page.
- Newsletter data is rendered into static HTML during the build, so visitors
  do not wait on a client-side content request and no runtime loading state is
  necessary.

Email subscriptions and subscriber-data handling remain separate from this
publishing workflow and are tracked in RCC-37.

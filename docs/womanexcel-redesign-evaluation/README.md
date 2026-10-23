# Woman Excel redesign screenshots

This redesign is now production-bound through the PR targeting `main`. The PR remains unmerged; a production release will be cut separately once `main` is ready.

These captures document earlier review states. The host biography now appears only on the homepage; conference pages keep a compact link to that biography instead of repeating it. The homepage conference card also has 24px of spacing above its button. Older captures may not show those refinements.

## Latest refinements · October 2, 2026

These captures show the unified homepage-style navigation, purple active underline and Contact Us button, functional gallery viewer, border-free rounded photos, contact scroll cue, and homepage-only recap. Desktop captures are 1280px wide; mobile captures are 390px wide.

| Change | Desktop | Mobile |
| --- | --- | --- |
| Unified navigation | [Conference navigation](./navigation-conference-desktop.jpg) | [Open menu](./navigation-mobile.jpg) |
| Gallery | [Gallery](./gallery-desktop.jpg) | [Gallery](./gallery-mobile.jpg) |
| Photo viewer | — | [Photo viewer](./gallery-viewer-mobile.jpg) |
| Homepage recap | [Recap](./recap-desktop.jpg) | [Recap](./recap-mobile.jpg) |
| Contact scroll cue | [Contact](./contact-scroll-desktop.jpg) | — |
| Rounded archive cards | [Archive cards](./archive-cards-desktop.jpg) | — |

The two flagged 2026 photos are removed from the galleries, not deleted from the source asset library. The replacement curated photo set is still pending. The annual homepage recap is configured in `apps/womanexcel/src/components/home/latest-conference.ts`. Conference archive and gallery photos no longer translate during scroll, preventing exposed corners on smaller screens; other page motion remains.

The build passes with 12 pages, and route checks pass for 12 Woman Excel pages and 34 Church Main pages. Homepage, conference archive, conference 2026, and contact were checked at 320px, 390px, 430px, and 1280px without horizontal overflow. Gallery opening, navigation, Escape dismissal, focus restoration, and scroll unlocking were verified, along with the mobile menu and contact scroll target.

## Earlier captures

The framed design was captured through the T3 Code collaborative preview using the connected Sanity development dataset on October 1, 2026. The homepage captures show the refined, understated carousel controls. Newsletter screenshots therefore reflect the current development content, including test copy and imagery.

The screenshots show the settled state of the entrance animations. Motion, hover, scroll, and marquee behavior should be evaluated in the browser preview.

The homepage opens with three supplied group photos, crossfading every three seconds. The captures pause on the opening group shot. Controls are three small dots and a compact pause/play icon, without large circular buttons or a text pill. Previous/next buttons become visible only when focused for keyboard navigation. Reduced-motion preference disables autoplay. On phones, the photo sits above the copy so the group remains visible. The separate “Who we are” gathering photo is unchanged.

## Viewports

- Desktop: 1440 × 1000
- Mobile: 390 × 844

The homepage, conference archive, both conference years, contact, and newsletters were also checked at 320px and 430px widths. No horizontal page overflow or heading overflow was detected.

## Image performance and edges

Homepage content photos and host portraits use generated, responsive WebP assets with explicit dimensions. The 2.4 MB portrait is replaced by roughly 10–40 KB portrait variants and 1–3 KB badge variants. Lazy loading remains for lower content, but photos are no longer fully hidden behind the one-second scroll-reveal mask. Text entrances and photo parallax remain.

The two story photos are clipped by rounded outer containers, including during parallax. The small photo's white border has been removed. Desktop and 320px, 390px, and 430px checks confirmed rounded clipping, no white border, loaded images, and no page overflow.

## Captures

| Page | Desktop | Mobile |
| --- | --- | --- |
| Home | [home-desktop.jpg](./home-desktop.jpg) | [home-mobile.jpg](./home-mobile.jpg) |
| Pastor Toyin host section | [host-desktop.jpg](./host-desktop.jpg) | [host-mobile.jpg](./host-mobile.jpg) |
| Who we are photo | [about-desktop.jpg](./about-desktop.jpg) | [about-mobile.jpg](./about-mobile.jpg) |
| Rounded story photos | [story-desktop.jpg](./story-desktop.jpg) | [story-mobile.jpg](./story-mobile.jpg) |
| Conference archive | [conference-desktop.jpg](./conference-desktop.jpg) | [conference-mobile.jpg](./conference-mobile.jpg) |
| Conference 2025 | [conference-2025-desktop.jpg](./conference-2025-desktop.jpg) | — |
| Conference 2026 | [conference-2026-desktop.jpg](./conference-2026-desktop.jpg) | — |
| Newsletters | [newsletters-desktop.jpg](./newsletters-desktop.jpg) | [newsletters-mobile.jpg](./newsletters-mobile.jpg) |
| Contact | [contact-desktop.jpg](./contact-desktop.jpg) | [contact-mobile.jpg](./contact-mobile.jpg) |

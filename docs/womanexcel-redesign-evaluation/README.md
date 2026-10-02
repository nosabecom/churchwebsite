# Woman Excel redesign screenshots

This redesign is now production-bound through the PR targeting `main`. The PR remains unmerged; a production release will be cut separately once `main` is ready.

These captures document earlier review states. The host biography now appears only on the homepage; conference pages keep a compact link to that biography instead of repeating it. The homepage conference card also has 24px of spacing above its button. Older captures may not show those refinements.

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

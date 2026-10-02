# Church Main redesign

Production-candidate redesign for RCCG Cornerstone Assembly. This supersedes the
earlier design-direction evaluation on this branch. Merge and production release
remain the maintainers’ decision.

## Direction

[Butter](https://www.butter.video/) inspired the generous typography, floating
navigation islands, tactile sculptural artwork, and modular gallery layout. No
Butter assets, copy, or implementation were copied. The church identity, service
details, and pastors remain Cornerstone’s own.

The homepage replaces the photographic experiment with an original, abstract
cornerstone gateway: an open door and a firm foundation. Real pastor photographs
anchor the welcome section; Pastor Toyin’s photograph comes from the church’s
original site. The generated congregation hero and spinning-badge component have
been removed. The portraits no longer overlap copy or each other.

| Role | Color |
| --- | --- |
| Main text / footer | Grape charcoal `#262338` |
| Page background | Warm parchment `#f3eee7` |
| Hero / transfer panel | Lilac `#e6dffa` |
| Give / featured event / envelope | Coral `#ef947f` |
| Newsletter / hero accent | Indigo `#3d43a2` |
| Ministry section | Forest `#143c35` |
| Sculpture / small accents | Sunflower `#f2ca45` |

The [old interactive palette lab](./palette-lab-archive.html) is retained solely
as a historical design artifact, not the palette used by this production build.

## Motion and access

- Native vertical scrolling: no scroll hijacking, parallax, horizontal event
  rails, marquees, or constantly spinning text.
- Gentle eight-second sculpture drift while visible. The homepage’s
  **Pause animation** button stops decorative motion and entrance effects.
- Brief, one-time section entrances. Content is visible without JavaScript;
  animations do not control layout or gate access to links.
- Small ministry-art hover transformations only on fine-pointer devices.
- Reduced-motion preferences remove animations and transitions, including when
  the preference changes while the page is open.
- Persistent Give on desktop and mobile; service details precede artwork on
  phones. Native modal navigation, keyboard focus cycling, Escape dismissal,
  focus restoration, a skip link, and no-JavaScript navigation fallback.

## Giving and content

The new `/give` route uses the Interac email published on the
[original giving page](https://rccgcornerstonesk.wixsite.com/site/give):
`rccg.cornerstonesk@gmail.com`. It provides selectable text, a clipboard button
with a denied-permission fallback, and an in-person option. No donation was
submitted while testing. Payment details are handled by the donor’s bank, not
this website.

The old site’s card button had no usable destination, and its displayed SMS
number differed from the link destination. Neither has been guessed or included;
adding these methods requires a confirmed church-approved destination.

The homepage keeps the existing event data and newsletter lookup. Sunday 9:00 AM,
Wednesday 7:00 PM, Power Night on the last Friday at 10:00 PM, and the Millar
Avenue address match the existing church information. Maintainers should review
new welcome copy and giving instructions before merge. Existing interior-page
content, including ministry placeholders and message data, has not been rewritten
or validated as part of this homepage/shared-shell redesign.

Shared content wrapping and ministry-detail grid sizing are hardened against
long titles and email addresses on narrow screens.

No Woman Excel application, CMS schema, dependency, or infrastructure changes.
The original artwork is optimized into responsive WebP by Astro; its source and
full generation prompt are documented in [image-prompt.md](./image-prompt.md).

## Verification

- Workspace build and static-route/internal-link checks.
- Responsive checks at 320, 360, 430, 768, 1024, 1440, and 1920 CSS pixels.
- Mobile menu focus cycling, Escape, and focus restoration.
- Persistent Give, giving clipboard success and denied-permission fallback.
- Motion pause/resume, reduced-motion behavior, and no-JavaScript fallbacks.
- Automated WCAG 2 A/AA and 2.1 AA checks on home and giving pages.
- Shared mobile shell checks on all 35 generated Church Main routes.

Automated accessibility checks supplement, but do not replace, human review.

## Captures

Screenshots come from the static production build, without a development toolbar.
Motion is disabled for stable captures; use the preview to review animations.

| Viewport | Capture |
| --- | --- |
| Desktop — 1440 × 1000 | [Homepage](./home-desktop.jpg) |
| Mobile — 430 × 932 | [Homepage](./home-mobile.jpg) |
| Desktop — 1440 × 1000 | [Giving](./give-desktop.jpg) |
| Desktop opening | [Hero](./home-hero.jpg) |

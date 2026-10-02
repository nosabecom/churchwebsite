# Church Main redesign

Production-candidate redesign for RCCG Cornerstone Assembly. The current direction
supersedes both the earlier evaluation and the sculptural design on this branch.
Merge and production release remain the maintainers’ decision.

## Direction

A welcoming editorial home for a real church family: generous serif typography,
authentic community photography, warm paper backgrounds, midnight blue, and small
antique-gold accents. The burgundy newsletter panel and terracotta italic headings
bring variety without turning every section into a different visual language.

The homepage uses a congregation photograph from the original Cornerstone site,
paired with a direct invitation. Pastor portraits sit in a framed composition
without overlapping text or each other. Pastor Toyin’s authentic original-site
portrait is retained. Simple calendar rows replace the card-heavy event layout;
community photographs replace abstract ministry illustrations. The newsletter
cover is built in HTML/CSS with the church’s existing logo.

The previous AI sculpture, its prompt, and the geometric ministry art are removed
from the current build; those earlier assets remain recoverable in Git history.
No generated people or stock congregation photographs are used.

Research, reference links, the Woman Excel comparison, and photo provenance are
recorded in [design-study.md](./design-study.md). No assets, copy, or implementation
from unrelated reference sites were copied.

| Role | Color |
| --- | --- |
| Text, hero, Give, footer | Midnight blue `#172f3f` |
| Page background | Warm ivory `#fbf7ef` |
| Paper / light text | Soft white `#fffdf8` |
| Hero accent / primary invitation | Antique gold `#e5c590` |
| Small headings / italic accents | Terracotta `#8e5949` |
| Newsletter panel | Burgundy `#643c47` |

The [old palette lab](./palette-lab-archive.html) is a historical artifact, not
the palette used by this production candidate.

## Motion and access

- Ordinary vertical scrolling: no scroll hijacking, parallax, horizontal event
  rails, marquees, or spinning text.
- One-time headline entrances and a gentle 2.2-second photo settle. Later
  sections have brief, one-time entrances as they come into view. There is no
  continuously running decorative animation.
- The homepage’s **Pause animation** control stops active decorative motion and
  disables future entrance effects. Content remains visible and usable.
- Reduced-motion preferences remove animations and transitions, including when
  the preference changes while the page is open.
- Persistent Give on desktop and mobile; Sunday time and address appear before
  the hero photo on phones. Native modal navigation, keyboard focus cycling,
  Escape dismissal, focus restoration, skip link, and no-JavaScript navigation.
- High-contrast body text, visible focus styles, and generous control targets.
  Icons are native SVG rather than relying on a visitor’s symbol fonts.

## Giving and content

The `/give` route uses the Interac email published on the
[original giving page](https://rccgcornerstonesk.wixsite.com/site/give):
`rccg.cornerstonesk@gmail.com`. It provides selectable text, a clipboard button
with a denied-permission fallback, and an in-person option. No donation was
submitted while testing. Payment details are handled by the donor’s bank, not
this website.

The old site’s card button had no usable destination, and its displayed SMS
number differed from the link destination. Neither has been guessed or included;
adding these methods requires a confirmed church-approved destination.

The existing event data and newsletter lookup are preserved. Sunday 9:00 AM,
Wednesday 7:00 PM, Power Night on the last Friday at 10:00 PM, and the Millar
Avenue address retain existing church information. Maintainers should review new
welcome copy, photo reuse, and giving instructions before merge. Supporting
Woman Excel images are explicitly described as conference photographs, not Sunday
service photographs.

Existing interior-page content, including ministry placeholders and message data,
has not been rewritten or validated as a content-release audit. Shared content
wrapping and ministry-detail grid sizing are hardened for narrow screens.

No Woman Excel application, CMS schema, dependency, or infrastructure changes.
Photographs are optimized into responsive WebP by Astro.

## Verification

- Workspace build and static-route/internal-link checks.
- Responsive checks at 320, 360, 430, 768, 1024, 1440, and 1920 CSS pixels.
- Mobile menu focus cycling, Escape, and focus restoration.
- Persistent Give, giving clipboard success and denied-permission fallback.
- Animation pause/resume, reduced-motion behavior, and no-JavaScript fallbacks.
- Automated WCAG 2 A/AA and 2.1 AA scans: zero violations on home and giving at
  430px and 1440px.
- Shared mobile shell checks on all 35 generated Church Main routes.

The collaborative preview was used for visual and interaction review while its
automation host was available. After it disconnected, final regression checks
and captures used a local static production build. The Vercel preview requires
login; a successful deployment is not an unauthenticated deployed-browser test.
Automated accessibility checks supplement, but do not replace, human review.

## Captures

Screenshots come from the static production build, without a development toolbar.
All images are loaded; motion is disabled for stable captures. Use the preview to
review animations.

| Viewport | Capture |
| --- | --- |
| Desktop — 1440 × 1000 | [Full homepage](./home-desktop.jpg) |
| Mobile — 430 × 932 | [Full homepage](./home-mobile.jpg) |
| Desktop — 1440 × 1000 | [Giving](./give-desktop.jpg) |
| Desktop opening | [Hero](./home-hero.jpg) |
| Desktop welcome | [Pastors and welcome](./home-welcome.jpg) |
| Desktop ministries | [Community](./home-community.jpg) |

# Design study: warmth, dignity, and a clear invitation

The sculptural iteration looked designed, but did not say enough about the actual
people or character of Cornerstone. This revision changes the visual direction,
not just the colors. The aim is a church homepage that feels welcoming to both
longtime members and first-time visitors, with straightforward everyday tasks.

## References and decisions

- [Woman Excel redesign, PR #36](https://github.com/nosabecom/churchwebsite/pull/36):
  reviewed its implementation and desktop capture rather than relying on its PR
  description. Its strongest qualities are a coherent identity, expressive serif
  typography, a warm framed page, and real community photography. Those principles
  informed this revision; Cornerstone has its own blue/ivory/gold identity rather
  than adopting Woman Excel’s violet palette or copying its layout.
- [St Paul’s Cathedral identity by Pentagram](https://www.pentagram.com/work/st-paul-s-cathedral):
  a religious institution can have elegant, confident typography rooted in its
  own character while remaining inviting. Applied here as dignified serif
  headlines, quieter supporting text, and a consistent palette—not borrowed
  cathedral graphics or lettering.
- [House of Praise](https://www.houseofpraise.ca/),
  [HTB](https://htb.org/), and [Church of the City](https://www.cotc.com/): reviewed
  as church references for a welcoming first impression and practical visitor
  information. Cornerstone’s own people should lead the page; a generic art object
  cannot communicate that belonging as well.
- [Aman](https://www.aman.com/): examined as a non-church reference for calm,
  spacious presentation. The applicable lesson is restraint and room for imagery,
  not luxury positioning, obscure navigation, or tiny text.
- [Butter](https://www.butter.video/): the earlier requested reference remains
  useful for confidence and animation, but its studio personality is not the
  personality of this congregation. Keep deliberate entrances and a polished
  photo transition; remove the visual gimmicks and permanent movement.
- Nielsen Norman Group’s
  [older-adult usability study](https://www.nngroup.com/articles/usability-for-senior-citizens/)
  and [follow-up research](https://www.nngroup.com/articles/usability-seniors-improvements/):
  readable type, obvious links, generous targets, and predictable interactions
  matter more than age stereotypes. Applied here as plain navigation labels,
  persistent Give, high-contrast copy, ordinary scrolling, and motion preferences.

These are interpretations used to guide the design, not claims that every
reference uses the exact implementation or palette found here.

## What changed

The opening pairs a real, colorful congregation photo with a deep blue invitation
and antique-gold italic emphasis. The ivory service strip immediately answers
when and where. A warm portrait frame makes the pastors approachable without
covering their names or the welcome text. Calendar rows put dates and details in
a familiar rhythm. Two authentic conference images add texture to the ministries
section, while its navigation remains simple. A burgundy newsletter panel and
paper-cover illustration complete the palette without a pile of unrelated cards.

The layout is asymmetrical where it helps the composition, not where it hides
information. Mobile has its own ordering and spacing. No content is gated behind
scroll effects. Motion happens once and can be disabled.

## Photo provenance

| Current asset | Source | Use |
| --- | --- | --- |
| `cornerstone-gathering.jpg` | [Original church homepage](https://rccgcornerstonesk.wixsite.com/site), [published Wix image](https://static.wixstatic.com/media/1214b4_f29be0aa92624c49b51f1bcc4ec00857~mv2.jpg) | Congregation hero |
| `prayer.jpg` | Existing `apps/womanexcel/public/images/conference/2025/gallery-14.jpg` | Community prayer image |
| `fellowship.jpg` | Existing `apps/womanexcel/public/images/conference/2026/day-one-05.jpg`, also present in PR #36’s conference selection | Community fellowship image |
| Pastor Toyin portrait | Existing authentic original-site portrait retained from commit `77f2387` | Welcome section |
| Pastor Reuben portrait / church logo | Existing Church Main assets | Welcome and shared identity |

Only already-published or supplied church-library photographs were reused. No
unrelated reference-site imagery was downloaded into this build. This documents
where the assets came from; it is not a new permissions audit. Maintainers should
confirm that this placement and reuse match the church’s photo permissions.
Conference-image alt text identifies Woman Excel rather than presenting those
photos as an ordinary Sunday gathering.

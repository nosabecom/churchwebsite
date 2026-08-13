import {EnvelopeIcon} from '@sanity/icons/Envelope'
import {HeartIcon} from '@sanity/icons/Heart'
import {HomeIcon} from '@sanity/icons/Home'
import type {StructureBuilder, StructureResolver} from 'sanity/structure'
import {newsletterIssueTemplateId, sites, type Site} from '../schemaTypes/shared/sites'

const siteIcons = {
  churchMain: HomeIcon,
  womanExcel: HeartIcon,
} satisfies Record<Site, typeof HomeIcon>

const siteSection = (S: StructureBuilder, site: (typeof sites)[number]) =>
  S.listItem()
    .id(site.value)
    .title(site.title)
    .icon(siteIcons[site.value])
    .child(
      S.list()
        .id(`${site.value}-content`)
        .title(site.title)
        .items([
          S.listItem()
            .id(`${site.value}-newsletter-issues`)
            .title('Newsletter issues')
            .icon(EnvelopeIcon)
            .child(
              S.documentList()
                .id(`${site.value}-newsletter-issue-documents`)
                .title(`${site.title} newsletter issues`)
                .schemaType('newsletterIssue')
                .filter('_type == "newsletterIssue" && site == $site')
                .params({site: site.value})
                .defaultOrdering([{field: 'publishedAt', direction: 'desc'}])
                .menuItems(S.documentTypeList('newsletterIssue').getMenuItems())
                .initialValueTemplates([
                  S.initialValueTemplateItem(newsletterIssueTemplateId(site.value)),
                ]),
            ),
        ]),
    )

export const structure: StructureResolver = (S) =>
  S.list()
    .title('Website content')
    .items(sites.map((site) => siteSection(S, site)))

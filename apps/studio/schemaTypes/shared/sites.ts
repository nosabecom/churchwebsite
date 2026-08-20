import {defineField, type InitialValueResolverContext, type Template} from 'sanity'

import {nextNewsletterIssueNumber} from './site-issue-number'

export const sites = [
  {title: 'Church Main', value: 'churchMain'},
  {title: 'Woman Excel', value: 'womanExcel'},
] as const

export type Site = (typeof sites)[number]['value']

export const siteTitle = (site: unknown) =>
  sites.find(({value}) => value === site)?.title ?? 'Unknown site'

export const newsletterIssueTemplateId = (site: Site) => `newsletterIssue-${site}`

export const newsletterIssueTemplates = sites.map((site): Template => ({
  id: newsletterIssueTemplateId(site.value),
  title: `${site.title} newsletter issue`,
  schemaType: 'newsletterIssue',
  value: async (_parameters: unknown, context: InitialValueResolverContext) => ({
    site: site.value,
    issue: await nextNewsletterIssueNumber(site.value, context),
  }),
}))

export const siteOwnershipField = defineField({
  name: 'site',
  title: 'Owning site',
  description: 'Controls where this content appears. Choose the site before creating the issue.',
  type: 'string',
  options: {
    layout: 'radio',
    list: sites.map(({title, value}) => ({title, value})),
  },
  readOnly: ({document}) => Boolean(document?._createdAt),
  validation: (rule) => rule.required(),
})

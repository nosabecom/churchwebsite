import {defineField} from 'sanity'

export const sites = [
  {title: 'Church Main', value: 'churchMain'},
  {title: 'Woman Excel', value: 'womanExcel'},
] as const

export type Site = (typeof sites)[number]['value']

export const siteTitle = (site: unknown) =>
  sites.find(({value}) => value === site)?.title ?? 'Unknown site'

export const newsletterIssueTemplateId = (site: Site) => `newsletterIssue-${site}`

export const newsletterIssueTemplates = sites.map((site) => ({
  id: newsletterIssueTemplateId(site.value),
  title: `${site.title} newsletter issue`,
  schemaType: 'newsletterIssue',
  value: {site: site.value},
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

import type {InitialValueResolverContext, ValidationContext} from 'sanity'

import type {Site} from './sites'

const API_VERSION = '2026-08-13'

export const NEXT_NEWSLETTER_ISSUE_QUERY = `
  coalesce(
    (*[
      _type == "newsletterIssue" &&
      site == $site &&
      defined(issue)
    ] | order(issue desc))[0].issue,
    0
  ) + 1
`

export async function nextNewsletterIssueNumber(site: Site, context: InitialValueResolverContext) {
  return context
    .getClient({apiVersion: API_VERSION})
    .withConfig({perspective: 'raw'})
    .fetch<number>(NEXT_NEWSLETTER_ISSUE_QUERY, {site})
}

export async function isIssueNumberUniqueWithinSite(
  issue: number | undefined,
  context: ValidationContext,
) {
  if (typeof issue !== 'number') return true

  const site = context.document?.site
  if (site !== 'churchMain' && site !== 'womanExcel') return true

  const publishedId = context.document?._id?.replace(/^drafts\./, '') ?? ''
  const draftId = `drafts.${publishedId}`
  const duplicateCount = await context
    .getClient({apiVersion: API_VERSION})
    .withConfig({perspective: 'raw'})
    .fetch<number>(
      `count(*[
        _type == "newsletterIssue" &&
        site == $site &&
        issue == $issue &&
        !(_id in [$draftId, $publishedId])
      ])`,
      {site, issue, draftId, publishedId},
    )

  const title = site === 'churchMain' ? 'Church Main' : 'Woman Excel'
  return duplicateCount === 0 || `Issue ${issue} already exists for ${title}.`
}

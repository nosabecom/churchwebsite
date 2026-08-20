import type {SanityClient} from 'sanity'

import type {Site} from './sites'

export const NEWSLETTER_SLUG_API_VERSION = '2026-08-14'

export const NEWSLETTER_SLUG_AVAILABILITY_QUERY = `{
  "currentTaken": count(*[
    _type == "newsletterIssue" &&
    site == $site &&
    slug.current == $currentSlug &&
    !(_id in [$draftId, $publishedId])
  ]) > 0,
  "baseTaken": count(*[
    _type == "newsletterIssue" &&
    site == $site &&
    slug.current == $baseSlug &&
    !(_id in [$draftId, $publishedId])
  ]) > 0
}`

export function slugFromPublicationDate(value: unknown) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value.slice(0, 7)
    : undefined
}

interface ResolveNewsletterSlugOptions {
  client: SanityClient
  currentSlug?: string
  documentId?: string
  issue?: number
  publishedAt: unknown
  site?: Site
}

export async function resolveNewsletterSlug({
  client,
  currentSlug,
  documentId,
  issue,
  publishedAt,
  site,
}: ResolveNewsletterSlugOptions) {
  const baseSlug = slugFromPublicationDate(publishedAt)
  if (!baseSlug) return undefined

  if (!documentId || !site || !Number.isInteger(issue) || !issue || issue < 1) {
    return baseSlug
  }

  const fallbackSlug = `${baseSlug}-${issue}`
  const publishedId = documentId.replace(/^drafts\./, '')
  const draftId = `drafts.${publishedId}`
  const availability = await client.fetch<{
    currentTaken: boolean
    baseTaken: boolean
  }>(
    NEWSLETTER_SLUG_AVAILABILITY_QUERY,
    {
      baseSlug,
      currentSlug: currentSlug ?? '',
      draftId,
      publishedId,
      site,
    },
    {perspective: 'raw'},
  )

  const currentMatchesGeneratedPattern = currentSlug === baseSlug || currentSlug === fallbackSlug

  if (currentMatchesGeneratedPattern && !availability.currentTaken) return currentSlug
  if (!availability.baseTaken) return baseSlug

  // Issue numbers are unique within a site, so this remains deterministic for
  // every additional newsletter published in the same month. The validators
  // surface the underlying issue-number collision if this fallback is occupied.
  return fallbackSlug
}

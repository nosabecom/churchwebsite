import type {SlugIsUniqueValidator} from 'sanity'

const apiVersion = '2026-08-01'

export const isSlugUniqueWithinSite: SlugIsUniqueValidator = async (slug, context) => {
  const {document} = context
  const site = document?.site

  if (!document?._id || !document._type || typeof site !== 'string') {
    return true
  }

  const publishedId = document._id.replace(/^drafts\./, '')
  const draftId = `drafts.${publishedId}`
  const client = context.getClient({apiVersion})

  return client.fetch<boolean>(
    `!defined(*[
      _type == $type &&
      site == $site &&
      slug.current == $slug &&
      !(_id in [$draftId, $publishedId])
    ][0]._id)`,
    {
      draftId,
      publishedId,
      site,
      slug,
      type: document._type,
    },
    {perspective: 'raw'},
  )
}

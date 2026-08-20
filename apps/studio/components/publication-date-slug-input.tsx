import {useEffect} from 'react'
import {set, unset, useClient, useFormValue, type SlugInputProps} from 'sanity'

import {
  NEWSLETTER_SLUG_API_VERSION,
  resolveNewsletterSlug,
  slugFromPublicationDate,
} from '../schemaTypes/shared/newsletter-slug'
import type {Site} from '../schemaTypes/shared/sites'

export function PublicationDateSlugInput(props: SlugInputProps) {
  const client = useClient({apiVersion: NEWSLETTER_SLUG_API_VERSION})
  const documentId = useFormValue(['_id'])
  const issue = useFormValue(['issue'])
  const publishedAt = useFormValue(['publishedAt'])
  const site = useFormValue(['site'])
  const baseSlug = slugFromPublicationDate(publishedAt)
  const currentSlug = props.value?.current

  useEffect(() => {
    let cancelled = false

    void (async () => {
      const publishedId =
        typeof documentId === 'string' ? documentId.replace(/^drafts\./, '') : undefined
      const publishedSlug = publishedId
        ? await client.fetch<string | null>(
            '*[_id == $publishedId][0].slug.current',
            {publishedId},
            {perspective: 'raw'},
          )
        : undefined

      if (cancelled) return
      if (publishedSlug) {
        if (publishedSlug !== currentSlug) {
          props.onChange(set({_type: 'slug', current: publishedSlug}))
        }
        return
      }

      if (!baseSlug) {
        if (currentSlug) props.onChange(unset())
        return
      }

      const generatedSlug = await resolveNewsletterSlug({
        client,
        currentSlug,
        documentId: typeof documentId === 'string' ? documentId : undefined,
        issue: typeof issue === 'number' ? issue : undefined,
        publishedAt,
        site: site === 'churchMain' || site === 'womanExcel' ? (site as Site) : undefined,
      })
      if (!cancelled && generatedSlug && generatedSlug !== currentSlug) {
        props.onChange(set({_type: 'slug', current: generatedSlug}))
      }
    })().catch((error: unknown) => {
      console.error('Unable to generate the newsletter slug.', error)
    })

    return () => {
      cancelled = true
    }
  }, [baseSlug, client, currentSlug, documentId, issue, props.onChange, publishedAt, site])

  return props.renderDefault({...props, readOnly: true})
}

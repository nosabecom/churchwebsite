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

    if (!baseSlug) {
      if (currentSlug) props.onChange(unset())
      return
    }

    void resolveNewsletterSlug({
      client,
      currentSlug,
      documentId: typeof documentId === 'string' ? documentId : undefined,
      issue: typeof issue === 'number' ? issue : undefined,
      publishedAt,
      site: site === 'churchMain' || site === 'womanExcel' ? (site as Site) : undefined,
    })
      .then((generatedSlug) => {
        if (!cancelled && generatedSlug && generatedSlug !== currentSlug) {
          props.onChange(set({_type: 'slug', current: generatedSlug}))
        }
      })
      .catch((error: unknown) => {
        console.error('Unable to generate the newsletter slug.', error)
      })

    return () => {
      cancelled = true
    }
  }, [baseSlug, client, currentSlug, documentId, issue, props.onChange, publishedAt, site])

  return props.renderDefault({...props, readOnly: true})
}

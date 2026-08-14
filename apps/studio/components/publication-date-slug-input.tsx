import {useEffect} from 'react'
import {set, unset, useFormValue, type SlugInputProps} from 'sanity'

export function slugFromPublicationDate(value: unknown) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value.slice(0, 7)
    : undefined
}

export function PublicationDateSlugInput(props: SlugInputProps) {
  const publishedAt = useFormValue(['publishedAt'])
  const generatedSlug = slugFromPublicationDate(publishedAt)
  const currentSlug = props.value?.current

  useEffect(() => {
    if (generatedSlug === currentSlug) return

    props.onChange(generatedSlug ? set({_type: 'slug', current: generatedSlug}) : unset())
  }, [currentSlug, generatedSlug, props.onChange])

  return props.renderDefault({...props, readOnly: true})
}

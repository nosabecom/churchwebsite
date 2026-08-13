import {ImageIcon} from '@sanity/icons/Image'
import {defineField, defineType} from 'sanity'

type EditorialImageParent = {
  asset?: unknown
  decorative?: boolean
}

export const editorialImage = defineType({
  name: 'editorialImage',
  title: 'Editorial image',
  type: 'image',
  icon: ImageIcon,
  options: {
    hotspot: true,
  },
  fields: [
    defineField({
      name: 'decorative',
      title: 'Decorative image',
      description: 'Enable only when the image adds no information and should have empty alt text.',
      type: 'boolean',
      initialValue: false,
    }),
    defineField({
      name: 'alt',
      title: 'Alternative text',
      description: 'Describe the image for people who cannot see it.',
      type: 'string',
      hidden: ({parent}) => (parent as EditorialImageParent | undefined)?.decorative === true,
      validation: (rule) =>
        rule.custom((alt, context) => {
          const parent = context.parent as EditorialImageParent | undefined
          if (!parent?.asset || parent.decorative) return true
          return (typeof alt === 'string' && alt.trim().length > 0) || 'Add alternative text.'
        }),
    }),
  ],
  validation: (rule) => rule.assetRequired(),
  preview: {
    select: {
      alt: 'alt',
      decorative: 'decorative',
      media: 'asset',
    },
    prepare: ({alt, decorative, media}) => ({
      title: decorative ? 'Decorative image' : alt || 'Editorial image',
      media,
    }),
  },
})

import {LinkIcon} from '@sanity/icons/Link'
import {defineField, defineType} from 'sanity'

const allowedHref = /^(?:\/(?!\/)|https?:\/\/|mailto:)/i

export const link = defineType({
  name: 'link',
  title: 'Link',
  type: 'object',
  icon: LinkIcon,
  fields: [
    defineField({
      name: 'label',
      title: 'Label',
      description: 'Optional for links inside rich text, where the selected text is the label.',
      type: 'string',
    }),
    defineField({
      name: 'href',
      title: 'Destination',
      description: 'Use a root-relative path, an http(s) URL, or a mailto link.',
      type: 'string',
      validation: (rule) =>
        rule.required().custom((href) => {
          if (!href || allowedHref.test(href)) return true
          return 'Use a root-relative path, an http(s) URL, or a mailto link.'
        }),
    }),
  ],
  preview: {
    select: {
      label: 'label',
      href: 'href',
    },
    prepare: ({label, href}) => ({
      title: label || href || 'Link',
      subtitle: label ? href : undefined,
    }),
  },
})

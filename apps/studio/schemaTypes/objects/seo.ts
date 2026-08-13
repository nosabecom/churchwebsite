import {SearchIcon} from '@sanity/icons/Search'
import {defineField, defineType} from 'sanity'

export const seo = defineType({
  name: 'seo',
  title: 'Search and social metadata',
  type: 'object',
  icon: SearchIcon,
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      description: 'Leave empty to use the newsletter title.',
      type: 'string',
      validation: (rule) =>
        rule.max(60).warning('Search titles are usually best under 60 characters.'),
    }),
    defineField({
      name: 'description',
      title: 'Description',
      description: 'Leave empty to use the newsletter excerpt.',
      type: 'text',
      rows: 3,
      validation: (rule) =>
        rule.max(160).warning('Search descriptions are usually best under 160 characters.'),
    }),
  ],
})

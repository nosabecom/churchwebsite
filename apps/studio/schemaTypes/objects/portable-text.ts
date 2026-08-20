import {BlockContentIcon} from '@sanity/icons/BlockContent'
import {defineArrayMember, defineType} from 'sanity'

export const portableText = defineType({
  name: 'portableText',
  title: 'Rich text',
  type: 'array',
  icon: BlockContentIcon,
  of: [
    defineArrayMember({
      type: 'block',
      styles: [
        {title: 'Normal', value: 'normal'},
        {title: 'Heading 2', value: 'h2'},
        {title: 'Heading 3', value: 'h3'},
        {title: 'Quote', value: 'blockquote'},
      ],
      lists: [
        {title: 'Bulleted list', value: 'bullet'},
        {title: 'Numbered list', value: 'number'},
      ],
      marks: {
        decorators: [
          {title: 'Strong', value: 'strong'},
          {title: 'Emphasis', value: 'em'},
        ],
        annotations: [defineArrayMember({type: 'link'})],
      },
    }),
    defineArrayMember({type: 'editorialImage'}),
  ],
})

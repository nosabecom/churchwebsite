import {BinaryDocumentIcon} from '@sanity/icons/BinaryDocument'
import {defineField, defineType} from 'sanity'

export const migrationMetadata = defineType({
  name: 'migrationMetadata',
  title: 'Migration metadata',
  type: 'object',
  icon: BinaryDocumentIcon,
  options: {
    collapsible: true,
    collapsed: true,
  },
  fields: [
    defineField({
      name: 'sourceKey',
      title: 'Source key',
      description: 'Stable source-system key used to rerun the import safely.',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'sourcePath',
      title: 'Source path',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'sourceHash',
      title: 'Source hash',
      description: 'SHA-256 digest of the source file at the time of migration.',
      type: 'string',
      validation: (rule) => rule.required().regex(/^[a-f0-9]{64}$/i, {name: 'SHA-256 digest'}),
    }),
  ],
})

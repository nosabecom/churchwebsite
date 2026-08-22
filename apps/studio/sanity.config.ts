import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'
import {visionTool} from '@sanity/vision'
import {schemaTypes} from './schemaTypes'
import {newsletterIssueTemplates} from './schemaTypes/shared/sites'
import {structure} from './structure'

const projectId = process.env.SANITY_STUDIO_PROJECT_ID
const dataset = process.env.SANITY_STUDIO_DATASET

if (!projectId || !dataset) {
  throw new Error('Missing SANITY_STUDIO_PROJECT_ID or SANITY_STUDIO_DATASET')
}

export default defineConfig({
  name: 'default',
  title: 'rccgcornerstone',

  projectId,
  dataset,

  plugins: [structureTool({structure}), visionTool()],

  schema: {
    types: schemaTypes,
    templates: (previousTemplates) => [
      ...previousTemplates.filter(
        ({schemaType}) => schemaType !== 'newsletterIssue' && schemaType !== 'event',
      ),
      ...newsletterIssueTemplates,
    ],
  },
})

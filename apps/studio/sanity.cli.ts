import {defineCliConfig} from 'sanity/cli'

const projectId = process.env.SANITY_STUDIO_PROJECT_ID
const dataset = process.env.SANITY_STUDIO_DATASET

if (!projectId || !dataset) {
  throw new Error('Missing SANITY_STUDIO_PROJECT_ID or SANITY_STUDIO_DATASET')
}

export default defineCliConfig({
  api: {
    projectId,
    dataset,
  },
  typegen: {
    enabled: true,
    path: [
      '../churchmain/src/**/*.{ts,tsx,js,jsx,astro}',
      '../womanexcel/src/**/*.{ts,tsx,js,jsx,astro}',
    ],
    schema: 'schema.json',
    generates: '../churchmain/src/sanity.types.ts',
    overloadClientMethods: true,
  },
})

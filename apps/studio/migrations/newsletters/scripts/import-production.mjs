import {createClient} from '@sanity/client'

import {assertProductionDataset, runNewsletterImport, SANITY_API_VERSION} from '../lib/import.mjs'

function argumentValue(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

const confirmedDataset = argumentValue('--confirm-production-dataset')
const acknowledgement = argumentValue('--acknowledge-production-import')
const projectId = process.env.SANITY_STUDIO_PROJECT_ID
const dataset = process.env.SANITY_STUDIO_DATASET
const token = process.env.SANITY_AUTH_TOKEN

if (!projectId || !dataset || !token) {
  throw new Error(
    'SANITY_STUDIO_PROJECT_ID, SANITY_STUDIO_DATASET, and SANITY_AUTH_TOKEN are required',
  )
}
assertProductionDataset(dataset, confirmedDataset, acknowledgement)

const client = createClient({
  projectId,
  dataset,
  token,
  apiVersion: SANITY_API_VERSION,
  useCdn: false,
  perspective: 'raw',
})

console.log(JSON.stringify(await runNewsletterImport(client, dataset), null, 2))

import {createClient} from '@sanity/client'

import {assertSafeDataset, runNewsletterImport, SANITY_API_VERSION} from '../lib/import.mjs'

const confirmationIndex = process.argv.indexOf('--confirm-review-dataset')
const confirmedDataset = confirmationIndex >= 0 ? process.argv[confirmationIndex + 1] : undefined
const projectId = process.env.SANITY_STUDIO_PROJECT_ID
const dataset = process.env.SANITY_STUDIO_DATASET
const token = process.env.SANITY_AUTH_TOKEN

if (!projectId || !dataset || !token) {
  throw new Error(
    'SANITY_STUDIO_PROJECT_ID, SANITY_STUDIO_DATASET, and SANITY_AUTH_TOKEN are required',
  )
}
assertSafeDataset(dataset, confirmedDataset)

const client = createClient({
  projectId,
  dataset,
  token,
  apiVersion: SANITY_API_VERSION,
  useCdn: false,
  perspective: 'raw',
})

console.log(JSON.stringify(await runNewsletterImport(client, dataset), null, 2))

import {getCliClient} from 'sanity/cli'

import {assertSafeDataset, runNewsletterImport, SANITY_API_VERSION} from '../lib/import.mjs'

const confirmationIndex = process.argv.indexOf('--confirm-review-dataset')
const confirmedDataset = confirmationIndex >= 0 ? process.argv[confirmationIndex + 1] : undefined
const dataset = process.env.SANITY_STUDIO_DATASET

assertSafeDataset(dataset, confirmedDataset)

const client = getCliClient({apiVersion: SANITY_API_VERSION})
console.log(JSON.stringify(await runNewsletterImport(client, dataset), null, 2))

import {transformAll, validateDocuments} from '../lib/core.mjs'

const report = await validateDocuments(await transformAll())
console.log(JSON.stringify(report, null, 2))
if (!report.ok) process.exitCode = 1

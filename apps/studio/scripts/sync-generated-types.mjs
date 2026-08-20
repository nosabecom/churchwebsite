import {copyFile} from 'node:fs/promises'

await copyFile('../churchmain/src/sanity.types.ts', '../womanexcel/src/sanity.types.ts')

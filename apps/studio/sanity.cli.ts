import {defineCliConfig} from 'sanity/cli'

export default defineCliConfig({
  api: {
    projectId: 'qd5xjyx2',
    dataset: 'production',
  },
  typegen: {
    enabled: true,
    path: '../churchmain/src/**/*.{ts,tsx,js,jsx,astro}',
    schema: 'schema.json',
    generates: '../churchmain/src/sanity.types.ts',
    overloadClientMethods: true,
  },
})

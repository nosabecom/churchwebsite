# Newsletter deployment automation

Sanity is the canonical newsletter source when `PUBLIC_SANITY_NEWSLETTERS_ENABLED=true`. A published
newsletter event invokes `functions/route-site-deploy`, which reads the required `site` field and calls
only that site's Vercel deploy hook. Church Main content cannot deploy Woman Excel, and Woman Excel
content cannot deploy Church Main.

The function is declared in `sanity.blueprint.ts`. Sanity delivers authenticated internal document
events directly to the function, so there is no public inbound webhook endpoint or signature secret to
maintain. The Vercel deploy-hook URLs are credentials and exist only in the deployed function's
environment.

## One-time setup per dataset

Use a separate Blueprint stack for `development` and `production`. Point the development function's
hooks at the intended Vercel preview branches; point the production function's hooks at the production
branches. Never reuse a production hook in the development stack.

```sh
export SANITY_PROJECT_ID=<project-id>
export SANITY_DATASET=development
npx sanity@latest blueprints init .
npx sanity@latest blueprints plan
npx sanity@latest blueprints deploy -m "Route development content deployments"
pnpm blueprint:configure:churchmain
pnpm blueprint:configure:womanexcel
npx sanity@latest blueprints info
```

Sanity accepts Function environment variables only after the Function exists, so do not publish a
development newsletter between the initial Blueprint deployment and the hook configuration. Both site
helpers prompt without echoing the URL, validate the Vercel deploy-hook shape, refuse any dataset other
than `development`, and list only configured key names afterward. They never write secrets to disk.

On Windows PowerShell, configure each site with:

```powershell
pnpm blueprint:configure:churchmain:windows
pnpm blueprint:configure:womanexcel:windows
```

Repeat with `SANITY_DATASET=production` and the production stack only after review. The local
`.sanity/blueprint.config.json` selects a stack and is intentionally ignored by Git. Use `--stack` or
`SANITY_BLUEPRINT_STACK_ID` whenever more than one local operator shares the repository.

Do not paste deploy-hook URLs into Git, Linear, logs, `PUBLIC_` variables, or the Sanity Studio
configuration. Vercel builds of the private production dataset separately require the server-only
Viewer token documented in `sanity-foundation.md`; that token is not used by this function.

## Event behavior

- Published create, update, delete, unpublish, and republish events are eligible. Draft edits are not.
- The projected Delta-GROQ operation is part of the dedupe key, so an unpublish cannot be mistaken for
  a redelivery of the preceding published revision.
- `newsletterIssue` is currently the only project-owned document type. Add future site-owned types to
  `SITE_OWNED_DOCUMENT_TYPES` in `functions/route-site-deploy/routing.ts`; a routing test is required.
- Each site has its own path-hidden operational `deploy.state-<site>` document. The state type is deliberately
  excluded from the event filter, preventing recursive invocations.
- Events are debounced for five seconds per site using a durable Content Lake state document. Only the
  most recent event in a burst triggers a hook, and the resulting Vercel build reads the latest
  published dataset state when it executes.
- Re-delivery of an already-triggered document revision is ignored. A failed revision remains retryable.
- A hook is attempted three times with a six-second timeout per attempt. A final timeout, non-2xx, or
  network failure is recorded, the lease is released, and the function throws so the failure appears
  in Sanity Function logs and can be retried. A `triggering` lease older than 25 seconds is also treated
  as retryable in case the function runtime was interrupted before it could record the failure.

## Verification

For both datasets and both sites:

1. Publish an issue and confirm exactly the owning site's Vercel project starts a deployment.
2. Publish several edits within five seconds and confirm they coalesce into one deployment.
3. Unpublish the issue and confirm its route disappears after the owning-site deployment.
4. Republish it and confirm the same route returns with the current SEO, image ratio, Portable Text,
   related link, and issue ordering.
5. Temporarily use an invalid review hook, confirm three attempts and a visible failed state/log, restore
   the hook, then republish and confirm recovery.
6. Confirm a successful empty Sanity result renders the site's empty state and does not restore
   Markdown content.

Run the local coverage before deploying infrastructure:

```sh
pnpm --filter @churchwebsite/route-site-deploy test
pnpm --filter @churchwebsite/route-site-deploy build
pnpm --filter @churchwebsite/newsletter-migration test
pnpm typegen:check
pnpm build
```

During a development publish test, stream the deployed Function logs without manually exporting the
Blueprint variables. Use the command for the current terminal:

```sh
# Linux or macOS
pnpm blueprint:logs:development
```

```powershell
# Windows PowerShell
pnpm blueprint:watch:development:windows
```

The Windows watcher polls the durable Church Main deployment-state document instead of Sanity's
streaming-log socket, which can terminate unexpectedly on Windows. It reports the latest operation,
document, hook HTTP status, and any recorded failure while continuing through transient read errors.

## Recovery and rollback

Inspect failures with `npx sanity@latest functions logs route-site-deploy`. Fix the selected function
environment or Vercel hook, then republish the affected issue or invoke the hook manually. Do not delete
the dataset or content to retry a deployment.

The configure helpers upload hook URLs to the Sanity Function; they do not save them in a PowerShell
profile. To disconnect a development site, remove its Function variable from the development stack:

```powershell
npx --yes sanity@latest functions env remove route-site-deploy CHURCH_MAIN_VERCEL_DEPLOY_HOOK_URL --stack ST-ggvrshfmum
npx --yes sanity@latest functions env remove route-site-deploy WOMAN_EXCEL_VERCEL_DEPLOY_HOOK_URL --stack ST-ggvrshfmum
```

That stops the Function from calling the URL but does not revoke the Deploy Hook itself. Delete the
matching hook under the Vercel project's **Settings → Git → Deploy Hooks** to invalidate the URL fully.

Before production parity sign-off, rollback one site by setting its
`PUBLIC_SANITY_NEWSLETTERS_ENABLED=false` and redeploying that Vercel project. This is an explicit
whole-source rollback; enabled Sanity builds never fall back automatically. After both production sites
pass the final QA checklist, remove the Markdown sources and rollback flag in a follow-up change.

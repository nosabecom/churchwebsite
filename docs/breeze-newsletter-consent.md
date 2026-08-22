# Verified Breeze newsletter preference workflow

Breeze remains the source of truth for people, newsletter consent, Do Not Email status, and the
active recipient tag. Sanity contains only public newsletter issues. Subscriber details,
verification state, consent, recipient lists, and Breeze credentials must never be stored in Sanity
or exposed to browser code.

The two newsletter pages use the shared first-party form from `@churchwebsite/ui`. Each Vercel
project exposes the same two server-only functions:

```text
POST /api/newsletter-preferences/request
GET  /api/newsletter-preferences/verify?token=...  # confirmation page
POST /api/newsletter-preferences/verify            # one-time apply
```

## End-to-end protocol

1. The visitor enters first name, last name, email, subscribe/opt-out preference, and explicit
   consent on either website.
2. The request function validates the same-origin request and input, checks a honeypot, and applies
   separate HMAC-keyed limits for the client IP and normalized email.
3. The function creates a cryptographically random token. Only an HMAC of the token is used in its
   Redis key; the request payload is encrypted with AES-256-GCM and expires after 15 minutes by
   default.
4. Resend delivers a single-use verification link. Its idempotency key is the non-PII request ID.
5. Opening the link shows a server-rendered confirmation page but does not consume the token or
   change Breeze. This protects against email-security scanners that automatically visit links.
6. An explicit confirmation `POST` atomically consumes the Redis token before any Breeze write.
7. The server queries Breeze with `filter_json` using the account's email profile-field ID. The API
   key never reaches the browser.
8. Exactly one result is updated. Zero results follow the approved create-or-review policy. Two or
   more results are always routed to review; the website never chooses between shared-email profiles,
   even when one submitted name appears to match.
9. The user sees a neutral result that does not disclose whether the email or a matching profile
   exists. Operational logs contain request IDs and statuses, not names or email addresses.

A Redis-backed account-wide gate admits at most eight verification operations per minute by default.
Each operation can use up to two Breeze requests, leaving room under Breeze's documented 20-request-
per-minute API limit for field discovery and operational checks. Overflow is sent to staff review
instead of retrying aggressively.

The application-level token encryption is defense in depth for the short-lived Redis record. Review
records are encrypted the same way and expire after seven days by default.

## Breeze configuration

Use these canonical values unless an authenticated Breeze administrator confirms an approved
existing equivalent:

| Item             | Canonical value                       |
| ---------------- | ------------------------------------- |
| Profile field    | `Newsletter communication preference` |
| Field type       | Multiple Choice                       |
| Opt-in option    | `Subscribe me to church newsletters`  |
| Opt-out option   | `Do not send me church newsletters`   |
| Active Smart Tag | `Newsletter - Active Subscribers`     |

Before launch:

1. Record the membership of any existing newsletter tag before changing it.
2. Confirm or create the multiple-choice preference field and both options.
3. Configure the Smart Tag to select the opt-in value and remove profiles that no longer match.
4. Set the numeric email field, preference field, and option IDs in the environment. The integration
   can discover one exact canonical-name match through `/api/profile`, but explicit IDs avoid an
   extra API request and prevent a later rename from interrupting the workflow.
5. Decide whether a verified opt-in with zero matches may create a minimal Breeze profile. Keep
   `BREEZE_CREATE_MISSING_SUBSCRIBERS=false` until the client explicitly approves creation.

The service never clears Breeze's Do Not Email value. A newsletter opt-in may update the dedicated
preference field, but an existing Do Not Email suppression continues to win. A separate, explicitly
approved re-subscription process is required if staff intend to clear that suppression.

## Match handling

| Breeze email result | Behaviour                                                                                                                                                      |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Zero + subscribe    | Create a minimal verified profile only when `BREEZE_CREATE_MISSING_SUBSCRIBERS=true`; otherwise encrypt the request for staff review and send a review notice. |
| Zero + unsubscribe  | Make no Breeze profile and return the same neutral verified result.                                                                                            |
| Exactly one         | Update only `Newsletter communication preference` using `/api/people/update`.                                                                                  |
| Two or more         | Never guess. Store an encrypted review record and email the configured staff reviewer.                                                                         |
| Truncated result    | Treat as ambiguous and route to review.                                                                                                                        |

A first and last name are collected to help staff review and to create an approved missing
subscriber. They are not treated as authentication for a shared email address.

## Server-only environment

All local values live in the repository-root `.env.development`, copied from `.env.example`. Do not
prefix any of these values with `PUBLIC_` or `SANITY_STUDIO_`. Configure the same values separately
in both Vercel projects for Preview and Production as appropriate.

Required groups:

- `NEWSLETTER_ALLOWED_ORIGINS`, a comma-separated list containing only complete origins. Production
  should contain the two canonical HTTPS website origins; local development may use ports 4321 and 1234.
- `NEWSLETTER_VERIFICATION_SECRET`, at least 32 randomly generated characters. Rotating it
  invalidates outstanding tokens and makes existing review records unreadable.
- `BREEZE_SUBDOMAIN` and `BREEZE_API_KEY`, plus the profile field and option IDs or exact canonical
  names.
- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. The legacy Vercel KV names are also
  accepted.
- `RESEND_API_KEY`, `NEWSLETTER_FROM_EMAIL` on a verified sender domain, and
  `NEWSLETTER_REVIEW_EMAIL`.

The optional TTL and rate variables in `.env.example` are bounded in code and fail closed when set to
invalid values.

## External service setup

### Upstash Redis

Create one Redis database shared by both website deployments. Restrict its token to the deployed
projects, rotate it if exposed, and do not inspect or copy encrypted values into issue trackers.
The integration uses atomic `SET ... NX`, `GETDEL`, expiring counters, and expiring review records.

### Resend

Verify the sender domain, create a sending-only API key, and configure the client-approved From and
review addresses. Verification email is transactional; it is not a newsletter campaign. Resend
receives the destination address to deliver that message, while Breeze remains the consent source of
truth.

### Vercel

Each app has its own `api/newsletter-preferences` directory because the repository deploys Church
Main and Woman Excel as separate Vercel projects. Add every server secret to both projects. The
static Astro build does not read or expose them.

## Staff review

Review notices contain the verified address, submitted name, requested preference, reason, and
request ID. Staff must:

1. Search Breeze for every profile using that email.
2. Confirm which person made the request through an approved channel; do not rely on the submitted
   name alone.
3. Update only the confirmed profile's newsletter preference.
4. Apply Do Not Email to every relevant shared-address profile when the address must receive no bulk
   email.
5. Record completion in the team's access-controlled communications log. The encrypted Redis review
   record expires automatically and is not a permanent consent ledger.

## Launch test matrix

Use designated test profiles and non-production email addresses.

| Path                                 | Expected result                                                                                                |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Invalid fields or missing consent    | The first-party form identifies the field and no token or email is created.                                    |
| Disallowed request origin            | The API returns 403 and performs no storage, email, or Breeze operation.                                       |
| Honeypot                             | A neutral response is returned without sending email.                                                          |
| Rate limit                           | The same neutral response is returned without revealing the limit or Breeze membership.                        |
| Link scanner visits confirmation URL | A confirmation page loads and no Breeze write or token consumption occurs.                                     |
| Verification replay or expiry        | The confirmation is rejected and no Breeze write occurs.                                                       |
| One existing profile                 | The dedicated preference field changes to the requested option.                                                |
| Shared email                         | No profile changes automatically; encrypted review storage and the staff notice are created.                   |
| Zero-match opt-in, creation disabled | No profile is created; staff review is queued.                                                                 |
| Zero-match opt-in, creation enabled  | One minimal profile is created with name, verified email, and preference.                                      |
| Zero-match opt-out                   | No profile is created and the response remains neutral.                                                        |
| Breeze, Redis, or Resend failure     | The operation fails closed, exposes no credential or membership result, and gives the visitor a retry message. |
| Do Not Email profile                 | The preference may update, but Do Not Email remains set and bulk delivery stays suppressed.                    |

Record the live test date, tester, field/option IDs, environment, and outcome. Do not enable the form
for launch until a second staff member confirms the Smart Tag and all rows pass.

## References

- [Breeze API reference](https://app.breezechms.com/api)
- [Breeze API custom development](https://support.breezechms.com/hc/en-us/articles/360001324153-API-Advanced-Custom-Development)
- [Upstash Redis REST API](https://upstash.com/docs/redis/features/restapi)
- [Resend send-email API](https://resend.com/docs/api-reference/emails/send-email)
- [Vercel Node.js Functions](https://vercel.com/docs/functions/runtimes/node-js)

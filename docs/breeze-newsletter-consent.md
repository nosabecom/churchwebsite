# Breeze newsletter consent workflow

Breeze is the source of truth for people, newsletter consent, Do Not Email status, and the active
recipient tag. Sanity owns only the public newsletter issues. Do not copy names, email addresses,
form entries, consent values, or Breeze tags into Sanity.

The repository links both websites to one public Breeze-hosted form. An authenticated Breeze
administrator must complete and verify the account-side setup below before the link is enabled in a
deployed environment.

## Canonical Breeze configuration

Use these names and values consistently so staff can identify the correct field and recipient tag:

| Item             | Canonical value                           |
| ---------------- | ----------------------------------------- |
| Profile field    | `Newsletter communication preference`     |
| Field type       | Multiple Choice                           |
| Opt-in option    | `Subscribe me to church newsletters`      |
| Opt-out option   | `Do not send me church newsletters`       |
| Active Smart Tag | `Newsletter - Active Subscribers`         |
| Public form      | `Newsletter subscription and preferences` |

Before creating anything, search Breeze for an equivalent field, tag, or form. Prefer confirming and
renaming an approved existing item over creating a duplicate. Record any approved different names in
this document and update staff training before launch.

1. Export or otherwise record the membership of any existing newsletter tag before changing it.
2. In **Account Settings > Profile Fields**, confirm or create the multiple-choice profile field and
   its two options. Option text, field type, spelling, and option order must match the form exactly.
3. In **Forms**, confirm or create a blank form with required **Name** and **Email** fields plus the
   matching required preference field. Do not request unrelated personal data.
4. Configure a plain-language confirmation page and confirmation email. State that the request was
   received and may require staff review before it takes effect.
5. In **Account Settings > Automations**, configure a Smart Tag whose filter selects the opt-in value
   and assigns `Newsletter - Active Subscribers`. Enable removal of profiles that no longer match so
   the tag remains the active send list. Breeze runs Smart Tag tasks immediately on creation/update
   and then hourly.
6. Review every pre-existing recipient before enabling removal. Set the opt-in profile field first or
   the automation can remove legitimate recipients from the tag.
7. In **Share Form**, copy the public **Form Address**. Do not use an API endpoint, API key, session
   URL, or a staff-only Breeze URL.
8. Add the form address to the root `.env.development` for local testing:

   ```dotenv
   PUBLIC_BREEZE_NEWSLETTER_FORM_URL=https://YOUR_SUBDOMAIN.breezechms.com/form/YOUR_NEWSLETTER_FORM_SLUG
   ```

   The development and local build commands for both Astro apps load this root file, and both apps set
   Vite's `envDir` to the repository root. Set the same public URL in each hosted site's deployment
   environment. This variable is public by design and must contain only the hosted form address.
   Breeze API credentials must never use a `PUBLIC_` prefix or appear in browser code.

## Entry review and consent handling

- Breeze matches form entries to profiles using Name plus Email and/or Address. Exact matching of the
  preference field name, type, and option order is required before form values can update profiles.
- Review unconnected entries at least daily during launch. Connect a clearly matching entry to the
  existing profile; otherwise create a new profile only after checking for duplicates.
- Treat the submitted preference as profile-specific. Never infer that one person's opt-in applies to
  a spouse, family member, or another profile using the same address.
- An opt-out removes the profile from the active Smart Tag when the automation runs. Staff must also
  mark the email **Do Not Email** on that profile. Smart Tag removal and Do Not Email are separate
  safeguards.
- Breeze sends bulk email by profile, not by unique address. If an address appears on multiple
  profiles, **Do Not Email must be selected on every profile sharing that address** to stop all bulk
  messages to it. Search for the address before closing an opt-out request.
- Do Not Email blocks bulk messages sent through the Action Panel, but not every individual or
  system-generated message. Do not use one-to-one email to work around a newsletter opt-out.
- Keep Breeze's built-in **Manage Email Preferences** link in every bulk email. Also include the public
  preferences form when using an approved delivery provider.

## Staff publishing and send workflow

1. Author and review the issue under the correct site-owned newsletter template in Sanity Studio.
2. Publish it in Sanity. Confirm that the owning website deployment succeeds and that the public issue
   page is correct before sending email.
3. In Breeze, open the locked `Newsletter - Active Subscribers` Smart Tag. Spot-check that recent
   opt-ins are present, opt-outs are absent, and shared-address requests were handled on every profile.
4. Select that tag—not an exported spreadsheet, old static tag, or all people—as the recipients.
5. Compose or update the approved email template, link to the published Sanity-backed issue, preserve
   Breeze's Manage Email Preferences link, send a test message, and verify mobile and desktop output.
6. Send or schedule the message through Breeze or the approved delivery provider. Record the issue
   URL, recipient tag, sender, and send date in the team's normal communications log.

No member or subscriber list should be downloaded for routine newsletter sending. If an approved
provider requires a sync, it must be server-to-server, access-controlled, documented separately, and
must preserve Breeze as the consent source of truth.

## Launch test matrix

Use designated test profiles and non-production email addresses. Delete test form entries or clearly
label the profiles when verification is complete.

| Path                        | Test                                                                              | Expected result                                                                                                                                                   |
| --------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Website link                | Open the preferences CTA from Church Main and Woman Excel on mobile and desktop   | The HTTPS Breeze form opens in a new tab; no email address or credential passes through either site                                                               |
| Validation                  | Submit with required Name, Email, or preference missing and with an invalid email | Breeze keeps the form open, identifies the invalid field, and creates no completed entry                                                                          |
| Subscribe, existing profile | Submit matching Name and Email with the opt-in value                              | Entry connects to the intended profile, the profile field is opt-in, and the Smart Tag contains it after the automation runs                                      |
| Subscribe, new person       | Submit an email not present in Breeze                                             | Entry is retained for review; staff can create one non-duplicate profile, connect it, and confirm tag membership                                                  |
| Opt out                     | Change an opted-in test profile to the opt-out value                              | Profile leaves the active tag after the automation runs; staff marks Do Not Email and a bulk test excludes it                                                     |
| Shared email                | Opt out one test profile whose address appears on another profile                 | Staff finds both profiles, applies the requested profile-specific preference, and marks Do Not Email on every profile when the address must receive no bulk email |
| Success                     | Submit a valid change                                                             | The configured confirmation page and email clearly acknowledge receipt without promising an instant update                                                        |
| Error                       | Disable a duplicate test form or simulate an unavailable form before launch       | The failure is understandable and gives the communications contact or a retry path; no site credential is exposed                                                 |
| Send                        | Send a test newsletter to a test-only tag                                         | Correct issue URL renders, the preferences links work, and Do Not Email profiles receive no bulk message                                                          |

Record the test date, tester, Breeze field/form/tag names, and result for every row. Do not launch the
website links until all rows pass and a second staff member confirms the active tag selection.

## References

- [Creating an unsubscribe form for Breeze newsletters](https://support.breezechms.com/hc/en-us/articles/360039356853-Creating-an-Unsubscribe-Form-for-Breeze-Newsletters)
- [Updating people from form entries](https://support.breezechms.com/hc/en-us/articles/360005211394-Updating-People-from-Form-Entries)
- [Using Smart Tags](https://support.breezechms.com/hc/en-us/articles/360006051114-Using-Smart-Tags)
- [Unsubscribing a person from bulk texts and emails](https://support.breezechms.com/hc/en-us/articles/360003791073-Unsubscribing-a-Person-From-Bulk-Texts-and-Emails)
- [Sharing a form](https://support.breezechms.com/hc/en-us/articles/360001335914-Sharing-a-Form)

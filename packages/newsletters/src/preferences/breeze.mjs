import { chooseBreezeMatch } from "./validation.mjs";

function assertNumericId(value, label) {
  if (!/^\d+$/.test(value ?? "")) throw new Error(`${label} must be a numeric Breeze ID.`);
  return value;
}

function normalizeLabel(value) {
  return String(value ?? "").trim().toLocaleLowerCase("en-CA");
}

function flattenProfileFields(sections) {
  return Array.isArray(sections)
    ? sections.flatMap((section) => (Array.isArray(section?.fields) ? section.fields : []))
    : [];
}

function uniqueByLabel(items, label, description) {
  const matches = items.filter((item) => normalizeLabel(item?.name) === normalizeLabel(label));
  if (matches.length !== 1) {
    throw new Error(`Breeze ${description} must have exactly one match for "${label}".`);
  }
  return matches[0];
}

export function createBreezeClient({
  subdomain,
  apiKey,
  emailFieldId,
  preferenceFieldId,
  subscribeOptionId,
  unsubscribeOptionId,
  emailFieldName = "Email",
  preferenceFieldName = "Newsletter communication preference",
  subscribeOptionName = "Subscribe me to church newsletters",
  unsubscribeOptionName = "Do not send me church newsletters",
  fetchImpl = fetch,
}) {
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(subdomain ?? "")) {
    throw new Error("BREEZE_SUBDOMAIN is invalid.");
  }
  if (!apiKey) throw new Error("BREEZE_API_KEY is required.");

  const baseUrl = `https://${subdomain}.breezechms.com/api`;
  let resolvedFieldsPromise;

  async function request(path, parameters = {}) {
    const url = new URL(`${baseUrl}${path}`);
    for (const [key, value] of Object.entries(parameters)) {
      if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
    }
    const response = await fetchImpl(url, {
      headers: {
        "Api-Key": apiKey,
        Accept: "application/json",
        "User-Agent": "churchwebsite-newsletter-preferences/1.0",
      },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error(`Breeze API request failed with status ${response.status}.`);
    try {
      return await response.json();
    } catch {
      throw new Error("Breeze API returned an invalid response.");
    }
  }

  async function discoverFields() {
    if (emailFieldId && preferenceFieldId && subscribeOptionId && unsubscribeOptionId) {
      return {
        emailFieldId: assertNumericId(emailFieldId, "BREEZE_EMAIL_FIELD_ID"),
        preferenceFieldId: assertNumericId(
          preferenceFieldId,
          "BREEZE_NEWSLETTER_PREFERENCE_FIELD_ID",
        ),
        subscribeOptionId: assertNumericId(
          subscribeOptionId,
          "BREEZE_NEWSLETTER_SUBSCRIBE_OPTION_ID",
        ),
        unsubscribeOptionId: assertNumericId(
          unsubscribeOptionId,
          "BREEZE_NEWSLETTER_UNSUBSCRIBE_OPTION_ID",
        ),
      };
    }

    const fields = flattenProfileFields(await request("/profile"));
    const emailField = emailFieldId
      ? { field_id: emailFieldId }
      : uniqueByLabel(
          fields.filter((field) => field?.field_type === "email"),
          emailFieldName,
          "email profile field",
        );
    const preferenceField = preferenceFieldId
      ? fields.find((field) => String(field?.field_id) === preferenceFieldId)
      : uniqueByLabel(fields, preferenceFieldName, "newsletter preference field");

    if (!preferenceField || preferenceField.field_type !== "multiple_choice") {
      throw new Error("The Breeze newsletter preference field must be Multiple Choice.");
    }
    const options = Array.isArray(preferenceField.options) ? preferenceField.options : [];
    const subscribeOption = subscribeOptionId
      ? { option_id: subscribeOptionId }
      : uniqueByLabel(options, subscribeOptionName, "newsletter subscribe option");
    const unsubscribeOption = unsubscribeOptionId
      ? { option_id: unsubscribeOptionId }
      : uniqueByLabel(options, unsubscribeOptionName, "newsletter unsubscribe option");

    return {
      emailFieldId: assertNumericId(String(emailField.field_id), "Breeze email field ID"),
      preferenceFieldId: assertNumericId(
        String(preferenceField.field_id),
        "Breeze newsletter preference field ID",
      ),
      subscribeOptionId: assertNumericId(
        String(subscribeOption.option_id),
        "Breeze subscribe option ID",
      ),
      unsubscribeOptionId: assertNumericId(
        String(unsubscribeOption.option_id),
        "Breeze unsubscribe option ID",
      ),
    };
  }

  function resolveFields() {
    resolvedFieldsPromise ??= discoverFields().catch((error) => {
      resolvedFieldsPromise = undefined;
      throw error;
    });
    return resolvedFieldsPromise;
  }

  async function lookupPeopleByEmail(email) {
    const fields = await resolveFields();
    const filter = { [fields.emailFieldId]: email };
    const people = await request("/people", {
      details: "1",
      limit: "10",
      filter_json: JSON.stringify(filter),
    });
    if (!Array.isArray(people)) throw new Error("Breeze people lookup was not an array.");
    return { people, truncated: people.length === 10 };
  }

  async function updatePreference(personId, preference) {
    const fields = await resolveFields();
    const optionId =
      preference === "subscribe" ? fields.subscribeOptionId : fields.unsubscribeOptionId;
    return await request("/people/update", {
      person_id: assertNumericId(String(personId), "Breeze person ID"),
      fields_json: JSON.stringify([
        {
          field_id: fields.preferenceFieldId,
          field_type: "radio",
          response: optionId,
        },
      ]),
    });
  }

  async function addSubscriber({ firstName, lastName, email, preference }) {
    const fields = await resolveFields();
    const optionId =
      preference === "subscribe" ? fields.subscribeOptionId : fields.unsubscribeOptionId;
    return await request("/people/add", {
      first: firstName,
      last: lastName,
      fields_json: JSON.stringify([
        {
          field_id: fields.emailFieldId,
          field_type: "email",
          response: true,
          details: { address: email },
        },
        {
          field_id: fields.preferenceFieldId,
          field_type: "radio",
          response: optionId,
        },
      ]),
    });
  }

  return {
    resolveFields,
    lookupPeopleByEmail,
    updatePreference,
    addSubscriber,
    chooseMatch(people, _firstName, _lastName, truncated = false) {
      if (truncated) return { kind: "ambiguous", count: people.length };
      return chooseBreezeMatch(people);
    },
  };
}

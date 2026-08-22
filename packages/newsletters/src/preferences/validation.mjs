const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;

export const NEWSLETTER_PREFERENCES = Object.freeze({
  subscribe: "subscribe",
  unsubscribe: "unsubscribe",
});

export function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function normalizeName(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function isValidName(value) {
  return (
    value.length >= 1 &&
    value.length <= 80 &&
    !CONTROL_CHARACTER_PATTERN.test(value)
  );
}

export function validatePreferenceSubmission(input) {
  const firstName = normalizeName(input?.firstName);
  const lastName = normalizeName(input?.lastName);
  const email = normalizeEmail(input?.email);
  const preference = input?.preference;
  const consent = input?.consent === "yes";
  const errors = {};

  if (!isValidName(firstName)) errors.firstName = "Enter your first name.";
  if (!isValidName(lastName)) errors.lastName = "Enter your last name.";
  if (
    !EMAIL_PATTERN.test(email) ||
    email.length > 254 ||
    CONTROL_CHARACTER_PATTERN.test(email)
  ) {
    errors.email = "Enter a valid email address.";
  }
  if (!Object.values(NEWSLETTER_PREFERENCES).includes(preference)) {
    errors.preference = "Choose a newsletter preference.";
  }
  if (!consent) {
    errors.consent = "Confirm that we may process this preference request.";
  }

  return {
    success: Object.keys(errors).length === 0,
    errors,
    data: {
      firstName,
      lastName,
      email,
      preference,
    },
  };
}

export function chooseBreezeMatch(people) {
  if (!Array.isArray(people) || people.length === 0) {
    return { kind: "none" };
  }
  if (people.length === 1) {
    return { kind: "match", person: people[0], matchedBy: "email" };
  }

  // A name is useful to staff reviewing a shared address, but it is not a
  // strong enough identifier to let the website choose between profiles.
  return { kind: "ambiguous", count: people.length };
}

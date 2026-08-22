function required(env, name) {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function optional(env, name) {
  return env[name]?.trim() || undefined;
}

function integer(env, name, fallback, minimum, maximum) {
  const raw = optional(env, name);
  const value = raw === undefined ? fallback : Number(raw);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}.`);
  }
  return value;
}

function origins(env) {
  const values = required(env, "NEWSLETTER_ALLOWED_ORIGINS")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const result = new Set();
  for (const value of values) {
    const url = new URL(value);
    if (!/^https?:$/.test(url.protocol) || url.pathname !== "/" || url.search || url.hash) {
      throw new Error("NEWSLETTER_ALLOWED_ORIGINS must contain origins only.");
    }
    result.add(url.origin);
  }
  return result;
}

export function loadNewsletterPreferencesConfig(env = process.env) {
  const verificationTtlSeconds = integer(
    env,
    "NEWSLETTER_VERIFICATION_TTL_SECONDS",
    900,
    300,
    3600,
  );
  return {
    allowedOrigins: origins(env),
    verificationSecret: required(env, "NEWSLETTER_VERIFICATION_SECRET"),
    verificationTtlSeconds,
    verificationExpiresMinutes: Math.ceil(verificationTtlSeconds / 60),
    reviewTtlSeconds: integer(env, "NEWSLETTER_REVIEW_TTL_SECONDS", 604800, 3600, 2592000),
    ipRateLimit: integer(env, "NEWSLETTER_IP_RATE_LIMIT", 5, 1, 100),
    ipRateWindowSeconds: integer(
      env,
      "NEWSLETTER_IP_RATE_WINDOW_SECONDS",
      900,
      60,
      86400,
    ),
    emailRateLimit: integer(env, "NEWSLETTER_EMAIL_RATE_LIMIT", 3, 1, 20),
    emailRateWindowSeconds: integer(
      env,
      "NEWSLETTER_EMAIL_RATE_WINDOW_SECONDS",
      3600,
      300,
      86400,
    ),
    breezeOperationRateLimit: integer(
      env,
      "NEWSLETTER_BREEZE_OPERATION_RATE_LIMIT",
      8,
      1,
      9,
    ),
    createMissingSubscribers:
      optional(env, "BREEZE_CREATE_MISSING_SUBSCRIBERS") === "true",
    redis: {
      url:
        optional(env, "UPSTASH_REDIS_REST_URL") ??
        required(env, "KV_REST_API_URL"),
      token:
        optional(env, "UPSTASH_REDIS_REST_TOKEN") ??
        required(env, "KV_REST_API_TOKEN"),
    },
    resend: {
      apiKey: required(env, "RESEND_API_KEY"),
      from: required(env, "NEWSLETTER_FROM_EMAIL"),
      reviewEmail: required(env, "NEWSLETTER_REVIEW_EMAIL"),
    },
    breeze: {
      subdomain: required(env, "BREEZE_SUBDOMAIN"),
      apiKey: required(env, "BREEZE_API_KEY"),
      emailFieldId: optional(env, "BREEZE_EMAIL_FIELD_ID"),
      preferenceFieldId: optional(env, "BREEZE_NEWSLETTER_PREFERENCE_FIELD_ID"),
      subscribeOptionId: optional(env, "BREEZE_NEWSLETTER_SUBSCRIBE_OPTION_ID"),
      unsubscribeOptionId: optional(env, "BREEZE_NEWSLETTER_UNSUBSCRIBE_OPTION_ID"),
      emailFieldName: optional(env, "BREEZE_EMAIL_FIELD_NAME") ?? "Email",
      preferenceFieldName:
        optional(env, "BREEZE_NEWSLETTER_PREFERENCE_FIELD_NAME") ??
        "Newsletter communication preference",
      subscribeOptionName:
        optional(env, "BREEZE_NEWSLETTER_SUBSCRIBE_OPTION_NAME") ??
        "Subscribe me to church newsletters",
      unsubscribeOptionName:
        optional(env, "BREEZE_NEWSLETTER_UNSUBSCRIBE_OPTION_NAME") ??
        "Do not send me church newsletters",
    },
  };
}

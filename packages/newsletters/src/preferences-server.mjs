export { createBreezeClient } from "./preferences/breeze.mjs";
export { loadNewsletterPreferencesConfig } from "./preferences/config.mjs";
export {
  createVerificationToken,
  decryptPreferencePayload,
  encryptPreferencePayload,
  hashOpaqueValue,
} from "./preferences/crypto.mjs";
export { createResendMailer } from "./preferences/email.mjs";
export { createNewsletterPreferenceHandlers } from "./preferences/handlers.mjs";
export { createRedisStore } from "./preferences/redis.mjs";
export { createNewsletterPreferenceService } from "./preferences/service.mjs";
export {
  NEWSLETTER_PREFERENCES,
  chooseBreezeMatch,
  normalizeEmail,
  normalizeName,
  validatePreferenceSubmission,
} from "./preferences/validation.mjs";

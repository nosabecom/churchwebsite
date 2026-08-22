import { createNewsletterPreferenceHandlers } from "@churchwebsite/newsletters/preferences-server";

const handlers = createNewsletterPreferenceHandlers();

export default {
  async fetch(request) {
    return await handlers.verify(request);
  },
};

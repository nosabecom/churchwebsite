import assert from "node:assert/strict";
import test from "node:test";

import { getSafeBreezeFormHref } from "../src/index.mjs";

test("accepts a public HTTPS Breeze hosted form URL", () => {
  assert.equal(
    getSafeBreezeFormHref(
      "  https://cornerstone.breezechms.com/form/newsletter-preferences?source=website  ",
    ),
    "https://cornerstone.breezechms.com/form/newsletter-preferences?source=website",
  );
});

test("rejects URLs that are not a Breeze hosted form", () => {
  const invalidUrls = [
    "http://cornerstone.breezechms.com/form/newsletter-preferences",
    "https://breezechms.com/form/newsletter-preferences",
    "https://cornerstone.breezechms.com/api/people",
    "https://cornerstone.breezechms.com/form/",
    "https://cornerstone.breezechms.com/form/newsletter/preferences",
    "https://cornerstone.breezechms.com.evil.example/form/newsletter-preferences",
    "https://api-key@cornerstone.breezechms.com/form/newsletter-preferences",
    "https://cornerstone.breezechms.com:8443/form/newsletter-preferences",
    "not a url",
    "",
  ];

  for (const url of invalidUrls) {
    assert.equal(getSafeBreezeFormHref(url), undefined, url);
  }
});

test("rejects non-string configuration", () => {
  assert.equal(getSafeBreezeFormHref(undefined), undefined);
  assert.equal(getSafeBreezeFormHref({}), undefined);
});

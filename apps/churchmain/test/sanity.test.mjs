import assert from "node:assert/strict";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

// Use Vite's SSR transform, as Astro does, to supply import.meta.env.
// All fixtures are local; no API calls or credentials are needed.
const server = await createServer({
  root: fileURLToPath(new URL("../", import.meta.url)),
  configFile: false,
  envDir: false,
  server: { middlewareMode: true, watch: null, ws: false },
  define: {
    "import.meta.env.PUBLIC_SANITY_PROJECT_ID": JSON.stringify("testproject"),
    "import.meta.env.PUBLIC_SANITY_DATASET": JSON.stringify("development"),
  },
});
after(() => server.close());

const {
  getSanityImageUrl,
  getSanityImageDimensions,
  getSanityImageObjectPosition,
} = await server.ssrLoadModule("/src/data/sanity-image.ts");
const { getChurchMainSanityClient } = await server.ssrLoadModule(
  "/src/data/sanity.ts",
);
const image = {
  asset: { _ref: "image-abcdef-2000x1000-jpg" },
  dimensions: { width: 2000, height: 1000 },
};

test("one-axis resizing uses the editor's crop for URL and intrinsic dimensions", () => {
  const cropped = {
    ...image,
    crop: { left: 0.25, right: 0.25, top: 0, bottom: 0 },
  };
  const url = new URL(getSanityImageUrl(cropped, { width: 1200 }));
  assert.equal(url.searchParams.get("rect"), "500,0,1000,1000");
  assert.equal(url.searchParams.get("w"), "1200");
  assert.equal(url.searchParams.get("auto"), "format");
  assert.deepEqual(getSanityImageDimensions(cropped, { width: 1200 }), {
    width: 1200,
    height: 1200,
  });
  assert.deepEqual(getSanityImageDimensions(cropped, { height: 600 }), {
    width: 600,
    height: 600,
  });
  assert.deepEqual(getSanityImageDimensions(cropped), {
    width: 1000,
    height: 1000,
  });
});

test("fixed-aspect crops follow an off-center hotspot", () => {
  const focused = {
    ...image,
    hotspot: { x: 0.8, y: 0.5, width: 0.1, height: 0.1 },
  };
  const url = new URL(getSanityImageUrl(focused, { width: 600, height: 600 }));
  assert.equal(url.searchParams.get("rect"), "1000,0,1000,1000");
  assert.equal(url.searchParams.get("fit"), "crop");
  assert.deepEqual(
    getSanityImageDimensions(focused, { width: 600, height: 600 }),
    { width: 600, height: 600 },
  );
});

test("fluid CSS cover crops use the hotspot relative to the delivered crop", () => {
  assert.equal(getSanityImageObjectPosition(image), "50% 50%");
  assert.equal(
    getSanityImageObjectPosition({
      ...image,
      crop: { left: 0.25, right: 0.25, top: 0, bottom: 0 },
      hotspot: { x: 0.625, y: 0.25, width: 0.1, height: 0.1 },
    }),
    "75% 25%",
  );
});

test("missing and malformed assets reach the fallback without crashing a build", () => {
  for (const source of [
    undefined,
    null,
    {},
    { asset: null },
    { asset: { _ref: null } },
    { asset: { _ref: "bad-ref" } },
  ]) {
    assert.equal(getSanityImageUrl(source, { width: 1200 }), undefined);
  }
  assert.deepEqual(getSanityImageDimensions({}), {});
  assert.deepEqual(
    getSanityImageDimensions({ dimensions: { width: 0, height: 1000 } }),
    {},
  );
  assert.deepEqual(getSanityImageDimensions(image, { width: 1200 }), {
    width: 1200,
    height: 600,
  });
});

test("server client uses published uncached reads and enforces production configuration", () => {
  const env = {
    PUBLIC_SANITY_PROJECT_ID: "testproject",
    PUBLIC_SANITY_DATASET: "development",
  };
  const config = getChurchMainSanityClient(env).config();
  assert.equal(config.useCdn, false);
  assert.equal(config.perspective, "published");
  assert.equal(config.apiVersion, "2026-08-13");
  assert.equal(config.token, undefined);
  assert.throws(() => getChurchMainSanityClient({}), /requires PUBLIC_SANITY/);
  assert.throws(
    () => getChurchMainSanityClient({ ...env, VERCEL_ENV: "production" }),
    /must be production/,
  );
  assert.throws(
    () =>
      getChurchMainSanityClient({
        ...env,
        PUBLIC_SANITY_DATASET: "production",
      }),
    /SANITY_API_READ_TOKEN is required/,
  );
  const production = getChurchMainSanityClient({
    ...env,
    PUBLIC_SANITY_DATASET: "production",
    VERCEL_ENV: "production",
    SANITY_API_READ_TOKEN: "test-read-token",
  }).config();
  assert.equal(production.dataset, "production");
  assert.equal(production.token, "test-read-token");
});

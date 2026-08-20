import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const sites = [
  {
    name: "Church Main",
    directory: "apps/churchmain/dist",
    requiredRoutes: ["/", "/contact/", "/ministries/women/", "/newsletters/"],
  },
  {
    name: "Woman Excel",
    directory: "apps/womanexcel/dist",
    requiredRoutes: ["/", "/contact/", "/newsletters/"],
  },
];

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function htmlFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const entryPath = path.join(directory, entry.name);
      return entry.isDirectory()
        ? htmlFiles(entryPath)
        : entry.name.endsWith(".html")
          ? [entryPath]
          : [];
    }),
  );
  return nested.flat();
}

function routeCandidates(directory, pathname) {
  const relativePath = decodeURIComponent(pathname).replace(/^\/+/, "");
  const direct = path.join(directory, relativePath);
  return pathname.endsWith("/")
    ? [path.join(direct, "index.html")]
    : [direct, path.join(direct, "index.html"), `${direct}.html`];
}

for (const site of sites) {
  const directory = path.join(repositoryRoot, site.directory);
  const failures = [];

  for (const route of site.requiredRoutes) {
    const candidates = await Promise.all(
      routeCandidates(directory, route).map(exists),
    );
    if (!candidates.some(Boolean)) {
      failures.push(`required route is missing: ${route}`);
    }
  }

  const files = await htmlFiles(directory);
  for (const file of files) {
    const html = await readFile(file, "utf8");
    const pagePath =
      `/${path.relative(directory, file).replaceAll(path.sep, "/")}`.replace(
        /index\.html$/,
        "",
      );
    const hrefs = [...html.matchAll(/\bhref=(?:"([^"]*)"|'([^']*)')/g)].map(
      (match) => (match[1] ?? match[2]).replaceAll("&amp;", "&"),
    );

    for (const href of hrefs) {
      if (!href || href.startsWith("#")) continue;

      let target;
      try {
        target = new URL(href, `https://routes.invalid${pagePath}`);
      } catch {
        failures.push(`${pagePath}: malformed href ${JSON.stringify(href)}`);
        continue;
      }
      if (target.origin !== "https://routes.invalid") continue;

      const candidates = routeCandidates(directory, target.pathname);
      const resolved = await Promise.all(candidates.map(exists));
      if (!resolved.some(Boolean)) {
        failures.push(
          `${pagePath}: unresolved internal href ${JSON.stringify(href)}`,
        );
      }
    }
  }

  if (site.name === "Church Main") {
    const womenPage = await readFile(
      path.join(directory, "ministries/women/index.html"),
      "utf8",
    );
    if (!womenPage.includes('href="https://www.womanexcel.com/"')) {
      failures.push(
        "Women's Ministry does not link to https://www.womanexcel.com/",
      );
    }
  }

  if (failures.length > 0) {
    throw new Error(
      `${site.name} static route verification failed:\n- ${failures.join("\n- ")}`,
    );
  }

  console.log(
    `${site.name}: ${files.length} generated pages and internal links verified`,
  );
}

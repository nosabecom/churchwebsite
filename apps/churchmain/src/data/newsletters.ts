import { getCollection, type CollectionEntry } from "astro:content";
import { createClient } from "@sanity/client";
import { defineQuery } from "groq";

import type { CHURCH_MAIN_NEWSLETTERS_QUERY_RESULT } from "../sanity.types";

const CHURCH_MAIN_SITE = "churchMain";
const SANITY_API_VERSION = "2026-08-13";

export const CHURCH_MAIN_NEWSLETTERS_QUERY = defineQuery(/* groq */ `
  *[
    _type == "newsletterIssue" &&
    site == "churchMain" &&
    defined(slug.current) &&
    defined(publishedAt)
  ] | order(publishedAt desc, _id) {
    _id,
    title,
    "slug": slug.current,
    publishedAt,
    issue,
    excerpt,
    coverImage {
      alt,
      decorative,
      "url": asset->url,
      "dimensions": asset->metadata.dimensions
    },
    relatedLink {
      label,
      href
    },
    seo {
      title,
      description
    },
    body[] {
      ...,
      _type == "editorialImage" => {
        alt,
        decorative,
        "url": asset->url,
        "dimensions": asset->metadata.dimensions
      }
    }
  }
`);

type MarkdownNewsletter = CollectionEntry<"newsletters">;
type SanityNewsletter = CHURCH_MAIN_NEWSLETTERS_QUERY_RESULT[number];

interface NewsletterBase {
  slug: string;
  title: string;
  publishedAt: Date;
  excerpt: string;
  issue?: number;
  coverImage?: {
    url: string;
    alt: string;
    decorative: boolean;
    width?: number;
    height?: number;
  };
  relatedLink?: {
    label: string;
    href: string;
  };
  seo: {
    title: string;
    description: string;
  };
}

export interface MarkdownNewsletterView extends NewsletterBase {
  source: "markdown";
  entry: MarkdownNewsletter;
}

export interface SanityNewsletterView extends NewsletterBase {
  source: "sanity";
  body: SanityNewsletter["body"];
}

export type Newsletter = MarkdownNewsletterView | SanityNewsletterView;

let newsletterPromise: Promise<Newsletter[]> | undefined;

function normalizeMarkdownNewsletter(entry: MarkdownNewsletter): MarkdownNewsletterView {
  return {
    source: "markdown",
    entry,
    slug: entry.id,
    title: entry.data.title,
    publishedAt: entry.data.publishedAt,
    excerpt: entry.data.excerpt,
    issue: entry.data.issue,
    coverImage: entry.data.image
      ? {
          url: entry.data.image,
          alt: entry.data.imageAlt,
          decorative: false,
        }
      : undefined,
    relatedLink: entry.data.link
      ? {
          label: "Related link",
          href: entry.data.link,
        }
      : undefined,
    seo: {
      title: entry.data.title,
      description: entry.data.excerpt,
    },
  };
}

function normalizeSanityNewsletter(newsletter: SanityNewsletter): SanityNewsletterView | undefined {
  if (!newsletter.slug || !newsletter.title || !newsletter.publishedAt || !newsletter.excerpt) {
    console.warn(`Skipping incomplete ${CHURCH_MAIN_SITE} newsletter ${newsletter._id}.`);
    return undefined;
  }

  const coverImage = newsletter.coverImage?.url
    ? {
        url: newsletter.coverImage.url,
        alt: newsletter.coverImage.decorative ? "" : (newsletter.coverImage.alt ?? ""),
        decorative: newsletter.coverImage.decorative ?? false,
        width: newsletter.coverImage.dimensions?.width,
        height: newsletter.coverImage.dimensions?.height,
      }
    : undefined;
  const relatedLink = newsletter.relatedLink?.href
    ? {
        label: newsletter.relatedLink.label || "Related link",
        href: newsletter.relatedLink.href,
      }
    : undefined;

  return {
    source: "sanity",
    slug: newsletter.slug,
    title: newsletter.title,
    publishedAt: new Date(newsletter.publishedAt),
    excerpt: newsletter.excerpt,
    issue: newsletter.issue ?? undefined,
    coverImage,
    relatedLink,
    seo: {
      title: newsletter.seo?.title || newsletter.title,
      description: newsletter.seo?.description || newsletter.excerpt,
    },
    body: newsletter.body,
  };
}

async function getMarkdownNewsletters(): Promise<Newsletter[]> {
  return (await getCollection("newsletters", ({ data }) => !data.draft))
    .map(normalizeMarkdownNewsletter)
    .sort(
      (a, b) =>
        b.publishedAt.valueOf() - a.publishedAt.valueOf() || a.slug.localeCompare(b.slug),
    );
}

async function loadNewsletters(): Promise<Newsletter[]> {
  const projectId = import.meta.env.PUBLIC_SANITY_PROJECT_ID;
  const dataset = import.meta.env.PUBLIC_SANITY_DATASET;
  const sanityEnabled = import.meta.env.PUBLIC_SANITY_NEWSLETTERS_ENABLED === "true";

  if (!sanityEnabled) {
    return getMarkdownNewsletters();
  }

  if (!projectId || !dataset) {
    console.warn("Church Main Sanity newsletters are enabled but not configured; using Markdown.");
    return getMarkdownNewsletters();
  }

  try {
    const client = createClient({
      projectId,
      dataset,
      apiVersion: SANITY_API_VERSION,
      useCdn: false,
      perspective: "published",
    });
    const result: CHURCH_MAIN_NEWSLETTERS_QUERY_RESULT = await client.fetch(
      CHURCH_MAIN_NEWSLETTERS_QUERY,
    );

    return result
      .map(normalizeSanityNewsletter)
      .filter((newsletter): newsletter is SanityNewsletterView => newsletter !== undefined);
  } catch (error) {
    console.warn("Unable to fetch Church Main newsletters from Sanity; using Markdown fallback.", error);
    return getMarkdownNewsletters();
  }
}

export function getNewsletters(): Promise<Newsletter[]> {
  newsletterPromise ??= loadNewsletters();
  return newsletterPromise;
}

export async function getLatestNewsletter(): Promise<Newsletter | undefined> {
  return (await getNewsletters())[0];
}

export function getNewsletterHref(newsletter: Newsletter | undefined): string {
  return newsletter ? `/newsletters/${newsletter.slug}/` : "/newsletters";
}

export function isExternalNewsletterLink(href: string): boolean {
  return /^https?:\/\//.test(href);
}

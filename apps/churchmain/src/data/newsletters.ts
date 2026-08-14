import { getCollection, type CollectionEntry } from "astro:content";
import {
  enforceSanityProductionConfig,
  getSafeNewsletterHref,
  isExternalNewsletterHref,
  loadNewsletterSource,
  memoizePromise,
} from "@churchwebsite/newsletters";
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
  ] | order(issue desc, publishedAt desc, slug.current asc) {
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

function normalizeMarkdownNewsletter(
  entry: MarkdownNewsletter,
): MarkdownNewsletterView {
  const relatedHref = getSafeNewsletterHref(entry.data.link);

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
          decorative: entry.data.imageAlt.length === 0,
        }
      : undefined,
    relatedLink: relatedHref
      ? {
          label: "Related link",
          href: relatedHref,
        }
      : undefined,
    seo: {
      title: entry.data.title,
      description: entry.data.excerpt,
    },
  };
}

function normalizeSanityNewsletter(
  newsletter: SanityNewsletter,
): SanityNewsletterView | undefined {
  if (
    !newsletter.slug ||
    !newsletter.title ||
    !newsletter.publishedAt ||
    !newsletter.excerpt
  ) {
    console.warn(
      `Skipping incomplete ${CHURCH_MAIN_SITE} newsletter ${newsletter._id}.`,
    );
    return undefined;
  }

  const coverImage = newsletter.coverImage?.url
    ? {
        url: newsletter.coverImage.url,
        alt: newsletter.coverImage.decorative
          ? ""
          : (newsletter.coverImage.alt ?? ""),
        decorative: newsletter.coverImage.decorative ?? false,
        width: newsletter.coverImage.dimensions?.width,
        height: newsletter.coverImage.dimensions?.height,
      }
    : undefined;
  const relatedHref = getSafeNewsletterHref(newsletter.relatedLink?.href);
  const relatedLink = relatedHref
    ? {
        label: newsletter.relatedLink?.label || "Related link",
        href: relatedHref,
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
        (b.issue ?? 0) - (a.issue ?? 0) ||
        b.publishedAt.valueOf() - a.publishedAt.valueOf() ||
        a.slug.localeCompare(b.slug),
    );
}

async function loadNewsletters(): Promise<Newsletter[]> {
  const projectId = import.meta.env.PUBLIC_SANITY_PROJECT_ID;
  const dataset = import.meta.env.PUBLIC_SANITY_DATASET;
  const token = import.meta.env.SANITY_API_READ_TOKEN;
  const sanityConfig =
    projectId && dataset ? { projectId, dataset, token } : undefined;
  const sanityEnabled =
    import.meta.env.PUBLIC_SANITY_NEWSLETTERS_ENABLED === "true";
  const productionSource = enforceSanityProductionConfig({
    enabled: sanityEnabled,
    deployment: import.meta.env.VERCEL_ENV,
    projectId,
    dataset,
    token,
    label: "Church Main",
  });

  return loadNewsletterSource({
    enabled: sanityEnabled,
    configured: Boolean(sanityConfig),
    loadMarkdown: getMarkdownNewsletters,
    loadSanity: async () => {
      if (!sanityConfig) throw new Error("Missing Sanity configuration.");
      const client = createClient({
        ...sanityConfig,
        apiVersion: SANITY_API_VERSION,
        useCdn: false,
        perspective: "published",
        token: sanityConfig.token,
      });
      const result: CHURCH_MAIN_NEWSLETTERS_QUERY_RESULT = await client.fetch(
        CHURCH_MAIN_NEWSLETTERS_QUERY,
      );

      return result
        .map(normalizeSanityNewsletter)
        .filter(
          (newsletter): newsletter is SanityNewsletterView =>
            newsletter !== undefined,
        );
    },
    missingConfigurationMessage:
      "Church Main Sanity newsletters are enabled but not configured; using Markdown.",
    fetchFailureMessage: productionSource
      ? "Unable to fetch Church Main newsletters from the private production dataset."
      : "Unable to fetch Church Main newsletters from Sanity; using Markdown fallback.",
    fallbackOnFetchFailure: !productionSource,
  });
}

const getCachedNewsletters = import.meta.env.DEV
  ? loadNewsletters
  : memoizePromise(loadNewsletters);

export function getNewsletters(): Promise<Newsletter[]> {
  return getCachedNewsletters();
}

export async function getLatestNewsletter(): Promise<Newsletter | undefined> {
  return (await getNewsletters())[0];
}

export function getNewsletterHref(newsletter: Newsletter | undefined): string {
  return newsletter ? `/newsletters/${newsletter.slug}/` : "/newsletters";
}

export function isExternalNewsletterLink(href: string): boolean {
  return isExternalNewsletterHref(href);
}

import {
  enforceSanityProductionConfig,
  getSafeNewsletterHref,
  isExternalNewsletterHref,
  loadNewsletterSource,
  memoizePromise,
} from "@churchwebsite/newsletters";
import { createClient } from "@sanity/client";
import { getCollection, render, type CollectionEntry } from "astro:content";
import { defineQuery } from "groq";

import type { WOMAN_EXCEL_NEWSLETTERS_QUERY_RESULT } from "../sanity.types";

export const WOMAN_EXCEL_NEWSLETTERS_QUERY = defineQuery(`
  *[_type == "newsletterIssue" && site == "womanExcel" && defined(slug.current) && defined(publishedAt)]
    | order(publishedAt desc, slug.current asc) {
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
      relatedLink { label, href },
      seo { title, description },
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

type SanityNewsletter = WOMAN_EXCEL_NEWSLETTERS_QUERY_RESULT[number];

export type Newsletter = {
  id: string;
  title: string;
  slug: string;
  publishedAt: Date;
  issue?: number;
  excerpt: string;
  coverImage?: {
    url: string;
    alt: string;
    decorative: boolean;
    width?: number;
    height?: number;
  };
  relatedLink?: { label?: string; href: string };
  seo?: { title?: string; description?: string };
  content:
    | { source: "sanity"; body: NonNullable<SanityNewsletter["body"]> }
    | { source: "markdown"; entry: CollectionEntry<"newsletters"> };
};

function fromSanity(newsletter: SanityNewsletter): Newsletter | undefined {
  if (
    !newsletter.title ||
    !newsletter.slug ||
    !newsletter.publishedAt ||
    !newsletter.excerpt
  ) {
    console.warn(
      `Skipping incomplete Woman Excel newsletter ${newsletter._id}`,
    );
    return undefined;
  }

  const dimensions = newsletter.coverImage?.dimensions;
  const relatedHref = getSafeNewsletterHref(newsletter.relatedLink?.href);
  return {
    id: newsletter._id,
    title: newsletter.title,
    slug: newsletter.slug,
    publishedAt: new Date(newsletter.publishedAt),
    issue: newsletter.issue ?? undefined,
    excerpt: newsletter.excerpt,
    coverImage: newsletter.coverImage?.url
      ? {
          url: newsletter.coverImage.url,
          alt: newsletter.coverImage.decorative
            ? ""
            : (newsletter.coverImage.alt ?? ""),
          decorative: newsletter.coverImage.decorative ?? false,
          width: dimensions?.width,
          height: dimensions?.height,
        }
      : undefined,
    relatedLink: relatedHref
      ? {
          label: newsletter.relatedLink?.label ?? undefined,
          href: relatedHref,
        }
      : undefined,
    seo: newsletter.seo
      ? {
          title: newsletter.seo.title ?? undefined,
          description: newsletter.seo.description ?? undefined,
        }
      : undefined,
    content: { source: "sanity", body: newsletter.body ?? [] },
  };
}

async function getMarkdownNewsletters(): Promise<Newsletter[]> {
  const entries = await getCollection("newsletters", ({ data }) => !data.draft);

  return entries
    .map((entry) => {
      const relatedHref = getSafeNewsletterHref(entry.data.link);

      return {
        id: entry.id,
        title: entry.data.title,
        slug: entry.id,
        publishedAt: entry.data.publishedAt,
        issue: entry.data.issue,
        excerpt: entry.data.excerpt,
        coverImage: entry.data.image
          ? {
              url: entry.data.image,
              alt: entry.data.imageAlt,
              decorative: entry.data.imageAlt.length === 0,
            }
          : undefined,
        relatedLink: relatedHref ? { href: relatedHref } : undefined,
        content: { source: "markdown" as const, entry },
      };
    })
    .sort(
      (a, b) =>
        b.publishedAt.valueOf() - a.publishedAt.valueOf() ||
        a.slug.localeCompare(b.slug),
    );
}

async function loadWomanExcelNewsletters(): Promise<Newsletter[]> {
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
    label: "Woman Excel",
  });

  return loadNewsletterSource({
    enabled: sanityEnabled,
    configured: Boolean(sanityConfig),
    loadMarkdown: getMarkdownNewsletters,
    loadSanity: async () => {
      if (!sanityConfig) throw new Error("Missing Sanity configuration.");
      const client = createClient({
        ...sanityConfig,
        apiVersion: "2026-08-13",
        useCdn: false,
        perspective: "published",
        token: sanityConfig.token,
      });
      const result = await client.fetch(WOMAN_EXCEL_NEWSLETTERS_QUERY);
      return result.flatMap((newsletter) => {
        const normalized = fromSanity(newsletter);
        return normalized ? [normalized] : [];
      });
    },
    missingConfigurationMessage:
      "Woman Excel Sanity newsletters are enabled but not configured; using Markdown.",
    fetchFailureMessage: productionSource
      ? "Unable to fetch Woman Excel newsletters from the private production dataset."
      : "Unable to load Woman Excel newsletters from Sanity; using Markdown.",
    fallbackOnFetchFailure: !productionSource,
  });
}

export const getWomanExcelNewsletters = import.meta.env.DEV
  ? loadWomanExcelNewsletters
  : memoizePromise(loadWomanExcelNewsletters);

export function isExternalNewsletterLink(href: string): boolean {
  return isExternalNewsletterHref(href);
}

export async function renderMarkdownNewsletter(newsletter: Newsletter) {
  if (newsletter.content.source !== "markdown") return undefined;
  return render(newsletter.content.entry);
}

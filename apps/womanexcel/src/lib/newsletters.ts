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
  if (!newsletter.title || !newsletter.slug || !newsletter.publishedAt || !newsletter.excerpt) {
    console.warn(`Skipping incomplete Woman Excel newsletter ${newsletter._id}`);
    return undefined;
  }

  const dimensions = newsletter.coverImage?.dimensions;
  return {
    id: newsletter._id,
    title: newsletter.title,
    slug: newsletter.slug,
    publishedAt: new Date(newsletter.publishedAt),
    issue: newsletter.issue ?? undefined,
    excerpt: newsletter.excerpt,
    coverImage:
      newsletter.coverImage?.url
        ? {
            url: newsletter.coverImage.url,
            alt: newsletter.coverImage.alt ?? "",
            decorative: newsletter.coverImage.decorative ?? false,
            width: dimensions?.width,
            height: dimensions?.height,
          }
        : undefined,
    relatedLink:
      newsletter.relatedLink?.href
        ? {
            label: newsletter.relatedLink.label ?? undefined,
            href: newsletter.relatedLink.href,
          }
        : undefined,
    seo:
      newsletter.seo
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
    .map((entry) => ({
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
      relatedLink: entry.data.link ? { href: entry.data.link } : undefined,
      content: { source: "markdown" as const, entry },
    }))
    .sort(
      (a, b) =>
        b.publishedAt.valueOf() - a.publishedAt.valueOf() || a.slug.localeCompare(b.slug),
    );
}

export async function getWomanExcelNewsletters(): Promise<Newsletter[]> {
  if (import.meta.env.PUBLIC_SANITY_NEWSLETTERS_ENABLED !== "true") {
    return getMarkdownNewsletters();
  }

  const projectId = import.meta.env.PUBLIC_SANITY_PROJECT_ID;
  const dataset = import.meta.env.PUBLIC_SANITY_DATASET;
  if (!projectId || !dataset) {
    console.warn("Woman Excel Sanity newsletters are enabled but not configured; using Markdown.");
    return getMarkdownNewsletters();
  }

  try {
    const client = createClient({
      projectId,
      dataset,
      apiVersion: "2026-08-13",
      useCdn: false,
      perspective: "published",
    });
    const result = await client.fetch(WOMAN_EXCEL_NEWSLETTERS_QUERY);
    return result.flatMap((newsletter) => {
      const normalized = fromSanity(newsletter);
      return normalized ? [normalized] : [];
    });
  } catch (error) {
    console.warn("Unable to load Woman Excel newsletters from Sanity; using Markdown.", error);
    return getMarkdownNewsletters();
  }
}

export async function renderMarkdownNewsletter(newsletter: Newsletter) {
  if (newsletter.content.source !== "markdown") return undefined;
  return render(newsletter.content.entry);
}

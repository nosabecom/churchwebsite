import {
  enforceSanityProductionConfig,
  getSafeNewsletterHref,
  isExternalNewsletterHref,
  memoizePromise,
} from "@churchwebsite/newsletters";
import { createClient } from "@sanity/client";
import { defineQuery } from "groq";

import type { WOMAN_EXCEL_NEWSLETTERS_QUERY_RESULT } from "../sanity.types";

export const WOMAN_EXCEL_NEWSLETTERS_QUERY = defineQuery(`
  *[_type == "newsletterIssue" && site == "womanExcel" && defined(slug.current) && defined(publishedAt)]
    | order(issue desc, publishedAt desc, slug.current asc) {
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
  body: NonNullable<SanityNewsletter["body"]>;
};

function fromSanity(newsletter: SanityNewsletter): Newsletter | undefined {
  if (
    !newsletter.title ||
    !newsletter.slug ||
    !newsletter.publishedAt ||
    !newsletter.excerpt ||
    !newsletter.body?.length
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
    body: newsletter.body,
  };
}

async function loadWomanExcelNewsletters(): Promise<Newsletter[]> {
  const projectId = import.meta.env.PUBLIC_SANITY_PROJECT_ID;
  const dataset = import.meta.env.PUBLIC_SANITY_DATASET;
  const token = import.meta.env.SANITY_API_READ_TOKEN;
  enforceSanityProductionConfig({
    deployment: import.meta.env.VERCEL_ENV,
    projectId,
    dataset,
    token,
    label: "Woman Excel",
  });

  if (!projectId || !dataset) {
    throw new Error(
      "Woman Excel requires PUBLIC_SANITY_PROJECT_ID and PUBLIC_SANITY_DATASET.",
    );
  }

  try {
    const client = createClient({
      projectId,
      dataset,
      apiVersion: "2026-08-13",
      useCdn: false,
      perspective: "published",
      token,
    });
    const result = await client.fetch(WOMAN_EXCEL_NEWSLETTERS_QUERY);
    return result.flatMap((newsletter) => {
      const normalized = fromSanity(newsletter);
      return normalized ? [normalized] : [];
    });
  } catch (error) {
    throw new Error("Unable to fetch Woman Excel newsletters from Sanity.", {
      cause: error,
    });
  }
}

export const getWomanExcelNewsletters = import.meta.env.DEV
  ? loadWomanExcelNewsletters
  : memoizePromise(loadWomanExcelNewsletters);

export function isExternalNewsletterLink(href: string): boolean {
  return isExternalNewsletterHref(href);
}

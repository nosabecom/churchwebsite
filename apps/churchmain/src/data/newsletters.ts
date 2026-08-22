import {
  getSafeNewsletterHref,
  isExternalNewsletterHref,
  memoizePromise,
} from "@churchwebsite/newsletters";
import { defineQuery } from "groq";

import { getChurchMainSanityClient } from "./sanity";
import {
  getSanityImageDimensions,
  getSanityImageUrl,
} from "./sanity-image";
import type { CHURCH_MAIN_NEWSLETTERS_QUERY_RESULT } from "../sanity.types";

const CHURCH_MAIN_SITE = "churchMain";
const COVER_IMAGE_WIDTH = 1536;

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
      "asset": { "_ref": asset._ref },
      crop,
      hotspot,
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
        "asset": { "_ref": asset._ref },
        crop,
        hotspot,
        "dimensions": asset->metadata.dimensions
      }
    }
  }
`);

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

export interface Newsletter extends NewsletterBase {
  body: SanityNewsletter["body"];
}

function normalizeSanityNewsletter(
  newsletter: SanityNewsletter,
): Newsletter | undefined {
  if (
    !newsletter.slug ||
    !newsletter.title ||
    !newsletter.publishedAt ||
    !newsletter.excerpt ||
    !newsletter.body?.length
  ) {
    console.warn(
      `Skipping incomplete ${CHURCH_MAIN_SITE} newsletter ${newsletter._id}.`,
    );
    return undefined;
  }

  const coverUrl = newsletter.coverImage
    ? getSanityImageUrl(newsletter.coverImage, { width: COVER_IMAGE_WIDTH })
    : undefined;
  const coverDimensions = newsletter.coverImage
    ? getSanityImageDimensions(newsletter.coverImage, {
        width: COVER_IMAGE_WIDTH,
      })
    : {};
  const coverImage =
    coverUrl && newsletter.coverImage
      ? {
          url: coverUrl,
          alt: newsletter.coverImage.decorative
            ? ""
            : (newsletter.coverImage.alt ?? ""),
          decorative: newsletter.coverImage.decorative ?? false,
          width: coverDimensions.width,
          height: coverDimensions.height,
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

async function loadNewsletters(): Promise<Newsletter[]> {
  const client = getChurchMainSanityClient();

  try {
    const result: CHURCH_MAIN_NEWSLETTERS_QUERY_RESULT = await client.fetch(
      CHURCH_MAIN_NEWSLETTERS_QUERY,
    );

    return result
      .map(normalizeSanityNewsletter)
      .filter(
        (newsletter): newsletter is Newsletter => newsletter !== undefined,
      );
  } catch (error) {
    throw new Error("Unable to fetch Church Main newsletters from Sanity.", {
      cause: error,
    });
  }
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

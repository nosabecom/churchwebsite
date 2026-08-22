import { createImageUrlBuilder } from "@sanity/image-url";

export interface SanityImageCrop {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface SanityImageHotspot {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SanityImageSource {
  asset?: {
    _ref?: string;
  } | null;
  crop?: SanityImageCrop | null;
  hotspot?: SanityImageHotspot | null;
}

export interface SanityImageUrlOptions {
  width?: number;
  height?: number;
}

function getBuilder() {
  const projectId = import.meta.env.PUBLIC_SANITY_PROJECT_ID;
  const dataset = import.meta.env.PUBLIC_SANITY_DATASET;

  if (!projectId || !dataset) {
    throw new Error(
      "Church Main requires PUBLIC_SANITY_PROJECT_ID and PUBLIC_SANITY_DATASET.",
    );
  }

  return createImageUrlBuilder({ projectId, dataset });
}

/**
 * Builds an optimized Sanity image URL that respects editor-defined
 * crop and hotspot data. Returns undefined when the image has no asset.
 */
export function getSanityImageUrl(
  image: SanityImageSource | null | undefined,
  options: SanityImageUrlOptions = {},
): string | undefined {
  if (!image?.asset?._ref) return undefined;

  let url = getBuilder().image(image);
  if (options.width) url = url.width(options.width);
  if (options.height) {
    url = url.height(options.height).fit("crop");
  }
  return url.auto("format").url();
}

/**
 * Derives rendered dimensions for a resized image, preserving the
 * source aspect ratio when only a target width is given.
 */
export function getSanityImageDimensions(
  image: SanityImageSource & {
    dimensions?: { width?: number; height?: number } | null;
  },
  options: SanityImageUrlOptions = {},
): { width?: number; height?: number } {
  const sourceWidth = image.dimensions?.width;
  const sourceHeight = image.dimensions?.height;
  if (!sourceWidth || !sourceHeight || sourceWidth <= 0 || sourceHeight <= 0) {
    return {};
  }

  if (options.width && !options.height) {
    return {
      width: options.width,
      height: Math.round((sourceHeight / sourceWidth) * options.width),
    };
  }

  if (!options.width && options.height) {
    return {
      width: Math.round((sourceWidth / sourceHeight) * options.height),
      height: options.height,
    };
  }

  return {
    width: options.width,
    height: options.height,
  };
}

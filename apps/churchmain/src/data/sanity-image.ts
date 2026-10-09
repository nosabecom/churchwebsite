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
    _ref?: string | null;
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
  if (
    !image?.asset?._ref ||
    !/^image-[\w]+-[1-9]\d*x[1-9]\d*-\w+$/.test(image.asset._ref)
  ) {
    return undefined;
  }

  let url = getBuilder().image(image);
  if (options.width) url = url.width(options.width);
  if (options.height) {
    url = url.height(options.height).fit("crop");
  }
  return url.auto("format").url();
}

/**
 * Derives rendered dimensions for a resized image, preserving the
 * cropped source aspect ratio when only one target dimension is given.
 */
export function getSanityImageDimensions(
  image: SanityImageSource & {
    dimensions?: { width?: number; height?: number } | null;
  },
  options: SanityImageUrlOptions = {},
): { width?: number; height?: number } {
  const sourceWidth = image.dimensions?.width;
  const sourceHeight = image.dimensions?.height;
  if (
    !sourceWidth ||
    !sourceHeight ||
    !Number.isFinite(sourceWidth) ||
    !Number.isFinite(sourceHeight) ||
    sourceWidth <= 0 ||
    sourceHeight <= 0
  ) {
    return {};
  }

  // Match the pixel rounding used by @sanity/image-url before resizing.
  const crop = image.crop;
  const croppedWidth = Math.round(
    sourceWidth -
      (crop?.right ?? 0) * sourceWidth -
      Math.round((crop?.left ?? 0) * sourceWidth),
  );
  const croppedHeight = Math.round(
    sourceHeight -
      (crop?.bottom ?? 0) * sourceHeight -
      Math.round((crop?.top ?? 0) * sourceHeight),
  );
  if (croppedWidth <= 0 || croppedHeight <= 0) return {};

  if (options.width && !options.height) {
    return {
      width: options.width,
      height: Math.max(
        1,
        Math.round((croppedHeight / croppedWidth) * options.width),
      ),
    };
  }

  if (!options.width && options.height) {
    return {
      width: Math.max(
        1,
        Math.round((croppedWidth / croppedHeight) * options.height),
      ),
      height: options.height,
    };
  }

  return {
    width: options.width ?? croppedWidth,
    height: options.height ?? croppedHeight,
  };
}

/** Keep the editor's focal point when CSS object-cover crops a fluid container. */
export function getSanityImageObjectPosition(image: SanityImageSource): string {
  const crop = image.crop;
  const hotspot = image.hotspot;
  const cropWidth = 1 - (crop?.left ?? 0) - (crop?.right ?? 0);
  const cropHeight = 1 - (crop?.top ?? 0) - (crop?.bottom ?? 0);
  if (!hotspot || cropWidth <= 0 || cropHeight <= 0) return "50% 50%";
  const x = Math.min(
    1,
    Math.max(0, (hotspot.x - (crop?.left ?? 0)) / cropWidth),
  );
  const y = Math.min(
    1,
    Math.max(0, (hotspot.y - (crop?.top ?? 0)) / cropHeight),
  );
  return `${x * 100}% ${y * 100}%`;
}

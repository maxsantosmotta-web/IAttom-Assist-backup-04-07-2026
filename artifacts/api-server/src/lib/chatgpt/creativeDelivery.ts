/**
 * Validate every requested image before committing the creative-credit debit.
 * The underlying generator may return partially successful images, which must
 * never be billed as a complete 2/3-image delivery.
 */
export type GeneratedCreative = {
  concepts?: Array<{ imageBase64?: string; format?: string; label?: string }>;
};

export function deliveredCreativeAssets(result: unknown, requested: number) {
  if (!Number.isInteger(requested) || requested < 1 || requested > 3) {
    throw new Error("invalid_requested_image_count");
  }
  if (!result || typeof result !== "object") {
    throw new Error("invalid_creative_result");
  }
  const concepts = (result as GeneratedCreative).concepts;
  if (!Array.isArray(concepts) || concepts.length !== requested) {
    throw new Error("incomplete_creative_delivery");
  }
  const assets = concepts.map((item, index) => {
    const base64 = item?.imageBase64;
    if (typeof base64 !== "string" || base64.length < 16 ||
        !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
      throw new Error("incomplete_creative_delivery");
    }
    return { conceptIndex: index, base64, label: item.label ?? "", format: item.format ?? "" };
  });
  const safeResult = {
    ...(result as Record<string, unknown>),
    concepts: concepts.map(({ imageBase64: _omitted, ...rest }) => rest),
  };
  return { assets, safeResult };
}

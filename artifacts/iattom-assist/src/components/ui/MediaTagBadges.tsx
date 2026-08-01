import { Badge } from "@/components/ui/badge";

interface MediaTagBadgesProps {
  data?: string | null;
  hasImages?: boolean | null;
  hasVideos?: boolean | null;
}

function inferMediaTags(data?: string | null): { hasImages: boolean; hasVideos: boolean } {
  if (!data) return { hasImages: false, hasVideos: false };
  try {
    const parsed = JSON.parse(data) as Record<string, unknown>;
    const type = typeof parsed.type === "string" ? parsed.type : "";
    const result = parsed.result && typeof parsed.result === "object"
      ? parsed.result as Record<string, unknown>
      : null;
    const concepts = result && Array.isArray(result.concepts) ? result.concepts : [];
    const videos = Array.isArray(parsed.videos) ? parsed.videos : [];
    const videoUrl = typeof parsed.videoUrl === "string" && parsed.videoUrl.length > 0;

    return {
      hasImages: concepts.length > 0 || type === "image-motion-source",
      hasVideos: videos.length > 0 || videoUrl || type === "video" || type === "image-motion-video",
    };
  } catch {
    return { hasImages: false, hasVideos: false };
  }
}

export function MediaTagBadges({ data, hasImages, hasVideos }: MediaTagBadgesProps) {
  const inferred = inferMediaTags(data);
  const showImages = Boolean(hasImages ?? inferred.hasImages);
  const showVideos = Boolean(hasVideos ?? inferred.hasVideos);

  if (!showImages && !showVideos) return null;
  return (
    <>
      {showImages && (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-blue-400 bg-blue-500/10 border-blue-500/20">
          Imagem
        </Badge>
      )}
      {showVideos && (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-pink-400 bg-pink-500/10 border-pink-500/20">
          Vídeo
        </Badge>
      )}
    </>
  );
}

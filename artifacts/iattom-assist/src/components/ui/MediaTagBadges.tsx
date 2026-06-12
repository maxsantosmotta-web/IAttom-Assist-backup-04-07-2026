import { Badge } from "@/components/ui/badge";

interface MediaTagBadgesProps {
  hasImages?: boolean | null;
  hasVideos?: boolean | null;
}

export function MediaTagBadges({ hasImages, hasVideos }: MediaTagBadgesProps) {
  if (!hasImages && !hasVideos) return null;
  return (
    <>
      {!!hasImages && (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-blue-400 bg-blue-500/10 border-blue-500/20">
          Imagem
        </Badge>
      )}
      {!!hasVideos && (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-pink-400 bg-pink-500/10 border-pink-500/20">
          Vídeo
        </Badge>
      )}
    </>
  );
}

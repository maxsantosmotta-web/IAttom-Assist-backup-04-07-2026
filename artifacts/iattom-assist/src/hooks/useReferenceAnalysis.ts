import { useRef, useState } from "react";
import { useAuth } from "@clerk/react";

export type ReferenceAnalysisStatus = "idle" | "analyzing" | "done" | "error";

export interface ReferenceAnalysisResult {
  productDetected: string;
  confidence: "high" | "medium" | "low";
  compatible: boolean;
  reason: string;
}

export function useReferenceAnalysis() {
  const cache = useRef<Map<string, ReferenceAnalysisResult>>(new Map());
  const [analysisStatus, setAnalysisStatus] = useState<ReferenceAnalysisStatus>("idle");
  const [analysisResult, setAnalysisResult] = useState<ReferenceAnalysisResult | null>(null);
  const { getToken } = useAuth();

  const analyze = async (imageBase64: string, productName: string): Promise<ReferenceAnalysisResult | null> => {
    if (!imageBase64 || !productName.trim()) return null;

    const cacheKey = imageBase64.slice(0, 64) + "|" + productName;
    if (cache.current.has(cacheKey)) {
      const cached = cache.current.get(cacheKey)!;
      setAnalysisResult(cached);
      setAnalysisStatus("done");
      return cached;
    }

    setAnalysisStatus("analyzing");
    setAnalysisResult(null);

    try {
      const token = await getToken();
      const res = await fetch("/api/ai/analyze-reference", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token ?? ""}`,
        },
        body: JSON.stringify({ imageBase64, productName }),
      });
      if (!res.ok) throw new Error("Falha ao analisar imagem");
      const data = (await res.json()) as ReferenceAnalysisResult;
      cache.current.set(cacheKey, data);
      setAnalysisResult(data);
      setAnalysisStatus("done");
      return data;
    } catch {
      setAnalysisStatus("error");
      return null;
    }
  };

  const resetAnalysis = () => {
    setAnalysisStatus("idle");
    setAnalysisResult(null);
  };

  return { analyze, analysisStatus, analysisResult, resetAnalysis };
}

export interface FoundProduct {
  name: string;
  category: string;
  score: number;
  demand: string;
  margin: string;
  trend: string;
  whyNow: string;
  targetAudience: string;
  keySellingPoints: string[];
  competition: string;
  estimatedMonthlyRevenue: string;
}

export interface FindProductsResult {
  products: FoundProduct[];
  marketInsight: string;
  topPick: string;
}

export interface ValidationResult {
  score: number;
  verdict: string;
  marketSize: string;
  competition: string;
  buyerIntentScore: number;
  profitabilityRating: string;
  strengths: string[];
  risks: string[];
  opportunities: string[];
  recommendation: string;
  launchStrategy: string;
  pricingInsight: string;
  demandTrend: string;
}

export interface CampaignPlatformField {
  key: string;
  label: string;
  value: string;
}

export interface CampaignCreativeBriefing {
  produto: string;
  objetivo: string;
  plataforma: string;
  publico: string;
  promessa: string;
  dor: string;
  beneficio: string;
  tom: string;
  cta: string;
  restricoes: string;
}

export interface CampaignResult {
  campaignTitle?: string;
  headline: string;
  subheadline: string;
  cta: string;
  audience: string;
  channels: string[];
  budget: string;
  copy: Record<string, string>;
  keyMessages: string[];
  launchTimeline: string;
  uniqueAngle: string;
  objectionHandling: string;
  platform?: string;
  platformFields?: CampaignPlatformField[];
  creativeBriefing?: CampaignCreativeBriefing;
}

export interface ContentResult {
  blog: string;
  social: string;
  email: string;
  tweetThread: string;
  smsText: string;
  seoTitle: string;
  seoDescription: string;
}

export interface CreativeConcept {
  id: number;
  label: string;
  format: string;
  imagePrompt: string;
  imageBase64?: string;
}

export interface CreativeIdeasResult {
  concepts: CreativeConcept[];
  visualAnchor?: string;
}

export interface ScriptScene {
  time: string;
  visual: string;
  script: string;
  emotion: string;
  direction: string;
}

export interface VideoGenerationResult {
  videoUrl: string;
  durationSeconds: number;
  videoEstilo: "executivo" | "consultor" | "criador";
  videoAvatar: "masculino" | "feminino";
  videoAmbiente: string;
  videoFormato: "9:16" | "1:1" | "16:9";
  prompt: string;
  generatedAt: string;
  isMock: boolean;
}

export interface VideoScriptResult {
  title: string;
  duration: string;
  hooks: string[];
  scenes: ScriptScene[];
  voiceoverStyle: string;
  musicMood: string;
  editingPace: string;
  captionStyle: string;
  viralTrigger: string;
  distributionTips: string[];
}

export type Channel = "blog" | "sns" | "video" | "website";
export type ProgramCategory = "affiliate" | "campaign" | "content" | "commerce" | "gig" | "home" | "apptech";
export const programCategoryLabels: Record<ProgramCategory, string> = {
  affiliate: "제휴마케팅", campaign: "캠페인·체험단", content: "콘텐츠 수익", commerce: "온라인 판매", gig: "재능·서비스", home: "재택 알바", apptech: "앱테크·설문",
};
export const difficultyLabels: Record<Program["difficulty"], string> = { beginner: "입문", intermediate: "중급" };
export type AgeGroup = "TEENS" | "TWENTIES" | "THIRTIES" | "FORTIES" | "FIFTIES_PLUS";
export const ageGroups: AgeGroup[] = ["TEENS", "TWENTIES", "THIRTIES", "FORTIES", "FIFTIES_PLUS"];
export const ageGroupLabels: Record<AgeGroup, string> = { TEENS: "10대", TWENTIES: "20대", THIRTIES: "30대", FORTIES: "40대", FIFTIES_PLUS: "50대 이상" };
export function isAgeGroup(value: unknown): value is AgeGroup { return typeof value === "string" && (ageGroups as string[]).includes(value); }
export function programCategoryLabel(category: string): string {
  return (programCategoryLabels as Record<string, string>)[category] || category;
}
export interface Program {
  board?: "MARKETER" | "HELP";
  helpType?: "PROMOTION" | "RECRUITMENT" | null;
  location?: string;
  deadline?: string;
  companyName?: string | null;
  thumbnailUrl?: string | null;
  /** Optional logo for the brand mark; without it the official site's favicon is used. */
  logoUrl?: string | null;
  content?: import("./submissions").RichDocument | null;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  category: ProgramCategory;
  channels: Channel[];
  cost: "free" | "check";
  costLabel: string;
  commission: string;
  settlement: string;
  difficulty: "beginner" | "intermediate";
  /** Conservative lower estimate for a beginner (부추 editorial, not a guarantee); empty when it can't be stated. */
  minIncome?: string;
  /** Age bands this side job suits best; empty means everyone. */
  ageGroups?: AgeGroup[];
  featured: boolean;
  officialUrl: string;
  guideUrl: string;
  brandColor: string;
  initials: string;
  tags: string[];
  highlights: string[];
  steps: string[];
  cautions: string[];
  verifiedAt: string;
}
export const channelLabels: Record<Channel, string> = {
  blog: "블로그", sns: "SNS", video: "영상", website: "웹사이트",
};

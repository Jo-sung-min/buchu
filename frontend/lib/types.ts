export type Channel = "blog" | "sns" | "video" | "website";
export type ProgramCategory = "affiliate" | "campaign" | "content" | "commerce" | "gig" | "apptech";
export const programCategoryLabels: Record<ProgramCategory, string> = {
  affiliate: "제휴마케팅", campaign: "캠페인·체험단", content: "콘텐츠 수익", commerce: "온라인 판매", gig: "재능·서비스", apptech: "앱테크·설문",
};
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

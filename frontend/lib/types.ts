export type Channel = "blog" | "sns" | "video" | "website";
export interface Program {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  category: "affiliate" | "campaign";
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

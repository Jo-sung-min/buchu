export type CourseCategory = "AFFILIATE" | "CONTENT" | "COMMERCE" | "DIGITAL" | "SERVICE" | "AI";
export type CourseLevel = "BEGINNER" | "INTERMEDIATE";
export type CourseStatus = "DRAFT" | "COMING_SOON" | "PUBLISHED" | "ARCHIVED";
export const courseCategories: Record<CourseCategory, string> = { AFFILIATE: "제휴마케팅", CONTENT: "콘텐츠·SNS", COMMERCE: "온라인 판매", DIGITAL: "전자책·디지털 상품", SERVICE: "재능·프리랜서", AI: "AI 활용 부업" };
export const courseLevels: Record<CourseLevel, string> = { BEGINNER: "처음 시작", INTERMEDIATE: "경험 있어요" };
export interface CourseLesson { id: string; title: string; durationMinutes: number; preview: boolean; }
export interface CourseModule { id: string; title: string; lessons: CourseLesson[]; }
export interface Course {
  id: string; slug: string; title: string; subtitle: string; description: string;
  category: CourseCategory; level: CourseLevel; status: CourseStatus; isDemo: boolean;
  instructorName: string; instructorBio: string; thumbnailUrl: string;
  price: number; accessDays: number; weeklyHours: number; startupCost: number;
  outcomes: string[]; requirements: string[]; relatedProgramSlug: string | null;
  refundPolicy: string; supportEmail: string;
  curriculum: CourseModule[]; createdAt: string; updatedAt: string;
}
export interface AdminLesson extends CourseLesson { body: string; videoUrl: string; }
export interface AdminModule extends Omit<CourseModule, "lessons"> { lessons: AdminLesson[]; }
export interface CourseInput extends Omit<Course, "id" | "createdAt" | "updatedAt" | "curriculum"> { curriculum: AdminModule[]; }
export interface AdminCourse extends CourseInput { id: string; createdAt: string; updatedAt: string; }
export interface LessonContent extends CourseLesson { body: string; videoUrl: string; }
export interface CourseOrder {
  id: string; courseId: string; courseSlug: string; courseTitle: string; amount: number;
  status: "PENDING" | "PAID" | "CANCELED"; buyerName: string; buyerEmail: string;
  createdAt: string; paidAt: string | null; expiresAt: string | null; completedLessonIds: string[];
}
export interface OrderCredentials { id: string; accessToken: string; }
export interface PaymentConfig { enabled: boolean; clientKey: string; }
export function courseDuration(course: Course) { return course.curriculum.reduce((total, module) => total + module.lessons.reduce((sum, lesson) => sum + lesson.durationMinutes, 0), 0); }
export function courseLessonCount(course: Course) { return course.curriculum.reduce((total, module) => total + module.lessons.length, 0); }
export function won(amount: number) { return `${amount.toLocaleString("ko-KR")}원`; }

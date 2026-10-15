import type { Metadata } from "next";
import { Classroom } from "@/components/courses/classroom";

export const metadata: Metadata = { title: "내 강의실", description: "구매한 부업 강의를 이어서 학습하세요.", robots: { index: false, follow: false } };

export default function ClassroomPage() { return <Classroom />; }

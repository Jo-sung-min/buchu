import type { Metadata } from "next";
import { AdminDashboard } from "@/components/admin-dashboard";
export const metadata: Metadata = { title: "운영 관리", robots: { index: false, follow: false } };
export default function AdminPage() { return <AdminDashboard />; }

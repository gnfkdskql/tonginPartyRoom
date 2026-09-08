import type { Metadata } from "next";
import { AdminApp } from "@/components/admin/admin-app";

export const metadata: Metadata = {
  title: "관리자 | 서초 시그니처 파티룸",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return <AdminApp />;
}

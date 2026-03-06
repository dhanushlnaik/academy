import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Settings | EIPsInsight Academy",
  description: "Manage your EIPsInsight Academy account settings, notifications, and preferences.",
  robots: { index: false, follow: false },
};

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Community | EIPsInsight Academy",
  description:
    "Join the EIPsInsight Academy community of Web3 learners, builders, and educators. Collaborate, earn rewards, and grow together.",
  openGraph: {
    title: "Community | EIPsInsight Academy",
    description:
      "Join the EIPsInsight Academy community of Web3 learners, builders, and educators.",
  },
};

export default function CommunityLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

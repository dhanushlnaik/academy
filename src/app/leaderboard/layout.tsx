import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Leaderboard | EIPsInsight Academy",
  description:
    "See the top Web3 learners on EIPsInsight Academy. Earn XP by completing courses and climb the ranks.",
  openGraph: {
    title: "Leaderboard | EIPsInsight Academy",
    description:
      "See the top Web3 learners on EIPsInsight Academy. Earn XP and climb the ranks.",
  },
};

export default function LeaderboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

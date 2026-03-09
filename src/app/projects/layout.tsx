import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Projects | EIPsInsight Academy",
  description:
    "Browse and contribute to open-source Web3 projects built by the EIPsInsight Academy community.",
  openGraph: {
    title: "Projects | EIPsInsight Academy",
    description:
      "Browse and contribute to open-source Web3 projects built by the EIPsInsight Academy community.",
  },
};

export default function ProjectsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

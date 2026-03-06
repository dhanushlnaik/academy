import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How It Works | EIPsInsight Academy",
  description:
    "Learn how EIPsInsight Academy works — from signing up to earning NFT certificates for completing Web3 courses.",
  openGraph: {
    title: "How It Works | EIPsInsight Academy",
    description:
      "Learn how EIPsInsight Academy works — from signing up to earning NFT certificates.",
  },
};

export default function HowItWorksLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

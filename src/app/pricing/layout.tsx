import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing | EIPsInsight Academy",
  description:
    "EIPsInsight Academy pricing plans for Web3 and blockchain education. Start learning for free.",
  openGraph: {
    title: "Pricing | EIPsInsight Academy",
    description: "EIPsInsight Academy pricing plans. Start learning for free.",
  },
};

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

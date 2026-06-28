import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ITR Calculator — Form 16 Tax Regime Comparison",
  description:
    "Compare income tax under new and old regime using Form 16 Part A and Part B for FY 2025-26.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen antialiased" suppressHydrationWarning>{children}</body>
    </html>
  );
}

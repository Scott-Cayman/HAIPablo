import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HAI Pablo 工作台 | AI创意工作台",
  description: "HIMICE·AI 智海王潮 HAI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}

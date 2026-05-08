import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HAI Pablo 工作台 | 智海王潮AI创意效率工作台",
  description: "智海王潮AI创意效率工作台，基于GPT图像生成模型，支持多种预设模板和自定义配置",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}

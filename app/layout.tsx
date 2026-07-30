import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const protocol = host.includes("localhost") ? "http" : "https";
  const base = new URL(`${protocol}://${host}`);
  return {
    metadataBase: base,
    title: "ShareSight｜团队资料库",
    description: "统一保存组会日志、汇报 PPT 和研究资料。",
    openGraph: {
      title: "ShareSight｜让每一次分享都有迹可循",
      description: "组会日志、汇报 PPT 与研究资料的团队知识库。",
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}

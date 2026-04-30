import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VOCARIS",
  description: "수능 영어 단어 학습 웹앱",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, title: "VOCARIS", statusBarStyle: "default" }
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}

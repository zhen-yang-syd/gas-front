import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Orbitron } from "next/font/google";
import "./globals.css";

// 工业科技风字体
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});

const orbitron = Orbitron({
  subsets: ["latin"],
  variable: "--font-orbitron",
});

export const metadata: Metadata = {
  title: "煤矿瓦斯监测预警系统",
  description: "基于三分法相关性分析的煤矿瓦斯传感器监测预警平台",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className={`dark ${inter.variable} ${jetbrainsMono.variable} ${orbitron.variable}`}>
      <body className="font-body antialiased bg-base text-bright min-h-screen">
        {children}
      </body>
    </html>
  );
}

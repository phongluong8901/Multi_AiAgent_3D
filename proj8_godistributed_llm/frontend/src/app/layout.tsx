import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Go Distributed LLM Console",
  description: "Distributed Local LLM Chat and Cluster Telemetry Console",
};

/** Layout gốc của ứng dụng Next.js (bật dark theme mặc định trên toàn trang). */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
        {children}
      </body>
    </html>
  );
}


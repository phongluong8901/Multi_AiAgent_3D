import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { GoogleOAuthProvider } from '@react-oauth/google';
import { Toaster } from "sonner"
import { ConfirmProvider } from "@/context/ConfirmContext"
import { ThemeProvider } from "@/context/ThemeContext"
import { LanguageProvider } from "@/context/LanguageContext"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Multi-Agent OS",
  description: "3D Room & Embedded AI Collaboration Platform",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="vi"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ""}>
          <LanguageProvider>
            <ThemeProvider>
              <ConfirmProvider>
                {children}
              </ConfirmProvider>
              <Toaster
                theme="dark"
                position="top-right"
                richColors
                closeButton
                toastOptions={{
                  classNames: {
                    toast: "bg-zinc-900 border border-zinc-700 text-white",
                    title: "text-white",
                    description: "text-zinc-400",
                  },
                }}
              />
            </ThemeProvider>
          </LanguageProvider>
        </GoogleOAuthProvider>
      </body>
    </html>
  );
}

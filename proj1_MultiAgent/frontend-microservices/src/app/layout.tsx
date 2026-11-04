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
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('app-theme')||'dark';var r=document.documentElement;if(t==='system'){t=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';}r.classList.remove('dark','light','theme-cyberpunk');if(t==='dark'){r.classList.add('dark');r.style.colorScheme='dark';}else if(t==='cyberpunk'){r.classList.add('dark','theme-cyberpunk');r.style.colorScheme='dark';}else{r.classList.add('light');r.style.colorScheme='light';}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ""}>
          <LanguageProvider>
            <ThemeProvider>
              <ConfirmProvider>
                {children}
              </ConfirmProvider>
              <Toaster
                position="top-right"
                richColors
                closeButton
                toastOptions={{
                  classNames: {
                    toast: "bg-card border border-border text-foreground shadow-xl",
                    title: "text-foreground font-semibold",
                    description: "text-muted-foreground",
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

import type { Metadata } from "next";
import "./globals.css";
import { GoogleOAuthProvider } from '@react-oauth/google';
import { Toaster } from "sonner"
import { ConfirmProvider } from "@/context/ConfirmContext"
import { ThemeProvider } from "@/context/ThemeContext"
import { LanguageProvider } from "@/context/LanguageContext"

// Resilient font variable fallback compatible with both offline and cloud CI builds
const geistSans = { variable: "font-sans" };
const geistMono = { variable: "font-mono" };

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
        <link rel="stylesheet" href="/leaflet/leaflet.css" />
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

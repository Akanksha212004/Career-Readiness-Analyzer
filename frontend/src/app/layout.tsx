import type { Metadata } from "next";
import { Lexend, Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { QueryProvider } from "@/lib/query-provider";
import { AuthProvider } from "@/lib/auth-provider";
import { ThemeProvider, themeInitScript } from "@/lib/theme-provider";
import { NavBar } from "@/components/nav-bar";
import { PendingInviteBanner } from "@/components/pending-invite-banner";

const lexend = Lexend({
  variable: "--font-lexend",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Career Readiness Analyzer",
  description:
    "Upload your resume, pick a target role, and get a readiness score, skill-gap breakdown, and concrete steps to close it.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Applies the saved/OS theme before first paint, so there's no
            flash of the wrong theme when the page loads. next/script with
            beforeInteractive is the Next.js-supported way to run a script
            this early - a raw <script> tag inside a Server Component gets
            flagged and won't run reliably. */}
        <Script id="theme-init" strategy="beforeInteractive">
          {themeInitScript}
        </Script>
      </head>
      <body className={`${lexend.variable} ${inter.variable} antialiased min-h-screen bg-background`}>
        <ThemeProvider>
          <QueryProvider>
            <AuthProvider>
              <NavBar />
              <PendingInviteBanner />
              <main className="min-h-[calc(100vh-64px)]">{children}</main>
            </AuthProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}


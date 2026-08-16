import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import localFont from "next/font/local";
import { headers } from "next/headers";
import "./globals.css";
import MuiThemeProvider from "@/components/shared/MuiThemeProvider";
import { ToastProvider } from "@/lib/context/ToastContext";
import SkipToContent from "@/components/shared/SkipToContent";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const blanka = localFont({
  src: "../fonts/Blanka-Regular.otf",
  variable: "--font-blanka",
  display: "swap",
});

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.nexxus.lol';

export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: "Nexus — OJT Management Workspace",
    template: "%s | Nexus",
  },
  description: "One workspace for on-the-job training — attendance, tasks, and progress for trainees, supervisors, and admins.",
  keywords: ["OJT", "On the job training", "Attendance tracking", "GPS clock-in", "Kanban task board", "Trainee management"],
  openGraph: {
    title: "Nexus — OJT Management Workspace",
    description: "One workspace for on-the-job training — attendance, tasks, and progress, connected.",
    url: baseUrl,
    siteName: "Nexus",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Nexus — OJT Management Workspace",
    description: "One workspace for on-the-job training — attendance, tasks, and progress, connected.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headerList = await headers();
  const nonce = headerList.get("x-nonce") ?? undefined;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Nexus',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    description: 'One workspace for on-the-job training — attendance, tasks, and progress, connected.',
  };

  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${blanka.variable} antialiased`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <SkipToContent />
        <AppRouterCacheProvider options={{ key: 'css', nonce }}>
          <MuiThemeProvider>
            <ToastProvider>
              {children}
            </ToastProvider>
          </MuiThemeProvider>
        </AppRouterCacheProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}

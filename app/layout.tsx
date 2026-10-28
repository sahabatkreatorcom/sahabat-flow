import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { APP_URL } from "@/lib/site";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "Sahabat Kreator - The Open Source ManyChat Alternative",
    template: "%s | Sahabat Kreator",
  },
  description:
    "Automate DMs, comments, and flows across Instagram, Facebook, Telegram, and TikTok. Free, self-hostable, and open source.",
  metadataBase: new URL(APP_URL),
  openGraph: {
    title: "Sahabat Kreator - The Open Source ManyChat Alternative",
    description:
      "Automate DMs, comments, and flows across Instagram, Facebook, Telegram, and TikTok. Free, self-hostable, and open source.",
    url: "/",
    siteName: "Sahabat Kreator",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sahabat Kreator - The Open Source ManyChat Alternative",
    description:
      "Automate DMs, comments, and flows across 4 platforms. Free, self-hostable, open source.",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem("theme")==="dark"||(!localStorage.getItem("theme")&&matchMedia("(prefers-color-scheme:dark)").matches))document.documentElement.classList.add("dark")}catch(e){}`,
          }}
        />
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  );
}

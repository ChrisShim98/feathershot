import type { Metadata } from "next";
import "@fontsource-variable/nunito";
import "./globals.css";
import { THEME_BOOT } from "@/lib/theme-boot";

export const metadata: Metadata = {
  title: "Feathershot",
  description: "Turn any screenshot into a polished, share-ready image.",
};

const CSP =
  "default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; " +
  "img-src 'self' data: blob:; font-src 'self'; media-src 'self' blob:; connect-src 'self' data: blob:; " +
  "base-uri 'none'; form-action 'none'";

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {process.env.NODE_ENV === "production" && <meta httpEquiv="Content-Security-Policy" content={CSP} />}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

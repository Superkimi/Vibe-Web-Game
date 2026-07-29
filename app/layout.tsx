import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");

  return {
    metadataBase: new URL(`${protocol}://${host}`),
    title: {
      default: "Vibe Web Game | Build Phaser games with AI",
      template: "%s | Vibe Web Game",
    },
    description:
      "A browser-based Phaser 4 game studio for manual scene editing and schema-safe AI game creation.",
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
    },
    openGraph: {
      title: "Vibe Web Game",
      description: "Build the game. Shape every detail.",
      type: "website",
      images: [
        {
          url: "/og.png",
          width: 1672,
          height: 941,
          alt: "Vibe Web Game editor with a 2D platform scene and Vibe AI panel",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "Vibe Web Game",
      description: "Build the game. Shape every detail.",
      images: ["/og.png"],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}

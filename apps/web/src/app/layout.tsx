import type { Metadata } from "next";
import { Bungee, Nunito_Sans } from "next/font/google";

import "./globals.css";

const displayFont = Bungee({
  subsets: ["latin"],
  variable: "--font-display",
  weight: "400",
});

const bodyFont = Nunito_Sans({
  subsets: ["latin"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "Simon Says — Memory Lab",
  description: "Train your memory with a sequence of light and sound.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${displayFont.variable} ${bodyFont.variable}`}>
        {children}
      </body>
    </html>
  );
}

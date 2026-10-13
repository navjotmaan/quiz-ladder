import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = { 
  title: "Quiz Ladder", 
  description: "Climb three levels. Keep your streak." 
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#000000] font-sans text-slate-100 antialiased selection:bg-fuchsia-400/30">
        {/* <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute -left-40 -top-48 size-[28rem] rounded-full bg-violet-600/15 blur-[120px]" />
          <div className="absolute -right-40 top-1/3 size-[24rem] rounded-full bg-cyan-500/10 blur-[120px]" />
          <div className="absolute -bottom-48 left-1/3 size-[24rem] rounded-full bg-fuchsia-600/10 blur-[120px]" />
        </div> */}
        <main className="relative mx-auto min-h-screen max-w-3xl px-4 py-8 sm:px-6 sm:py-12">{children}</main>
      </body>
    </html>
  );
}

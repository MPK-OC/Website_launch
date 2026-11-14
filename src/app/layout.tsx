import type { Metadata } from "next";
import { Lobster_Two, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { UserProvider } from "@/components/UserProvider";

const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"] });
const brand = Lobster_Two({ variable: "--font-brand-script", subsets: ["latin"], weight: ["700"], style: ["italic"] });

export const metadata: Metadata = {
  title: "Ova Cure — Understand your body. Get expert care.",
  description:
    "Period tracking, PCOD care plans, pregnancy planning, menopause care and online gynaecologist consultations — at every stage of life.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${jakarta.variable} ${brand.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <UserProvider>{children}</UserProvider>
      </body>
    </html>
  );
}

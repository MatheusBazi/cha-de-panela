import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Karla, Parisienne } from "next/font/google";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-cormorant",
  display: "swap",
});

const karla = Karla({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-karla",
  display: "swap",
});

const parisienne = Parisienne({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-parisienne",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Chá de Cozinha • Débora & Matheus",
  description: "Lista de presentes e celebração do nosso novo lar — Débora e Matheus.",
  openGraph: {
    title: "Chá de Cozinha • Débora & Matheus",
    description: "Venha celebrar conosco a construção do nosso novo lar.",
    type: "website",
    locale: "pt_BR",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#F4EFE7",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={`${cormorant.variable} ${karla.variable} ${parisienne.variable}`}>
      <body className="font-sans bg-canvas text-editorial-primary antialiased min-h-screen flex flex-col selection:bg-sage-200">
        {children}
      </body>
    </html>
  );
}

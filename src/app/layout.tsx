import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@fontsource-variable/roboto/wght.css";
import "@fontsource-variable/roboto-slab/wght.css";
import "./globals.css";
import { ContentProvider } from "@/components/ContentProvider";

export const metadata: Metadata = {
  title: "",
  description: "",
  robots: { index: false, follow: false },
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="und">
      <body>
        <ContentProvider appId="commercehub" modelUrl="/commercehub-model.json">
          {children}
        </ContentProvider>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Queryly — Ask your data",
  description: "A clean Text-to-SQL workspace for exploring your data.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

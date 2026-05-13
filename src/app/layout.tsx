import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TCOS Insights",
  description: "Automated weekly performance reports for trade contractors.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Body bg + text colour live in globals.css now (paper cream / ink dark)
  // so they apply uniformly to every page including ones that don't render
  // their own wrapper. We just set min-height + flex here for the layout.
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

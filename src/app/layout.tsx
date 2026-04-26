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
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-white text-slate-900">
        {children}
      </body>
    </html>
  );
}

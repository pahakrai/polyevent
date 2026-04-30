import type { Metadata } from "next";
import { ThemeProvider } from "@/components/ThemeProvider";
import { QueryProvider } from "@/lib/query-client";
import { DefaultLayout } from "@/components/layouts/DefaultLayout";
import "./globals.css";

export const metadata: Metadata = {
  title: "Polydom — Connect Through Shared Interests",
  description:
    "Discover art, music, sports, and activities near you. Connect with groups and vendors.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <QueryProvider>
            <DefaultLayout>{children}</DefaultLayout>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

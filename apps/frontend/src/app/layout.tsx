import type { Metadata } from "next";
import { ThemeProvider } from "@/components/ThemeProvider";
import { DefaultLayout } from "@/components/layouts/DefaultLayout";
import "./globals.css";

export const metadata: Metadata = {
  title: "Polydom — Find Live Music Events",
  description:
    "Discover concerts, jam sessions, workshops, and more near you",
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
          <DefaultLayout>{children}</DefaultLayout>
        </ThemeProvider>
      </body>
    </html>
  );
}

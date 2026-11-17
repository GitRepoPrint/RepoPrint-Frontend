import type { Metadata } from "next";
import type { ReactNode } from "react";
import AppShell from "@/components/app-shell";
import Footer from "@/components/layout/footer";
import Navbar from "@/components/layout/navbar";
import { ThemeProvider } from "@/components/theme";
import { ToastProvider } from "@/components/ui/toast";
import { AuthProvider } from "@/lib/auth/auth-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "RepoPrint",
  description: "Repository fingerprint: activity, team, structure, security and privacy.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <AuthProvider>
            <ToastProvider>
              <AppShell navbar={<Navbar />} footer={<Footer />}>
                {children}
              </AppShell>
            </ToastProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

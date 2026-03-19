import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { AppProvider } from "@/context/AppContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Arte Concreto Intelligence Core",
  description: "Sistema de gestión empresarial a medida para Arte Concreto",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark">
      <head>
        <script dangerouslySetInnerHTML={{
          __html: `
            (function() {
              try {
                const theme = localStorage.getItem('crm-theme');
                const color = localStorage.getItem('crm-primary-color');
                const layout = localStorage.getItem('crm-layout');
                if (theme === 'light') {
                  document.documentElement.classList.remove('dark');
                }
                if (color) {
                  document.documentElement.style.setProperty('--color-primary', color);
                  document.documentElement.style.setProperty('--color-ring', color);
                }
                if (layout) {
                  document.documentElement.setAttribute('data-layout', layout);
                }
              } catch (e) {}
            })();
          `
        }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased selection:bg-primary/30 selection:text-primary-foreground`}
      >
        <AppProvider>
          <DashboardLayout>
            {children}
          </DashboardLayout>
        </AppProvider>
      </body>
    </html>
  );
}


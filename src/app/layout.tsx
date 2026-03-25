import type { Metadata } from "next";
import "./globals.css";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { AppProvider } from "@/context/AppContext";

export const metadata: Metadata = {
  title: "ArteConcreto Intelligence Core",
  description: "Sistema de gestión empresarial a medida para ArteConcreto",
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <head>
        <script dangerouslySetInnerHTML={{
          __html: `
            (function() {
              try {
                const theme = localStorage.getItem('crm-theme') || 'light';
                const color = localStorage.getItem('crm-primary-color');
                const layout = localStorage.getItem('crm-layout');
                document.documentElement.classList.remove('dark');
                if (theme === 'dark') {
                  document.documentElement.classList.add('dark');
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
        className="antialiased selection:bg-primary/30 selection:text-primary-foreground"
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

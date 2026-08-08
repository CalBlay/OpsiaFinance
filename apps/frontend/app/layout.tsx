import "./globals.css";
import { SessionProvider } from "@/components/providers/SessionProvider";

export const metadata = {
  title: "OpsiaFinance",
  description: "Software intern de consulta i analisi financera",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
      { url: "/icon.png", type: "image/png", sizes: "1254x1254" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: ["/favicon.ico"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ca">
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}

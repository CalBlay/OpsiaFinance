import "./globals.css";
import { SessionProvider } from "@/components/providers/SessionProvider";

export const metadata = {
  title: "OpsiaFinance",
  description: "Software intern de consulta i anàlisi financera",
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

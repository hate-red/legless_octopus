import type { Metadata } from "next";
import { Providers } from "./_providers";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Альфа — Кредитный кабинет", template: "%s · Альфа" },
  description:
    "Кабинет финансирования бизнеса: заявки, документы компании и оценка кредитоспособности.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

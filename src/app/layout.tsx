import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "TradeSim UAE | Your investing journey, simulated",
  description:
    "Explore UAE stocks with AED 100,000 in virtual capital. All market data is simulated.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "./_components/Nav";

export const metadata: Metadata = {
  title: "birskins — CS2 skin marketplace",
  description: "Buy and sell CS2 skins with Steam login",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Nav />
        <main className="container">{children}</main>
      </body>
    </html>
  );
}

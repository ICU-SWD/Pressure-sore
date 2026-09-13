import type { Metadata, Viewport } from "next";
import "./globals.css";
import NavBar from "@/components/NavBar";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

export const metadata: Metadata = {
  title: "Pressure Sore Guard",
  description: "ระบบดูแลผู้ป่วยหนักเพื่อป้องกันการเกิดแผลกดทับ",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#2f6fed",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>
        <ServiceWorkerRegister />
        <NavBar />
        <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}

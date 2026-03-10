import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "AI Lecture Note Generator",
  description: "Record lectures and generate structured study materials in real time."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-gray-100">
        {children}
      </body>
    </html>
  );
}


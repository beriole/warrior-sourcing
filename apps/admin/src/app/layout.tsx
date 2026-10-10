import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { AdminSidebar } from '@/components/admin-sidebar';
import './globals.css';

const inter = Inter({ variable: '--font-inter', subsets: ['latin'], display: 'swap' });

export const metadata: Metadata = {
  title: 'Back-office — Warrior Sourcing',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" className={`${inter.variable} antialiased`}>
      <body className="flex min-h-dvh">
        <AdminSidebar />
        <main className="min-w-0 flex-1 p-6">{children}</main>
      </body>
    </html>
  );
}

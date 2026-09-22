import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'HR Orbit',
  description: 'Multi-tenant HR platforma',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz">
      <body>{children}</body>
    </html>
  );
}

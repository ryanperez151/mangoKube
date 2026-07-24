import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Operation Mango',
  description: 'A cinematic Kubernetes attack/defense simulation.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

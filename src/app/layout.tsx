import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Operation Mango',
  description:
    'A cinematic, fully-simulated Kubernetes attack and defense investigation set in the MangoCorp orchard.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}

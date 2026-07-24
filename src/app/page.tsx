'use client';

import Link from 'next/link';

export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-4xl font-bold text-mango-500">Operation Mango</h1>
      <p className="max-w-xl text-mango-300">
        MangoCorp&apos;s global logistics run on Kubernetes. A supply-chain compromise planted an
        implant inside its cluster, and Citrus Dynamics bought the foothold. What happens next is
        up to you.
      </p>
      <Link href="/campaign-select" className="rounded bg-mango-500 px-6 py-3 font-semibold text-mango-950">
        Begin Investigation
      </Link>
    </main>
  );
}

"use client"; // Make it a client component

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { LoadingSpinner } from '@/components/common/loading-spinner';

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/home');
  }, [router]);

  // Optional: Render a loading state or minimal content while redirecting
  // This improves user experience by showing something while the redirect happens.
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-background text-foreground">
      <LoadingSpinner size={48} />
      <p className="mt-4 text-lg font-semibold">Redirecting to application...</p>
    </div>
  );
}

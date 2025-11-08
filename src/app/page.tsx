"use client";

export default function RootPage() {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-background text-foreground">
      <h1 className="text-4xl font-bold">AI-TeleSuite</h1>
      <p className="mt-4 text-lg">
        <a href="/home" className="text-blue-500 underline">Go to Home</a>
      </p>
    </div>
  );
}
// Test deployment

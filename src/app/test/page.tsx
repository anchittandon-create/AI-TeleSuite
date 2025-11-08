"use client";

export default function TestPage() {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-background text-foreground">
      <h1 className="text-4xl font-bold">✅ Server is Working!</h1>
      <p className="mt-4 text-lg">Cost optimization is active</p>
      <div className="mt-8 space-y-2">
        <a href="/home" className="block text-blue-500 underline">Go to Home</a>
        <a href="/call-scoring" className="block text-blue-500 underline">Call Scoring</a>
        <a href="/transcription" className="block text-blue-500 underline">Transcription</a>
      </div>
    </div>
  );
}

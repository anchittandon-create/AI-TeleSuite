
"use client";

import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Lightbulb, BookOpenText, CheckCircle } from "lucide-react";
import Image from "next/image";

export default function TrainingHubPage() {
  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Training Hub" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-8">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl text-primary flex items-center">
              <GraduationCapIcon className="h-8 w-8 mr-3 text-primary" />
              Welcome to the Training Hub!
            </CardTitle>
            <CardDescription>
              Sharpen your sales skills with our curated resources and AI-powered insights.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-card p-6 rounded-lg border">
                <Image 
                  src="https://placehold.co/600x400.png" 
                  alt="Sales training" 
                  width={600} 
                  height={400}
                  data-ai-hint="team collaboration"
                  className="rounded-md mb-4 w-full object-cover aspect-video"
                />
                <h3 className="text-xl font-semibold mb-2 flex items-center">
                  <BookOpenText className="h-6 w-6 mr-2 text-accent" />
                  Featured Content
                </h3>
                <p className="text-muted-foreground">
                  (Placeholder) Discover articles, videos, and best practices related to effective sales techniques, product knowledge, and objection handling.
                </p>
              </div>
              <div className="bg-card p-6 rounded-lg border">
                 <Image 
                  src="https://placehold.co/600x400.png" 
                  alt="AI analysis" 
                  width={600} 
                  height={400}
                  data-ai-hint="data analysis"
                  className="rounded-md mb-4 w-full object-cover aspect-video"
                />
                <h3 className="text-xl font-semibold mb-2 flex items-center">
                  <Lightbulb className="h-6 w-6 mr-2 text-accent" />
                  AI-Driven Insights
                </h3>
                <p className="text-muted-foreground">
                  (Placeholder) Access personalized feedback and trends derived from your call scores and pitch generation activities to identify areas for growth.
                </p>
              </div>
            </div>
            <div className="bg-card p-6 rounded-lg border mt-6">
                <h3 className="text-xl font-semibold mb-2 flex items-center">
                    <CheckCircle className="h-6 w-6 mr-2 text-green-500" />
                    Coming Soon
                </h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li>Interactive training modules.</li>
                    <li>Role-playing scenarios with AI feedback.</li>
                    <li>Integration with Knowledge Base for dynamic learning paths.</li>
                    <li>Team performance leaderboards (optional).</li>
                </ul>
            </div>

          </CardContent>
        </Card>
      </main>
    </div>
  );
}

// Placeholder for GraduationCap icon, assuming lucide-react might not have it or for styling consistency
function GraduationCapIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.838l8.57 3.908a2 2 0 0 0 1.66 0z" />
      <path d="M22 10v6" />
      <path d="M6 12v5c0 3 2.39 4 5 4s5-1 5-4v-5" />
    </svg>
  );
}

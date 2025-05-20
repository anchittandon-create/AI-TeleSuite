
"use client";

import Link from 'next/link';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lightbulb, ListChecks, Zap } from 'lucide-react'; // Added Zap for a generic "feature" icon

export default function HomePage() {
  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Home" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="container mx-auto">
          <Card className="mb-8 shadow-lg border-primary/20">
            <CardHeader>
              <CardTitle className="text-3xl font-bold text-primary flex items-center">
                <Zap className="h-8 w-8 mr-3 text-accent" />
                Welcome to AI_TeleSuite!
              </CardTitle>
              <CardDescription className="text-lg text-muted-foreground">
                Your intelligent partner for boosting telesales productivity and effectiveness.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="mb-6 text-foreground">
                AI_TeleSuite leverages cutting-edge AI to help you craft compelling pitches, generate smart rebuttals,
                analyze call performance, and manage your sales knowledge efficiently. Explore the modules to get started.
              </p>
              <div className="text-center">
                <Link href="/pitch-generator">
                  <Button size="lg" className="bg-accent hover:bg-accent/90 text-accent-foreground">
                    <Lightbulb className="mr-2 h-5 w-5" /> Generate Your First Pitch
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 gap-6">
            <Link href="/pitch-generator" className="hover:no-underline">
              <Card className="hover:shadow-xl transition-shadow duration-300 h-full">
                <CardHeader>
                  <CardTitle className="flex items-center text-xl text-primary">
                    <Lightbulb className="mr-2 h-6 w-6" />
                    AI Pitch Generator
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Craft tailored sales pitches optimized for your target audience and product.
                  </p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/call-scoring" className="hover:no-underline">
              <Card className="hover:shadow-xl transition-shadow duration-300 h-full">
                <CardHeader>
                  <CardTitle className="flex items-center text-xl text-primary">
                    <ListChecks className="mr-2 h-6 w-6" />
                    AI Call Scoring
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Analyze call recordings for transcriptions, performance metrics, and actionable feedback.
                  </p>
                </CardContent>
              </Card>
            </Link>
          </div>
           <div className="mt-12 text-center text-sm text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} AI_TeleSuite. Empowering Sales Teams.</p>
          </div>
        </div>
      </main>
    </div>
  );
}

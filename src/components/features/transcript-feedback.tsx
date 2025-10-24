"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageSquarePlus, ThumbsUp, ThumbsDown, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import type { TranscriptFeedback } from '@/types';

interface TranscriptFeedbackProps {
  transcriptId: string;
  activityId: string;
  onFeedbackSubmit?: (feedback: TranscriptFeedback) => void;
  existingFeedback?: TranscriptFeedback;
  compact?: boolean;
}

export function TranscriptFeedbackComponent({
  transcriptId,
  activityId,
  onFeedbackSubmit,
  existingFeedback,
  compact = false,
}: TranscriptFeedbackProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [rating, setRating] = useState<'excellent' | 'good' | 'fair' | 'poor'>(
    existingFeedback?.rating || 'good'
  );
  const [accuracyIssues, setAccuracyIssues] = useState(existingFeedback?.accuracyIssues || false);
  const [speakerAttributionIssues, setSpeakerAttributionIssues] = useState(
    existingFeedback?.speakerAttributionIssues || false
  );
  const [languageIssues, setLanguageIssues] = useState(existingFeedback?.languageIssues || false);
  const [comments, setComments] = useState(existingFeedback?.comments || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);

    const feedback: TranscriptFeedback = {
      rating,
      accuracyIssues,
      speakerAttributionIssues,
      languageIssues,
      comments,
      timestamp: new Date().toISOString(),
      reviewedBy: 'Anchit', // TODO: Get from auth context
    };

    try {
      // Save feedback to activity log
      const activities = JSON.parse(localStorage.getItem('activities') || '[]');
      const activityIndex = activities.findIndex((a: any) => a.id === activityId);
      
      if (activityIndex !== -1) {
        activities[activityIndex].userFeedback = feedback;
        localStorage.setItem('activities', JSON.stringify(activities));
      }

      // Call optional callback
      if (onFeedbackSubmit) {
        onFeedbackSubmit(feedback);
      }

      toast({
        title: "Feedback Submitted",
        description: "Thank you for your feedback! This helps improve transcription quality.",
        duration: 3000,
      });

      setIsOpen(false);
    } catch (error) {
      console.error('Failed to submit feedback:', error);
      toast({
        title: "Submission Failed",
        description: "Could not save feedback. Please try again.",
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRatingIcon = (rating: string) => {
    switch (rating) {
      case 'excellent':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'good':
        return <ThumbsUp className="h-4 w-4 text-blue-500" />;
      case 'fair':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'poor':
        return <ThumbsDown className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  if (compact && existingFeedback) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {getRatingIcon(existingFeedback.rating)}
        <span className="capitalize">{existingFeedback.rating}</span>
        {existingFeedback.comments && (
          <span className="text-xs">• {existingFeedback.comments.substring(0, 50)}...</span>
        )}
      </div>
    );
  }

  if (!isOpen) {
    return (
      <Button
        variant={existingFeedback ? "outline" : "secondary"}
        size="sm"
        onClick={() => setIsOpen(true)}
        className="gap-2"
      >
        <MessageSquarePlus className="h-4 w-4" />
        {existingFeedback ? 'Update Feedback' : 'Rate Transcript'}
      </Button>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquarePlus className="h-5 w-5" />
          Transcript Quality Feedback
        </CardTitle>
        <CardDescription>
          Help us improve transcription accuracy by providing your feedback on this transcript.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Rating */}
        <div className="space-y-3">
          <Label className="text-base font-semibold">Overall Quality Rating</Label>
          <RadioGroup value={rating} onValueChange={(value: any) => setRating(value)}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="excellent" id="excellent" />
              <Label htmlFor="excellent" className="flex items-center gap-2 cursor-pointer">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Excellent - Perfect transcription
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="good" id="good" />
              <Label htmlFor="good" className="flex items-center gap-2 cursor-pointer">
                <ThumbsUp className="h-4 w-4 text-blue-500" />
                Good - Minor issues only
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="fair" id="fair" />
              <Label htmlFor="fair" className="flex items-center gap-2 cursor-pointer">
                <AlertCircle className="h-4 w-4 text-yellow-500" />
                Fair - Several issues present
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="poor" id="poor" />
              <Label htmlFor="poor" className="flex items-center gap-2 cursor-pointer">
                <ThumbsDown className="h-4 w-4 text-red-500" />
                Poor - Major accuracy problems
              </Label>
            </div>
          </RadioGroup>
        </div>

        {/* Issue Types */}
        <div className="space-y-3">
          <Label className="text-base font-semibold">Specific Issues (select all that apply)</Label>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="accuracy"
                checked={accuracyIssues}
                onCheckedChange={(checked) => setAccuracyIssues(checked as boolean)}
              />
              <Label htmlFor="accuracy" className="cursor-pointer">
                Accuracy Issues (wrong words, missing words, incorrect transcription)
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="speaker"
                checked={speakerAttributionIssues}
                onCheckedChange={(checked) => setSpeakerAttributionIssues(checked as boolean)}
              />
              <Label htmlFor="speaker" className="cursor-pointer">
                Speaker Attribution Issues (wrong speaker labels, incorrect names)
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="language"
                checked={languageIssues}
                onCheckedChange={(checked) => setLanguageIssues(checked as boolean)}
              />
              <Label htmlFor="language" className="cursor-pointer">
                Language/Transliteration Issues (Hindi/English mixing, incorrect Roman script)
              </Label>
            </div>
          </div>
        </div>

        {/* Comments */}
        <div className="space-y-2">
          <Label htmlFor="comments" className="text-base font-semibold">
            Additional Comments (Optional)
          </Label>
          <Textarea
            id="comments"
            placeholder="Provide specific feedback about what's wrong and how it should be corrected. Example: 'At 1:25, the agent says 'subscription' but it's transcribed as 'description'."
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            rows={4}
            className="resize-none"
          />
          <p className="text-xs text-muted-foreground">
            Be specific! Your feedback helps improve our AI models.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Compact display component for showing existing feedback in tables/lists
export function TranscriptFeedbackBadge({ feedback }: { feedback?: TranscriptFeedback }) {
  if (!feedback) {
    return (
      <span className="text-xs text-muted-foreground italic">No feedback yet</span>
    );
  }

  const getRatingColor = (rating: string) => {
    switch (rating) {
      case 'excellent': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'good': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'fair': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'poor': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const hasIssues = feedback.accuracyIssues || feedback.speakerAttributionIssues || feedback.languageIssues;

  return (
    <div className="flex items-center gap-2">
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getRatingColor(feedback.rating)}`}>
        {feedback.rating}
      </span>
      {hasIssues && (
        <AlertCircle className="h-4 w-4 text-orange-500" title="Issues reported" />
      )}
    </div>
  );
}

export default TranscriptFeedbackComponent;

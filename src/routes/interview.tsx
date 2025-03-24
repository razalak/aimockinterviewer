import { VideoAnalysis } from "@/components/video-analysis";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Mic, MicOff } from "lucide-react";
import { useState, useRef } from "react";
import { toast } from "react-hot-toast";
import { Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";

export const Interview = () => {
  const [videoAnalysis, setVideoAnalysis] = useState<Array<{
    confidence: number;
    expressions: Record<string, number>;
    timestamp: number;
  }>>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [answer, setAnswer] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const handleVideoAnalysis = (analysis: {
    confidence: number;
    expressions: Record<string, number>;
    timestamp: number;
  }) => {
    setVideoAnalysis(prev => [...prev, analysis]);
  };

  const getExpressionSummary = () => {
    if (videoAnalysis.length === 0) return null;

    const expressions = videoAnalysis.reduce((acc, curr) => {
      Object.entries(curr.expressions).forEach(([expression, value]) => {
        acc[expression] = (acc[expression] || 0) + value;
      });
      return acc;
    }, {} as Record<string, number>);

    // Calculate averages
    Object.keys(expressions).forEach(key => {
      expressions[key] = expressions[key] / videoAnalysis.length;
    });

    // Find dominant expressions
    const dominantExpressions = Object.entries(expressions)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([expression, value]) => ({
        expression,
        value: Math.round(value * 100),
      }));

    return dominantExpressions;
  };

  const startRecording = () => {
    setIsRecording(true);
    setVideoAnalysis([]); // Reset video analysis when starting new recording
  };

  const stopRecording = () => {
    setIsRecording(false);
  };

  const handleSubmit = async () => {
    try {
      setIsLoading(true);
      stopRecording();
      const expressionSummary = getExpressionSummary();
      
      const feedback = await generateFeedback({
        question: currentQuestion.question,
        answer: answer,
        jobPosition: interview.jobPosition,
        jobDescription: interview.jobDescription,
        requiredExperience: interview.requiredExperience,
        requiredTechStack: interview.requiredTechStack,
        candidateProfile: interview.candidateProfile,
        expressionAnalysis: expressionSummary,
      });

      // ... rest of the submit logic ...
    } catch (error) {
      console.error(error);
      toast.error("Error", {
        description: "Failed to generate feedback. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* ... existing header ... */}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          {/* Question Card */}
          <Card className="p-6">
            {/* ... existing question card content ... */}
          </Card>

          {/* Answer Input */}
          <Card className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Your Answer</h3>
                <Button
                  variant={isRecording ? "destructive" : "default"}
                  onClick={isRecording ? stopRecording : startRecording}
                  className="flex items-center gap-2"
                >
                  {isRecording ? (
                    <>
                      <MicOff className="w-4 h-4" />
                      Stop Recording
                    </>
                  ) : (
                    <>
                      <Mic className="w-4 h-4" />
                      Start Recording
                    </>
                  )}
                </Button>
              </div>
              <Textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Type your answer here..."
                className="min-h-[200px]"
                disabled={isRecording}
              />
            </div>
          </Card>

          {/* Submit Button */}
          <Button
            onClick={handleSubmit}
            disabled={isLoading || !answer.trim() || isRecording}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating Feedback...
              </>
            ) : (
              "Submit Answer"
            )}
          </Button>
        </div>

        {/* Video Analysis Section */}
        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Video Analysis</h3>
            <VideoAnalysis 
              onAnalysisComplete={handleVideoAnalysis} 
              isRecording={isRecording}
            />
            {videoAnalysis.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-medium mb-2">Expression Analysis</h4>
                <div className="space-y-2">
                  {getExpressionSummary()?.map(({ expression, value }) => (
                    <div key={expression} className="flex items-center justify-between">
                      <span className="text-sm capitalize">{expression}</span>
                      <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary"
                          style={{ width: `${value}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}; 
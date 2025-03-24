import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import * as faceapi from "face-api.js";

interface VideoAnalysisProps {
  onAnalysisComplete: (analysis: {
    confidence: number;
    expressions: Record<string, number>;
    timestamp: number;
  }) => void;
  isRecording?: boolean;
}

export const VideoAnalysis = ({ onAnalysisComplete, isRecording = false }: VideoAnalysisProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    // Load face-api models
    const loadModels = async () => {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
        faceapi.nets.faceExpressionNet.loadFromUri("/models"),
      ]);
    };
    loadModels();

    // Start camera immediately
    startCamera();

    return () => {
      stopCamera();
    };
  }, []);

  // Handle recording state changes
  useEffect(() => {
    if (isRecording) {
      startRecording();
    } else {
      stopRecording();
    }
  }, [isRecording]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      startAnalysis();
    } catch (error) {
      console.error("Error accessing camera:", error);
    }
  };

  const startRecording = () => {
    if (streamRef.current) {
      chunksRef.current = [];
      const mediaRecorder = new MediaRecorder(streamRef.current, {
        mimeType: 'video/webm;codecs=vp8,opus'
      });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(1000); // Collect data every second
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
  };

  const stopCamera = () => {
    stopRecording();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsAnalyzing(false);
  };

  const startAnalysis = () => {
    setIsAnalyzing(true);
    analyzeFrame();
  };

  const analyzeFrame = async () => {
    if (!isAnalyzing || !videoRef.current) return;

    try {
      const detections = await faceapi
        .detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions())
        .withFaceExpressions();

      if (detections.length > 0) {
        const face = detections[0];
        const expressions = face.expressions;
        const confidence = face.detection.score;

        onAnalysisComplete({
          confidence,
          expressions: expressions as Record<string, number>,
          timestamp: Date.now(),
        });
      }
    } catch (error) {
      console.error("Error analyzing frame:", error);
    }

    // Continue analyzing frames
    requestAnimationFrame(analyzeFrame);
  };

  return (
    <Card className="p-4">
      <div className="flex flex-col items-center gap-4">
        <div className="relative w-full max-w-2xl aspect-video bg-black rounded-lg overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          {isRecording && (
            <div className="absolute top-2 right-2 bg-red-500 text-white px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
              Recording
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}; 
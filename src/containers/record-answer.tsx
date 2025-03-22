import WebCam from "react-webcam";
import {
  CircleStop,
  Download,
  Loader,
  Mic,
  RefreshCw,
  Save,
  Video,
  VideoOff,
  WebcamIcon,
} from "lucide-react";

import { TooltipButton } from "@/components/tooltip-button";
import { useEffect, useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import { chatSession } from "@/scripts/ai-studio";
import { SaveModal } from "@/components/save-modal";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  getDoc,
} from "firebase/firestore";
import { db, storage } from "@/config/firebase.config";
import { useAuth } from "@clerk/clerk-react";
import { useParams } from "react-router-dom";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

// TypeScript interfaces for the Web Speech API
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: {
    [key: number]: {
      [key: number]: {
        transcript: string;
      };
      isFinal: boolean;
      length: number;
    };
    length: number;
  };
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  onend: (event: Event) => void;
}

// Augment the Window interface to include SpeechRecognition
declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  }
}

interface RecordAnswerProps {
  question: { question: string; answer: string };
  isWebCam: boolean;
  setIsWebCam: (value: boolean) => void;
}

interface AIResponse {
  ratings: number;
  feedback: string;
}

interface SavedMedia {
  videoBlob: Blob | null;
  audioBlob: Blob | null;
}

export const RecordAnswer = ({
  question,
  isWebCam,
  setIsWebCam,
}: RecordAnswerProps) => {
  const webcamRef = useRef<WebCam>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const [recordedMedia, setRecordedMedia] = useState<SavedMedia>({
    videoBlob: null,
    audioBlob: null,
  });
  
  const [webcamError, setWebcamError] = useState<string | null>(null);
  const [micPermission, setMicPermission] = useState<PermissionState | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [permissionBlocked, setPermissionBlocked] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [audioTranscript, setAudioTranscript] = useState("");
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const [userAnswer, setUserAnswer] = useState("");
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [aiResult, setAiResult] = useState<AIResponse | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const { userId } = useAuth();
  const { interviewId } = useParams();

  // Add these state variables at the top of your component
  const [savedAnswers, setSavedAnswers] = useState<{
    question: string;
    correctAnswer: string;
    userAnswer: string;
    recordingUrl?: string;
  }[]>([]);

  // Add these state variables for interview completion
  const [isCompletingInterview, setIsCompletingInterview] = useState(false);
  const [interviewFeedback, setInterviewFeedback] = useState<{
    overallScore: number;
    feedback: string;
    strengths: string[];
    improvements: string[];
  } | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);

  // Replace the browser compatibility check with a more accurate one
  const isBrowserCompatible = useRef(() => {
    if (typeof window === 'undefined') return false;
    
    // Check if we're in a secure context (required for speech recognition)
    const isSecureContext = window.isSecureContext;
    
    // Check for specific browser support
    const hasMediaRecorder = !!window.MediaRecorder;
    const hasSpeechRecognition = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    
    console.log("Browser compatibility check:", { 
      hasMediaRecorder, 
      hasSpeechRecognition,
      isSecureContext,
      userAgent: navigator.userAgent
    });
    
    if (!isSecureContext) {
      console.error("Speech recognition requires a secure context (HTTPS)");
      toast.error("Secure Connection Required", {
        description: "Speech recognition requires HTTPS. Please use a secure connection.",
      });
    }
    
    return hasMediaRecorder && hasSpeechRecognition && isSecureContext;
  }).current();

  // Modify the speech recognition initialization to be more direct
  useEffect(() => {
    // Only initialize if we're in a compatible browser
    if (!isBrowserCompatible) return;
    
    try {
      // Create a direct instance without checking again
      const SpeechRecognitionAPI = window.webkitSpeechRecognition || window.SpeechRecognition;
      const recognition = new SpeechRecognitionAPI();
      
      // Basic configuration
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      
      console.log("Speech recognition instance created");
      
      // Set up event handlers
      recognition.onstart = () => {
        console.log("Speech recognition started");
      };
      
      recognition.onresult = (event) => {
        console.log("Speech recognition result received");
        let interimTranscript = '';
        let finalTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';
          } else {
            interimTranscript += transcript;
          }
        }
        
        if (finalTranscript) {
          console.log("Final transcript:", finalTranscript);
          setUserAnswer(prev => prev + finalTranscript);
        }
        
        setAudioTranscript(interimTranscript);
      };
      
      recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        
        if (event.error === 'not-allowed') {
          setPermissionBlocked(true);
          toast.error("Microphone Access Denied", {
            description: "Please allow microphone access to use speech recognition.",
          });
        }
      };
      
      // Store the recognition instance
      recognitionRef.current = recognition;
    } catch (error) {
      console.error("Failed to initialize speech recognition:", error);
    }
    
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // Ignore errors when stopping
        }
      }
    };
  }, [isBrowserCompatible]); // Only depend on browser compatibility

  // Check microphone permission on component mount
  useEffect(() => {
    const checkMicrophonePermission = async () => {
      try {
        if (navigator.permissions && navigator.permissions.query) {
          const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
          setMicPermission(permissionStatus.state);
          setPermissionBlocked(permissionStatus.state === 'denied');

          permissionStatus.onchange = () => {
            setMicPermission(permissionStatus.state);
            setPermissionBlocked(permissionStatus.state === 'denied');
            
            if (permissionStatus.state === 'granted') {
              toast.success("Microphone Access Granted", {
                description: "Your microphone is now available for recording.",
              });
            }
          };
        }
      } catch (error) {
        console.error('Error checking microphone permission:', error);
      }
    };

    checkMicrophonePermission();

    if (!isBrowserCompatible) {
      toast.error("Browser Not Supported", {
        description: "Your browser doesn't support recording features. Please try Chrome, Edge, or Firefox.",
        duration: 10000,
      });
    }
  }, [isBrowserCompatible]);

  // Request microphone and camera access
  const requestMediaAccess = async () => {
    setIsInitializing(true);
    try {
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
      }

      // Request both audio and video
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: isWebCam ? {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user",
        } : false
      });
      
      setMediaStream(stream);
      setMicPermission('granted');
      
      // Create a new MediaRecorder instance
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('video/webm') 
          ? 'video/webm' 
          : 'video/mp4'
      });
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          setRecordedChunks(prev => [...prev, event.data]);
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      
      if (isWebCam) {
        setIsWebCam(true);
        toast.success("Camera and Microphone Access Granted", {
          description: "You can now start recording your answer with video.",
        });
      } else {
        toast.success("Microphone Access Granted", {
          description: "You can now start recording your answer.",
        });
      }
      
      return true;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      setMicPermission('denied');
      setMediaStream(null);
      setIsWebCam(false);
      toast.error("Media Access Denied", {
        description: "Please allow microphone and camera access to record your answer.",
      });
      return false;
    } finally {
      setIsInitializing(false);
    }
  };

  // Webcam configuration
  const videoConstraints = {
    width: 1280,
    height: 720,
    facingMode: "user",
  };

  const handleUserMedia = useCallback((stream: MediaStream) => {
    setWebcamError(null);
    setIsWebCam(true);
    setMediaStream(stream);
    toast.success("Camera Connected", {
      description: "Your webcam has been successfully connected.",
    });
  }, [setIsWebCam]);

  const handleUserMediaError = useCallback((error: string | DOMException) => {
    console.error("Webcam error:", error);
    setWebcamError(error.toString());
    setIsWebCam(false);
    toast.error("Camera Error", {
      description: "Failed to access webcam. Please check your permissions.",
    });
  }, [setIsWebCam]);

  // Function to help reset permissions
  const resetPermissions = () => {
    try {
      const isChrome = /Chrome/.test(navigator.userAgent);
      const isFirefox = /Firefox/.test(navigator.userAgent);
      const isEdge = /Edg/.test(navigator.userAgent);
      
      let instructions = '';
      
      if (isChrome || isEdge) {
        instructions = "Click the padlock icon in the address bar, find 'Microphone' and 'Camera', and change them to 'Allow'. Then refresh the page.";
      } else if (isFirefox) {
        instructions = "Click the padlock icon in the address bar, click 'Connection Secure' > 'More Information', go to 'Permissions' tab, and allow microphone and camera access. Then refresh the page.";
      } else {
        instructions = "Check your browser settings to allow microphone and camera access for this website, then refresh the page.";
      }
      
      toast.info("Permission Reset Instructions", {
        description: instructions,
        duration: 8000,
      });
    } catch (error) {
      console.error('Error in resetPermissions:', error);
    }
  };

  const startRecording = async () => {
    setRecordedChunks([]);
    setUserAnswer("");
    setAudioTranscript("");
    
    // Check for permission blocks
    if (permissionBlocked) {
      resetPermissions();
      return;
    }
    
    // Check for initialization in progress
    if (isInitializing) {
      toast.error("Please wait", {
        description: "Media devices are being initialized...",
      });
      return;
    }
    
    // Request media access if needed
    if (micPermission !== 'granted' || !mediaStream) {
      const hasAccess = await requestMediaAccess();
      if (!hasAccess) {
        setPermissionBlocked(true);
        return;
      }
    }
    
    try {
      // Start media recorder
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.start(1000);
      }
      
      // Start speech recognition - simplified approach
      if (recognitionRef.current) {
        try {
          // First stop any existing recognition
          try {
            recognitionRef.current.stop();
          } catch (e) {
            // Ignore stop errors
          }
          
          // Start after a short delay
          setTimeout(() => {
            try {
              recognitionRef.current?.start();
              console.log("Speech recognition started");
            } catch (e) {
              console.error("Failed to start speech recognition:", e);
            }
          }, 200);
        } catch (e) {
          console.error("Error in speech recognition start sequence:", e);
        }
      } else {
        console.warn("Speech recognition not available");
      }
      
      setIsRecording(true);
      toast.success("Recording Started", {
        description: "Your answer is now being recorded.",
      });
    } catch (error) {
      console.error("Failed to start recording:", error);
      toast.error("Recording Error", {
        description: "Failed to start recording. Please check your device permissions.",
      });
    }
  };

  const stopRecording = async () => {
    try {
      // Stop Speech Recognition
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // If stopping fails, try to abort
          try {
            recognitionRef.current.abort();
          } catch (abortError) {
            console.error("Error stopping and aborting speech recognition:", abortError);
          }
        }
      }
      
      // Stop MediaRecorder
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      
      setIsRecording(false);
      
      // If we have a very short answer, show warning
      if (userAnswer?.length < 30) {
        if (userAnswer?.length === 0) {
          toast.error("No Answer Detected", {
            description: "We couldn't detect any speech. Please try recording again.",
          });
          return;
        } else {
          toast.warning("Short Answer", {
            description: "Your answer is very short. Consider providing more details.",
          });
        }
      }

      // Process recorded chunks
      if (recordedChunks.length > 0) {
        processRecordedMedia();
        toast.success("Recording Finished", {
          description: "Your answer has been recorded and is ready to save.",
        });
      }
    } catch (error) {
      console.error("Error stopping recording:", error);
      toast.error("Recording Error", {
        description: "There was an error stopping the recording.",
      });
    }
  };

  // Process the recording without creating download URLs
  const processRecordedMedia = () => {
    if (recordedChunks.length === 0) return;
    
    try {
      // Create recording blob
      const recordingType = isWebCam ? 'video/webm' : 'audio/webm';
      const recordingBlob = new Blob(recordedChunks, { type: recordingType });
      
      if (isWebCam) {
        // If we have video, store video blob and extract audio
        setRecordedMedia(prev => ({
          ...prev,
          videoBlob: recordingBlob
        }));
        
        // For videos, extract the audio track for separate audio storage
        extractAudioFromVideo(recordingBlob);
      } else {
        // If audio-only recording, just store audio blob
        setRecordedMedia(prev => ({
          ...prev,
          audioBlob: recordingBlob
        }));
      }
    } catch (error) {
      console.error("Error processing recording:", error);
      toast.error("Processing Error", {
        description: "Failed to process the recording.",
      });
    }
  };
  
  // Function to extract audio from video
  const extractAudioFromVideo = async (videoBlob: Blob) => {
    try {
      const videoUrl = URL.createObjectURL(videoBlob);
      const video = document.createElement('video');
      video.src = videoUrl;
      
      // Create an audio context
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const mediaSource = audioContext.createMediaElementSource(video);
      const destination = audioContext.createMediaStreamDestination();
      mediaSource.connect(destination);
      
      // Create a media recorder for the audio stream
      const audioRecorder = new MediaRecorder(destination.stream);
      const audioChunks: Blob[] = [];
      
      audioRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunks.push(e.data);
        }
      };
      
      audioRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        setRecordedMedia(prev => ({
          ...prev,
          audioBlob: audioBlob
        }));
      };
      
      // Start playback and recording
      audioRecorder.start();
      video.play();
      
      // Stop when video ends
      video.onended = () => {
        audioRecorder.stop();
        video.remove();
        URL.revokeObjectURL(videoUrl);
      };
      
      // If video doesn't have duration info yet, manually stop after a reasonable time
      setTimeout(() => {
        if (audioRecorder.state === 'recording') {
          video.pause();
          audioRecorder.stop();
          video.remove();
          URL.revokeObjectURL(videoUrl);
        }
      }, 1000); // Short timeout since we just need the audio tracks, not a full playback
      
    } catch (error) {
      console.error("Error extracting audio:", error);
    }
  };
  
  // Upload the recorded media to Firebase Storage
  const uploadMediaToStorage = async (answerId: string) => {
    try {
      console.log("Uploading media for answer ID:", answerId);
      const mediaUrls: { videoUrl?: string, audioUrl?: string } = {};
      
      // Upload video if available
      if (recordedMedia.videoBlob) {
        console.log("Uploading video blob:", recordedMedia.videoBlob.size, "bytes");
        const videoRef = ref(storage, `recordings/${userId}/${answerId}/video.webm`);
        
        try {
          await uploadBytes(videoRef, recordedMedia.videoBlob);
          const videoUrl = await getDownloadURL(videoRef);
          mediaUrls.videoUrl = videoUrl;
          console.log("Video uploaded successfully:", videoUrl);
        } catch (videoError) {
          console.error("Error uploading video:", videoError);
        }
      }
      
      // Upload audio if available
      if (recordedMedia.audioBlob) {
        console.log("Uploading audio blob:", recordedMedia.audioBlob.size, "bytes");
        const audioRef = ref(storage, `recordings/${userId}/${answerId}/audio.webm`);
        
        try {
          await uploadBytes(audioRef, recordedMedia.audioBlob);
          const audioUrl = await getDownloadURL(audioRef);
          mediaUrls.audioUrl = audioUrl;
          console.log("Audio uploaded successfully:", audioUrl);
        } catch (audioError) {
          console.error("Error uploading audio:", audioError);
        }
      }
      
      return mediaUrls;
    } catch (error) {
      console.error("Error in uploadMediaToStorage:", error);
      throw error; // Re-throw to handle in the calling function
    }
  };

  const recordNewAnswer = async () => {
    if (isInitializing) {
      toast.error("Please wait", {
        description: "Media devices are being initialized...",
      });
      return;
    }
    
    // Stop current recording
    if (isRecording) {
      // Stop Speech Recognition
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // Ignore errors when stopping inactive recognition
        }
      }
      
      // Stop MediaRecorder
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    }
    
    // Reset state
    setRecordedChunks([]);
    setUserAnswer("");
    setAudioTranscript("");
    setIsRecording(false);
    setRecordedMedia({
      videoBlob: null,
      audioBlob: null,
    });
    
    // Slight delay before starting new recording
    setTimeout(() => {
      startRecording();
    }, 500);
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const cleanJsonResponse = (responseText: string) => {
    // Step 1: Trim any surrounding whitespace
    let cleanText = responseText.trim();

    // Step 2: Try to extract JSON from the response
    const jsonRegex = /{[\s\S]*}/;
    const match = cleanText.match(jsonRegex);
    
    if (match) {
      cleanText = match[0];
    } else {
      // If no JSON object found, remove any markdown or code block markers
      cleanText = cleanText.replace(/(```json|```|`)/g, "").trim();
    }

    // Step 3: Parse the clean JSON text
    try {
      const result = JSON.parse(cleanText);
      
      // Ensure the result has the expected format
      if (typeof result.ratings !== 'number') {
        result.ratings = parseInt(result.ratings) || 5;
      }
      
      if (!result.feedback || typeof result.feedback !== 'string') {
        result.feedback = "Feedback could not be properly generated.";
      }
      
      return result;
    } catch (error) {
      console.error("JSON parsing error:", error, "Raw text:", cleanText);
      // Return a default response if parsing fails
      return {
        ratings: 5,
        feedback: "We encountered an issue processing the AI feedback. Your answer has been recorded."
      };
    }
  };

  const generateResult = async (
    qst: string,
    qstAns: string,
    userAns: string
  ): Promise<AIResponse> => {
    setIsAiGenerating(true);

    const prompt = `
      Question: "${qst}"
      User Answer: "${userAns}"
      Correct Answer: "${qstAns}"
      
      Please evaluate the user's answer against the correct answer considering these criteria:
      1. Accuracy - How factually correct is the answer? (40% of score)
      2. Completeness - Did the user cover all key points from the correct answer? (30% of score)
      3. Clarity - How clear and well-structured is the user's response? (15% of score)
      4. Relevance - Did the user address what was specifically asked in the question? (15% of score)
      
      Provide:
      1. A numerical rating from 1 to 10 (where 10 is perfect)
      2. Specific, constructive feedback highlighting strengths and suggesting improvements
      3. At least one specific example of what was done well and what could be improved
      4. A brief summary of how the answer could be improved for a better score
      
      Return your evaluation in JSON format with these fields:
      - "ratings": number (1-10)
      - "feedback": string (detailed feedback)
    `;

    try {
      console.log("Sending prompt to AI:", prompt);
      const aiResult = await chatSession.sendMessage(prompt);
      console.log("AI response received:", aiResult.response.text());

      const parsedResult: AIResponse = cleanJsonResponse(
        aiResult.response.text()
      );
      
      // Validate the result
      if (typeof parsedResult.ratings !== 'number' || !parsedResult.feedback) {
        console.error("Invalid AI response format:", parsedResult);
        throw new Error("Invalid AI response format");
      }
      
      return parsedResult;
    } catch (error) {
      console.error("Error generating AI feedback:", error);
      toast.error("AI Feedback Error", {
        description: "An error occurred while generating feedback. Please try again.",
      });
      return { 
        ratings: 5, 
        feedback: "We couldn't generate detailed feedback at this time. Your answer has been recorded, but please try again for a complete evaluation." 
      };
    } finally {
      setIsAiGenerating(false);
    }
  };

  // First, let's modify the saveUserAnswer function to be more robust
  const saveUserAnswer = async () => {
    setLoading(true);

    if (!userAnswer || userAnswer.trim().length === 0) {
      toast.error("No Answer", {
        description: "Please record an answer before saving.",
      });
      setLoading(false);
      setOpen(false);
      return;
    }

    // Check if user is authenticated
    if (!userId) {
      toast.error("Authentication Error", {
        description: "You must be logged in to save answers.",
      });
      setLoading(false);
      setOpen(false);
      return;
    }

    // Check if interview ID exists
    if (!interviewId) {
      toast.error("Interview Error", {
        description: "Invalid interview session.",
      });
      setLoading(false);
      setOpen(false);
      return;
    }

    const currentQuestion = question.question;

    try {
      console.log("Saving answer for question:", currentQuestion);
      console.log("User ID:", userId);
      console.log("Interview ID:", interviewId);

      // Show saving toast
      toast.loading("Saving your answer...", { id: "saving-answer" });

      // Query Firebase to check if the user answer already exists for this question
      const userAnswerQuery = query(
        collection(db, "userAnswers"),
        where("userId", "==", userId),
        where("question", "==", currentQuestion),
        where("mockIdRef", "==", interviewId)
      );

      const querySnap = await getDocs(userAnswerQuery);

      // If the user already answered the question, don't save it again
      if (!querySnap.empty) {
        console.log("Answer already exists:", querySnap.size);
        toast.dismiss("saving-answer");
        toast.info("Already Answered", {
          description: "You have already answered this question in this interview.",
        });
        setLoading(false);
        setOpen(false);
        return;
      }

      // Prepare the answer data
      const answerData = {
        mockIdRef: interviewId,
        question: question.question,
        correct_ans: question.answer,
        user_ans: userAnswer,
        feedback: "", // No individual feedback
        rating: 0,
        userId,
        hasRecording: false, // Will update if we have recordings
        createdAt: serverTimestamp(),
      };

      console.log("Saving answer data:", answerData);

      // Save the answer
      const questionAnswerRef = await addDoc(collection(db, "userAnswers"), answerData);
      const id = questionAnswerRef.id;

      // Update with the ID
      await updateDoc(doc(db, "userAnswers", id), {
        id,
        updatedAt: serverTimestamp(),
      });

      console.log("Answer saved with ID:", id);

      // Handle recordings if available
      const hasRecordings = recordedMedia.videoBlob || recordedMedia.audioBlob;
      let mediaUrls = {};

      if (hasRecordings) {
        toast.loading("Uploading recording...", { id: "upload-recording" });
        
        try {
          // Update the document to indicate it has recordings
          await updateDoc(doc(db, "userAnswers", id), {
            hasRecording: true,
          });

          // Upload the recordings
          mediaUrls = await uploadMediaToStorage(id);
          
          // Update the document with media URLs
          await updateDoc(doc(db, "userAnswers", id), {
            mediaUrls,
            updatedAt: serverTimestamp(),
          });
          
          console.log("Media uploaded successfully:", mediaUrls);
          toast.dismiss("upload-recording");
        } catch (uploadError) {
          console.error("Error uploading media:", uploadError);
          toast.dismiss("upload-recording");
          toast.error("Upload Error", {
            description: "Your answer was saved, but there was an error uploading your recording.",
          });
        }
      }

      // Store the answer locally for end-of-interview feedback
      setSavedAnswers(prev => [...prev, {
        question: question.question,
        correctAnswer: question.answer,
        userAnswer: userAnswer,
        recordingUrl: hasRecordings ? (mediaUrls.audioUrl || mediaUrls.videoUrl) : undefined
      }]);

      // Dismiss saving toast and show success
      toast.dismiss("saving-answer");
      toast.success("Answer Saved", { 
        description: hasRecordings 
          ? "Your answer and recording have been saved." 
          : "Your answer has been saved." 
      });

      // Reset state for next question
      setUserAnswer("");
      setAudioTranscript("");
      setRecordedChunks([]);
      setRecordedMedia({
        videoBlob: null,
        audioBlob: null,
      });
      
      if (isRecording) {
        stopRecording();
      }
    } catch (error) {
      console.error("Error saving answer:", error);
      toast.dismiss("saving-answer");
      toast.error("Save Error", {
        description: "An error occurred while saving your answer. Please try again.",
      });
    } finally {
      setLoading(false);
      setOpen(false);
    }
  };

  const getAnswerWithRecordings = async (answerId: string) => {
    const answerDoc = await getDoc(doc(db, "userAnswers", answerId));
    const answerData = answerDoc.data();
    
    if (answerData?.hasRecording && answerData?.mediaUrls) {
      // Access recording URLs
      const videoUrl = answerData.mediaUrls.videoUrl;
      const audioUrl = answerData.mediaUrls.audioUrl;
      
      return {
        answer: answerData,
        recordings: {
          video: videoUrl,
          audio: audioUrl
        }
      };
    }
    
    return { answer: answerData };
  };

  // Replace the debug function with a simpler version
  const debugSpeechRecognition = () => {
    try {
      // Create a direct instance for testing
      const SpeechRecognitionAPI = window.webkitSpeechRecognition || window.SpeechRecognition;
      
      if (!SpeechRecognitionAPI) {
        toast.error("Speech Recognition Not Available", {
          description: "Your browser doesn't support speech recognition.",
        });
        return;
      }
      
      const testRecognition = new SpeechRecognitionAPI();
      testRecognition.lang = 'en-US';
      testRecognition.interimResults = true;
      
      testRecognition.onstart = () => {
        toast.success("Test Started", {
          description: "Speech recognition test started. Please speak now.",
        });
      };
      
      testRecognition.onresult = (event) => {
        const results = event.results;
        const transcript = results[results.length - 1][0].transcript;
        
        toast.success("Speech Detected!", {
          description: `Heard: "${transcript}"`,
        });
      };
      
      testRecognition.onerror = (event) => {
        toast.error(`Speech Recognition Error: ${event.error}`, {
          description: "Please check your microphone and browser permissions.",
        });
      };
      
      testRecognition.start();
      
      // Stop after 5 seconds
      setTimeout(() => {
        testRecognition.stop();
      }, 5000);
    } catch (error) {
      console.error("Test error:", error);
      toast.error("Test Failed", {
        description: "Could not initialize speech recognition test.",
      });
    }
  };

  // Add this function to generate overall interview feedback
  const generateInterviewFeedback = async () => {
    if (savedAnswers.length === 0) {
      toast.error("No Answers", {
        description: "You haven't saved any answers yet.",
      });
      return;
    }

    setIsCompletingInterview(true);
    toast.loading("Generating Interview Feedback", {
      description: "Please wait while we analyze your answers...",
      id: "interview-feedback",
    });

    try {
      // Prepare the prompt with all questions and answers
      const questionsAndAnswers = savedAnswers.map(item => {
        return `
Question: "${item.question}"
Correct Answer: "${item.correctAnswer}"
User's Answer: "${item.userAnswer}"
        `;
      }).join("\n\n");

      const prompt = `
I need you to evaluate this interview performance. The user has answered ${savedAnswers.length} questions.

${questionsAndAnswers}

Please provide:
1. An overall score from 1-10 based on the quality of all answers
2. A paragraph of general feedback about the interview performance
3. Three key strengths demonstrated in the answers
4. Three specific areas for improvement

Format your response as JSON with these fields:
- "overallScore": number (1-10)
- "feedback": string (general feedback paragraph)
- "strengths": array of strings (3 key strengths)
- "improvements": array of strings (3 areas to improve)
`;

      console.log("Sending interview feedback prompt to AI");
      const aiResult = await chatSession.sendMessage(prompt);
      console.log("AI interview feedback received");

      // Parse the response
      const responseText = aiResult.response.text();
      
      // Extract JSON from the response
      const jsonRegex = /{[\s\S]*}/;
      const match = responseText.match(jsonRegex);
      
      if (!match) {
        throw new Error("Could not extract JSON from AI response");
      }
      
      const feedbackData = JSON.parse(match[0]);
      
      // Validate the feedback data
      if (!feedbackData.overallScore || !feedbackData.feedback || 
          !Array.isArray(feedbackData.strengths) || !Array.isArray(feedbackData.improvements)) {
        throw new Error("Invalid feedback format from AI");
      }
      
      setInterviewFeedback(feedbackData);
      setShowFeedback(true);
      
      toast.dismiss("interview-feedback");
      toast.success("Interview Feedback Ready", {
        description: "Your interview performance has been evaluated.",
      });
      
      // Save the overall feedback to Firebase
      await addDoc(collection(db, "interviewFeedback"), {
        userId,
        interviewId,
        feedback: feedbackData,
        createdAt: serverTimestamp(),
      });
      
    } catch (error) {
      console.error("Error generating interview feedback:", error);
      toast.dismiss("interview-feedback");
      toast.error("Feedback Error", {
        description: "Failed to generate interview feedback. Please try again.",
      });
    } finally {
      setIsCompletingInterview(false);
    }
  };

  // Add this useEffect to load saved answers when the component mounts
  useEffect(() => {
    const loadSavedAnswers = async () => {
      if (!userId || !interviewId) return;
      
      try {
        console.log("Loading saved answers for interview:", interviewId);
        
        const savedAnswersQuery = query(
          collection(db, "userAnswers"),
          where("userId", "==", userId),
          where("mockIdRef", "==", interviewId)
        );
        
        const querySnap = await getDocs(savedAnswersQuery);
        
        if (querySnap.empty) {
          console.log("No saved answers found");
          return;
        }
        
        const answers = querySnap.docs.map(doc => {
          const data = doc.data();
          return {
            question: data.question,
            correctAnswer: data.correct_ans,
            userAnswer: data.user_ans,
            recordingUrl: data.mediaUrls?.audioUrl || data.mediaUrls?.videoUrl
          };
        });
        
        console.log("Loaded saved answers:", answers.length);
        setSavedAnswers(answers);
      } catch (error) {
        console.error("Error loading saved answers:", error);
      }
    };
    
    loadSavedAnswers();
  }, [userId, interviewId]);

  return (
    <div className="w-full flex flex-col items-center gap-8 mt-4">
      {/* Save modal */}
      <SaveModal
        isOpen={open}
        onClose={() => setOpen(false)}
        onConfirm={saveUserAnswer}
        loading={loading}
      />

      {/* Camera display */}
      <div className="w-full h-[400px] md:w-96 flex flex-col items-center justify-center border p-4 bg-gray-50 rounded-md relative">
        {isWebCam ? (
          <WebCam
            ref={webcamRef}
            audio={false} // We handle audio separately
            muted={true}
            screenshotFormat="image/jpeg"
            videoConstraints={videoConstraints}
            onUserMedia={handleUserMedia}
            onUserMediaError={handleUserMediaError}
            className="w-full h-full object-cover rounded-md"
          />
        ) : (
          <div className="flex flex-col items-center gap-2">
            <WebcamIcon className="min-w-24 min-h-24 text-muted-foreground" />
            {webcamError && (
              <p className="text-sm text-red-500 text-center">
                Camera access error. Please check your permissions.
              </p>
            )}
          </div>
        )}
        {isRecording && (
          <div className="absolute top-2 right-2 flex items-center gap-1 bg-red-500 text-white px-2 py-1 rounded-md text-xs">
            <span className="animate-pulse h-2 w-2 bg-white rounded-full"></span>
            Recording
          </div>
        )}
      </div>

      {/* Action buttons group */}
      <div className="flex items-center justify-center gap-3">
        <TooltipButton
          content={isWebCam ? "Turn Off Camera" : "Turn On Camera"}
          icon={
            isWebCam ? (
              <VideoOff className="min-w-5 min-h-5" />
            ) : (
              <Video className="min-w-5 min-h-5" />
            )
          }
          onClick={() => {
            setIsWebCam(!isWebCam);
            if (isRecording) {
              stopRecording();
            }
            // Re-request media with new camera setting
            requestMediaAccess();
          }}
          disbaled={isInitializing}
        />

        <TooltipButton
          content={
            isInitializing
              ? "Initializing..."
              : permissionBlocked
              ? "Permission Required"
              : isRecording
              ? "Stop Recording"
              : "Start Recording"
          }
          icon={
            isRecording ? (
              <CircleStop className="min-w-5 min-h-5" />
            ) : (
              <Mic className="min-w-5 min-h-5" />
            )
          }
          onClick={toggleRecording}
          disbaled={permissionBlocked || isInitializing || !isBrowserCompatible}
        />

        <TooltipButton
          content="Record Again"
          icon={<RefreshCw className="min-w-5 min-h-5" />}
          onClick={recordNewAnswer}
          disbaled={permissionBlocked || isInitializing || !isBrowserCompatible}
        />

        <TooltipButton
          content="Save Answer"
          icon={
            isAiGenerating ? (
              <Loader className="min-w-5 min-h-5 animate-spin" />
            ) : (
              <Save className="min-w-5 min-h-5" />
            )
          }
          onClick={() => {
            // Only open the save modal if we have an answer to save
            if (userAnswer && userAnswer.trim().length > 0) {
              setOpen(true);
            } else {
              toast.error("No Answer to Save", {
                description: "Please record an answer before saving.",
              });
            }
          }}
          disbaled={isRecording || !userAnswer || userAnswer.trim().length === 0}
        />
      </div>

      {/* Answer display */}
      <div className="w-full mt-4 p-4 border rounded-md bg-gray-50">
        <h2 className="text-lg font-semibold">Your Answer:</h2>
        {isInitializing ? (
          <p className="text-sm text-blue-500 mt-2">
            Initializing media devices...
          </p>
        ) : permissionBlocked ? (
          <div className="text-sm text-red-500 mt-2">
            <p>
              Microphone and camera access are blocked by your browser.
            </p>
            <button 
              onClick={resetPermissions}
              className="underline text-blue-500 mt-1"
            >
              Click here for instructions to enable it
            </button>
          </div>
        ) : !isBrowserCompatible ? (
          <p className="text-sm text-red-500 mt-2">
            Your browser doesn't support recording features. Please try Chrome, Edge, or Firefox.
          </p>
        ) : (
          <div>
            <p className="text-sm mt-2 text-gray-700 whitespace-normal">
              {userAnswer || "Start recording to see your answer here"}
            </p>
            
            {isRecording && (
              <div className="mt-3 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="animate-pulse h-3 w-3 bg-red-500 rounded-full"></span>
                  <span className="text-xs text-red-500">Recording in progress...</span>
                </div>
                
                <div className="bg-blue-50 p-2 rounded-md border border-blue-200 mt-1">
                  <p className="text-xs text-blue-700">
                    <strong>Speech status:</strong> {audioTranscript ? 'Hearing your voice...' : 'Waiting for speech...'}
                  </p>
                  {audioTranscript && (
                    <p className="text-xs text-blue-700 mt-1 italic">
                      "{audioTranscript}"
                    </p>
                  )}
                </div>
              </div>
            )}
            
            {recordedMedia.videoBlob || recordedMedia.audioBlob ? (
              <div className="mt-3 flex items-center gap-2">
                <span className="text-xs text-green-600">
                  {isWebCam ? "Video" : "Audio"} recording saved and ready to submit
                </span>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* AI Evaluation Results */}
      {!isRecording && userAnswer && (
        <div className="w-full mt-4 p-4 border rounded-md bg-white shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Your Answer</h2>
            {recordedMedia.videoBlob || recordedMedia.audioBlob ? (
              <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
                {isWebCam ? "Video" : "Audio"} recording saved
              </span>
            ) : null}
          </div>
          
          <div className="mt-2">
            <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-md max-h-40 overflow-y-auto">
              {userAnswer}
            </div>
          </div>
          
          <div className="mt-4 flex justify-between items-center">
            <button 
              onClick={recordNewAnswer}
              className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md disabled:opacity-50"
              disabled={isRecording}
            >
              Record Again
            </button>
            
            <button 
              onClick={() => setOpen(true)}
              className="text-sm bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md disabled:opacity-50"
              disabled={isRecording || !userAnswer || userAnswer.trim().length === 0}
            >
              Save Answer
            </button>
          </div>
        </div>
      )}
      
      {/* Add a Complete Interview button if there are saved answers */}
      {savedAnswers.length > 0 && (
        <div className="w-full mt-6 p-4 bg-purple-50 border border-purple-200 rounded-lg">
          <div className="text-center mb-3">
            <h3 className="text-lg font-semibold text-purple-800">
              {savedAnswers.length} {savedAnswers.length === 1 ? 'Answer' : 'Answers'} Saved
            </h3>
            <p className="text-sm text-purple-600">
              Ready to complete your interview and get feedback?
            </p>
          </div>
          
          <div className="flex justify-center">
            <button 
              onClick={generateInterviewFeedback}
              disabled={isCompletingInterview}
              className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {isCompletingInterview ? (
                <>
                  <Loader className="w-4 h-4 mr-2 animate-spin" />
                  Generating Feedback...
                </>
              ) : (
                <>
                  <span className="mr-2">✓</span>
                  Finish Interview & Get Feedback
                </>
              )}
            </button>
          </div>
        </div>
      )}
      
      {isAiGenerating && (
        <div className="w-full mt-4 p-6 border rounded-md bg-white flex flex-col items-center justify-center">
          <Loader className="w-8 h-8 animate-spin text-blue-500 mb-3" />
          <p className="text-sm text-gray-600">Processing your answer...</p>
        </div>
      )}

      {/* Add a debug button to the UI */}
      <div className="mt-4 flex justify-center">
        <button
          onClick={debugSpeechRecognition}
          className="text-sm bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-md"
        >
          Test Speech Recognition
        </button>
      </div>

      {/* Add the feedback display modal/section */}
      {showFeedback && interviewFeedback && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Interview Feedback</h2>
                <button 
                  onClick={() => setShowFeedback(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="mb-6 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-700">Overall Score</h3>
                <div className={`flex items-center justify-center rounded-full w-16 h-16 ${
                  interviewFeedback.overallScore >= 8 ? 'bg-green-100' : 
                  interviewFeedback.overallScore >= 5 ? 'bg-blue-100' : 
                  'bg-red-100'
                }`}>
                  <span className={`text-2xl font-bold ${
                    interviewFeedback.overallScore >= 8 ? 'text-green-600' : 
                    interviewFeedback.overallScore >= 5 ? 'text-blue-600' : 
                    'text-red-600'
                  }`}>{interviewFeedback.overallScore}/10</span>
                </div>
              </div>
              
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-700 mb-2">General Feedback</h3>
                <p className="text-gray-600 bg-gray-50 p-4 rounded-md">{interviewFeedback.feedback}</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-700 mb-2 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Key Strengths
                  </h3>
                  <ul className="list-disc list-inside text-gray-600 bg-green-50 p-4 rounded-md">
                    {interviewFeedback.strengths.map((strength, index) => (
                      <li key={index} className="mb-2">{strength}</li>
                    ))}
                  </ul>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold text-gray-700 mb-2 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-amber-500" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    Areas to Improve
                  </h3>
                  <ul className="list-disc list-inside text-gray-600 bg-amber-50 p-4 rounded-md">
                    {interviewFeedback.improvements.map((improvement, index) => (
                      <li key={index} className="mb-2">{improvement}</li>
                    ))}
                  </ul>
                </div>
              </div>
              
              <div className="flex justify-center mt-6">
                <button 
                  onClick={() => setShowFeedback(false)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md font-medium"
                >
                  Close Feedback
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

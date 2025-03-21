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

  // Check browser compatibility
  const isBrowserCompatible = useRef(
    typeof window !== 'undefined' && 
    (window.MediaRecorder !== undefined) && 
    (window.SpeechRecognition !== undefined || window.webkitSpeechRecognition !== undefined)
  ).current;

  // Initialize Speech Recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Create Speech Recognition object
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';
        
        recognition.onresult = (event: any) => {
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
          
          setUserAnswer(prevTranscript => prevTranscript + finalTranscript);
          setAudioTranscript(interimTranscript);
        };
        
        recognition.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          
          // Handle specific error types
          if (event.error === 'network') {
            // Network error handling
            toast.error("Network Error", {
              description: "Speech recognition service is unavailable. Check your internet connection.",
              action: {
                label: "Retry",
                onClick: () => {
                  // Try to restart recognition if it was active
                  if (isRecording) {
                    try {
                      recognitionRef.current?.abort();
                      setTimeout(() => {
                        recognitionRef.current?.start();
                        toast.success("Reconnecting...", {
                          description: "Attempting to reconnect to speech recognition service.",
                        });
                      }, 1000);
                    } catch (e) {
                      console.error("Failed to restart recognition:", e);
                    }
                  }
                }
              }
            });
            
            // Automatically try to restart recognition after a delay
            if (isRecording) {
              setTimeout(() => {
                try {
                  recognition.abort();
                  recognition.start();
                  console.log("Automatically restarting speech recognition after network error");
                } catch (e) {
                  console.error("Failed to automatically restart recognition:", e);
                }
              }, 3000);
            }
          } else if (event.error === 'no-speech') {
            // No speech detected - don't show error for this as it's common
            console.log("No speech detected");
          } else if (event.error === 'aborted') {
            // Recognition was aborted, likely by the app - don't show error
            console.log("Speech recognition aborted");
          } else {
            // Generic error for other cases
            toast.error("Recording Error", {
              description: `Speech recognition error: ${event.error}. Try stopping and starting recording again.`,
            });
          }
        };
        
        recognition.onend = (event: any) => {
          // If recording is still active but recognition ended unexpectedly, try to restart it
          if (isRecording && recognitionRef.current) {
            try {
              console.log("Speech recognition ended unexpectedly, restarting...");
              recognitionRef.current.start();
            } catch (e) {
              console.error("Failed to restart recognition after unexpected end:", e);
            }
          }
        };

        recognitionRef.current = recognition;
      }
    }
    
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // Ignore errors when stopping inactive recognition
        }
      }
      
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isRecording]);

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
    
    // If permissions are already blocked, show reset instructions
    if (permissionBlocked) {
      resetPermissions();
      return;
    }
    
    // If initializing, prevent starting another request
    if (isInitializing) {
      toast.error("Please wait", {
        description: "Media devices are being initialized...",
      });
      return;
    }
    
    // Check/request media permissions
    if (micPermission !== 'granted' || !mediaStream) {
      const hasAccess = await requestMediaAccess();
      if (!hasAccess) {
        setPermissionBlocked(true);
        return;
      }
    }

    try {
      // Start MediaRecorder
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.start(1000); // Collect data every second
      }
      
      // Start Speech Recognition with fallback mechanism
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch (e) {
          console.error("Error starting speech recognition, trying abort and restart:", e);
          try {
            // Sometimes need to abort first if there's a hanging instance
            recognitionRef.current.abort();
            setTimeout(() => {
              recognitionRef.current?.start();
            }, 300);
          } catch (innerError) {
            console.error("Failed to restart speech recognition:", innerError);
            toast.warning("Speech Recognition Issue", {
              description: "Speech-to-text may not work correctly. Your recording will continue, but transcription may be affected.",
            });
          }
        }
      }
      
      setIsRecording(true);
      toast.success("Recording Started", {
        description: "Your answer is now being recorded.",
      });
    } catch (error) {
      console.error("Failed to start recording:", error);
      
      // Check if this is a permission error
      if (error instanceof DOMException && 
          (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError')) {
        setPermissionBlocked(true);
        resetPermissions();
      } else {
        toast.error("Recording Error", {
          description: "Failed to start recording. Please check your device.",
        });
      }
      
      // Try to request permission again
      await requestMediaAccess();
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
      
      // If we have a very short answer, check if it might be due to recognition failure
      if (userAnswer?.length < 30) {
        if (recordedChunks.length > 3) {
          // We have recording chunks but little transcription, likely a recognition failure
          toast.warning("Speech Recognition Issue", {
            description: "We recorded your answer, but speech recognition may not have worked correctly. You can still save your recording.",
          });
          
          // Process the recording anyway
          if (recordedChunks.length > 0) {
            processRecordedMedia();
          }
          
          // Generate a placeholder AI result
          setAiResult({
            ratings: 0,
            feedback: "Your answer was recorded, but the speech-to-text system couldn't properly transcribe it. You can still save your recording for human review."
          });
          
          toast.success("Recording Saved", {
            description: "Your recording has been saved but transcription may be incomplete.",
          });
          return;
        } else {
          // Actually short answer
          toast.error("Error", {
            description: "Your answer should be more than 30 characters",
          });
          return;
        }
      }

      // Generate AI feedback
      const aiResult = await generateResult(
        question.question,
        question.answer,
        userAnswer
      );

      setAiResult(aiResult);
      
      // Process recorded chunks
      if (recordedChunks.length > 0) {
        processRecordedMedia();
      }
      
      toast.success("Recording Finished", {
        description: "Your answer has been recorded and is ready for review.",
      });
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
  const uploadMediaToStorage = async (answerDocId: string) => {
    try {
      const mediaUrls: { videoUrl?: string, audioUrl?: string } = {};
      
      // Upload video if available
      if (recordedMedia.videoBlob) {
        const videoRef = ref(storage, `recordings/${userId}/${answerDocId}/video.webm`);
        await uploadBytes(videoRef, recordedMedia.videoBlob);
        const videoUrl = await getDownloadURL(videoRef);
        mediaUrls.videoUrl = videoUrl;
      }
      
      // Upload audio if available
      if (recordedMedia.audioBlob) {
        const audioRef = ref(storage, `recordings/${userId}/${answerDocId}/audio.webm`);
        await uploadBytes(audioRef, recordedMedia.audioBlob);
        const audioUrl = await getDownloadURL(audioRef);
        mediaUrls.audioUrl = audioUrl;
      }
      
      // Update the document with the media URLs
      if (Object.keys(mediaUrls).length > 0) {
        await updateDoc(doc(db, "userAnswers", answerDocId), {
          mediaUrls,
          updatedAt: serverTimestamp(),
        });
        
        console.log("Media uploaded successfully:", mediaUrls);
      }
      
      return mediaUrls;
    } catch (error) {
      console.error("Error uploading media:", error);
      return {};
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

    // Step 2: Remove any occurrences of "json" or code block symbols (``` or `)
    cleanText = cleanText.replace(/(json|```|`)/g, "");

    // Step 3: Parse the clean JSON text into an array of objects
    try {
      return JSON.parse(cleanText);
    } catch (error) {
      throw new Error("Invalid JSON format: " + (error as Error)?.message);
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
      1. Accuracy - How factually correct is the answer?
      2. Completeness - Did the user cover all key points from the correct answer?
      3. Clarity - How clear and well-structured is the user's response?
      4. Relevance - Did the user address what was specifically asked in the question?
      
      Provide:
      1. A numerical rating from 1 to 10 (where 10 is perfect)
      2. Specific, constructive feedback highlighting strengths and suggesting improvements
      3. At least one specific example of what was done well and what could be improved
      
      Return your evaluation in JSON format with these fields:
      - "ratings": number (1-10)
      - "feedback": string (detailed feedback)
    `;

    try {
      const aiResult = await chatSession.sendMessage(prompt);

      const parsedResult: AIResponse = cleanJsonResponse(
        aiResult.response.text()
      );
      return parsedResult;
    } catch (error) {
      console.log(error);
      toast("Error", {
        description: "An error occurred while generating feedback.",
      });
      return { ratings: 0, feedback: "Unable to generate feedback" };
    } finally {
      setIsAiGenerating(false);
    }
  };

  const saveUserAnswer = async () => {
    setLoading(true);

    if (!aiResult) {
      return;
    }

    const currentQuestion = question.question;

    try {
      // Query Firebase to check if the user answer already exists for this question
      const userAnswerQuery = query(
        collection(db, "userAnswers"),
        where("userId", "==", userId),
        where("question", "==", currentQuestion)
      );

      const querySnap = await getDocs(userAnswerQuery);

      // If the user already answered the question, don't save it again
      if (!querySnap.empty) {
        console.log("Query Snap Size", querySnap.size);
        toast.info("Already Answered", {
          description: "You have already answered this question",
        });
        return;
      } else {
        // Show upload in progress message
        const hasRecordings = recordedMedia.videoBlob || recordedMedia.audioBlob;
        if (hasRecordings) {
          toast.loading("Saving Recording", {
            description: "Please wait while your recording is being saved...",
            id: "save-recording",
          });
        }

        // Save the answer
        const questionAnswerRef = await addDoc(collection(db, "userAnswers"), {
          mockIdRef: interviewId,
          question: question.question,
          correct_ans: question.answer,
          user_ans: userAnswer,
          feedback: aiResult.feedback,
          rating: aiResult.ratings,
          userId,
          hasRecording: hasRecordings,
          createdAt: serverTimestamp(),
        });

        const id = questionAnswerRef.id;

        // Update with the ID first
        await updateDoc(doc(db, "userAnswers", id), {
          id,
          updatedAt: serverTimestamp(),
        });

        // If we have recordings, upload them
        if (hasRecordings) {
          await uploadMediaToStorage(id);
          toast.dismiss("save-recording");
        }

        toast.success("Saved", { 
          description: hasRecordings 
            ? "Your answer and recording have been saved." 
            : "Your answer has been saved." 
        });
      }

      setUserAnswer("");
      if (isRecording) {
        stopRecording();
      }
    } catch (error) {
      toast.error("Error", {
        description: "An error occurred while saving your answer.",
      });
      toast.dismiss("save-recording");
      console.log(error);
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
          onClick={() => setOpen(!open)}
          disbaled={!aiResult || isRecording}
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
            
            {isRecording && audioTranscript && (
              <p className="text-sm text-gray-500 mt-2 italic">
                <strong>Current Speech:</strong> {audioTranscript}
              </p>
            )}
            
            {isRecording && (
              <div className="mt-3 flex items-center gap-2">
                <span className="animate-pulse h-3 w-3 bg-red-500 rounded-full"></span>
                <span className="text-xs text-red-500">Recording in progress...</span>
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
      {aiResult && !isRecording && (
        <div className="w-full mt-4 p-4 border rounded-md bg-white shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">AI Evaluation</h2>
            <div className="flex items-center">
              <span className="text-sm font-medium mr-2">Score:</span>
              <div className="flex items-center justify-center rounded-full bg-blue-100 w-10 h-10">
                <span className={`text-lg font-bold ${
                  aiResult.ratings >= 8 ? 'text-green-600' : 
                  aiResult.ratings >= 5 ? 'text-blue-600' : 
                  'text-red-600'
                }`}>{aiResult.ratings}</span>
              </div>
            </div>
          </div>
          
          <div className="mt-2">
            <h3 className="text-sm font-medium text-gray-700 mb-1">Feedback:</h3>
            <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-md">
              {aiResult.feedback}
            </p>
          </div>
          
          <div className="mt-4 text-right">
            <button 
              onClick={() => setOpen(true)}
              className="text-sm bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md disabled:opacity-50"
              disabled={isRecording}
            >
              Save This Answer
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
    </div>
  );
};

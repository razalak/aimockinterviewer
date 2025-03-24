import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { doc, getDoc } from "firebase/firestore";
import { Sparkles, WebcamIcon } from "lucide-react";
import WebCam from "react-webcam";

import { db } from "@/config/firebase.config";

import { LoaderPage } from "@/views/loader-page";
import { CustomBreadCrumb } from "@/components/custom-bread-crumb";
import { Button } from "@/components/ui/button";
import { InterviewPin } from "@/components/interview-pin";

import { Interview } from "@/types";

export const MockLoadPage = () => {
  const { interviewId } = useParams<{ interviewId: string }>();
  const [interview, setInterview] = useState<Interview | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isWebCamEnabled, setIsWebCamEnabled] = useState(false);

  const navigate = useNavigate();

  if (!interviewId) {
    navigate("/generate", { replace: true });
  }

  useEffect(() => {
    if (interviewId) {
      const fetchInterview = async () => {
        setIsLoading(true);
        try {
          const interviewDoc = await getDoc(doc(db, "interviews", interviewId));
          if (interviewDoc.exists()) {
            setInterview({ ...interviewDoc.data() } as Interview);
          } else {
            navigate("/generate", { replace: true });
          }
        } catch (error) {
          console.log(error);
          toast("Error", {
            description: "Something went wrong. Please try again later..",
          });
        } finally {
          setIsLoading(false);
        }
      };

      fetchInterview();
    }
  }, [interviewId, navigate]);

  if (isLoading) {
    return <LoaderPage className="w-full h-[70vh]" />;
  }

  return (
    <div className="flex flex-col w-full min-h-[80vh] py-5">
      <div className="flex items-center justify-between w-full mb-8">
        <CustomBreadCrumb
          breadCrumbPage={interview?.position || ""}
          breadCrumpItems={[{ label: "Mock Interviews", link: "/generate" }]}
        />

        <Link to={`/generate/interview/${interviewId}/start`}>
          <Button size={"sm"}>
            Start <Sparkles className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </div>

      <div className="flex flex-col items-center justify-center flex-1 gap-8">
        {interview && <InterviewPin data={interview} onMockPage />}

        <div className="w-full max-w-md">
          <div className="aspect-video w-full flex flex-col items-center justify-center border p-4 bg-gray-50 rounded-md">
            {isWebCamEnabled ? (
              <WebCam
                onUserMedia={() => setIsWebCamEnabled(true)}
                onUserMediaError={() => setIsWebCamEnabled(false)}
                className="w-full h-full object-cover rounded-md"
              />
            ) : (
              <WebcamIcon className="w-24 h-24 text-muted-foreground" />
            )}
          </div>

          <div className="mt-4 flex justify-center">
            <Button 
              onClick={() => setIsWebCamEnabled(!isWebCamEnabled)}
              variant={isWebCamEnabled ? "destructive" : "default"}
            >
              {isWebCamEnabled ? "Disable Webcam" : "Enable Webcam"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

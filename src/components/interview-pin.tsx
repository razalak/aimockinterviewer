import { Interview } from "@/types";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TooltipButton } from "./tooltip-button";
import { Newspaper, Pencil, Sparkles, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { toast } from "sonner";
import {
  collection,
  doc,
  getDocs,
  query,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/config/firebase.config";
import { useAuth } from "@clerk/clerk-react";

interface InterviewPinProps {
  data: Interview;
  onMockPage?: boolean;
}

export const InterviewPin = ({
  data,
  onMockPage = false,
}: InterviewPinProps) => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const { userId } = useAuth();
  const onDelete = async () => {
    setLoading(true);

    try {
      const interviewRef = doc(db, "interviews", data.id);
      const userAnswerQuery = query(
        collection(db, "userAnswers"),
        where("userId", "==", userId),
        where("mockIdRef", "==", data.id)
      );

      // get all matching user answer
      const querySnap = await getDocs(userAnswerQuery);

      // initialize the firebase batch

      const batch = writeBatch(db);

      // add delete -> interview batch

      batch.delete(interviewRef);

      querySnap.forEach((docRef) => batch.delete(docRef.ref));

      // commit

      await batch.commit();

      toast("Success", { description: "Your interview has been removed" });
    } catch (error) {
      console.log(error);
      toast("Error", {
        description: "Something went wrong!. Please try again later",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="group hover:shadow-lg transition-all duration-200">
      <CardHeader className="space-y-1">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-xl font-semibold line-clamp-1 text-primary">
              {data.jobPosition || data.position}
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground line-clamp-2">
              {data.jobDescription || data.description}
            </CardDescription>
          </div>
          <Badge variant="outline" className="ml-2">
            {data.requiredExperience || data.experience} years
          </Badge>
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          {(data.requiredTechStack || data.techStack)?.split(',').map((tech, index) => (
            <Badge key={index} variant="secondary" className="text-xs">
              {tech.trim()}
            </Badge>
          ))}
        </div>
      </CardHeader>
      <CardFooter className="flex flex-col gap-4">
        <div className="w-full flex items-center justify-between text-sm text-muted-foreground">
          <span>Created {new Date(data.createdAt?.toDate()).toLocaleDateString()}</span>
          <span>{data.questions?.length || 0} questions</span>
        </div>
        {!onMockPage && (
          <div className="w-full flex items-center justify-between gap-2">
            <TooltipButton
              content="Edit Interview"
              buttonVariant={"outline"}
              onClick={() => {
                navigate(`/generate/${data.id}`, { replace: true });
              }}
              disbaled={false}
              buttonClassName="flex-1"
              icon={<Pencil className="h-4 w-4" />}
              loading={false}
            />
            <TooltipButton
              content="Delete Interview"
              buttonVariant={"outline"}
              onClick={onDelete}
              disbaled={false}
              buttonClassName="flex-1 text-destructive hover:text-destructive"
              icon={<Trash2 className="h-4 w-4" />}
              loading={loading}
            />
            <TooltipButton
              content="View Feedback"
              buttonVariant={"outline"}
              onClick={() => {
                navigate(`/generate/feedback/${data.id}`, { replace: true });
              }}
              disbaled={false}
              buttonClassName="flex-1"
              icon={<Newspaper className="h-4 w-4" />}
              loading={false}
            />
            <TooltipButton
              content="Start Interview"
              buttonVariant={"default"}
              onClick={() => {
                navigate(`/generate/interview/${data.id}`, { replace: true });
              }}
              disbaled={false}
              buttonClassName="flex-1"
              icon={<Sparkles className="h-4 w-4" />}
              loading={false}
            />
          </div>
        )}
      </CardFooter>
    </Card>
  );
};

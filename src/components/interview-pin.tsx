import { Interview } from "@/types";
import {
  Card,
  CardDescription,
  CardFooter,
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
    <Card className="p-4 rounded-md shadow-none hover:shadow-md shadow-gray-100 cursor-pointer transition-all space-y-4">
      <CardTitle>{data?.position}</CardTitle>
      <CardDescription>{data?.description}</CardDescription>
      <div className="w-full flex items-center gap-2 flex-wrap">
        {data.techStack.split(",").map((word, index) => (
          <Badge
            key={index}
            variant={"outline"}
            className="text-xs text-muted-foreground hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-900"
          >
            {word}
          </Badge>
        ))}
      </div>

      <CardFooter
        className={cn(
          "w-full flex items-center p-0",
          onMockPage ? "justify-end" : "justify-between"
        )}
      >
        <p className="text-[12px] text-muted-foreground truncate whitespace-nowrap">
          {`${new Date(data.createdAt.toDate()).toLocaleDateString("en-US", {
            dateStyle: "long",
          })} - ${new Date(data.createdAt.toMillis()).toLocaleTimeString(
            "en-US",
            {
              timeStyle: "short",
            }
          )}`}
        </p>

        {!onMockPage && (
          <div className="flex items-center justify-center ">
            <TooltipButton
              content="Edit"
              buttonVariant={"ghost"}
              onClick={() => {
                navigate(`/generate/${data.id}`, { replace: true });
              }}
              disbaled={false}
              buttonClassName="hover:text-red-500"
              icon={<Pencil />}
              loading={false}
            />

            <TooltipButton
              content="Delete"
              buttonVariant={"ghost"}
              onClick={onDelete}
              disbaled={false}
              buttonClassName="hover:text-red-500"
              icon={<Trash2 />}
              loading={loading}
            />

            <TooltipButton
              content="Feedback"
              buttonVariant={"ghost"}
              onClick={() => {
                navigate(`/generate/feedback/${data.id}`, { replace: true });
              }}
              disbaled={false}
              buttonClassName="hover:text-emerald-500"
              icon={<Newspaper />}
              loading={false}
            />

            <TooltipButton
              content="Start"
              buttonVariant={"ghost"}
              onClick={() => {
                navigate(`/generate/interview/${data.id}`, { replace: true });
              }}
              disbaled={false}
              buttonClassName="hover:text-sky-500"
              icon={<Sparkles />}
              loading={false}
            />
          </div>
        )}
      </CardFooter>
    </Card>
  );
};

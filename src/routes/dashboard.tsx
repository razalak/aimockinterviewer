import { Headings } from "@/components/headings";
import { InterviewPin } from "@/components/interview-pin";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { db } from "@/config/firebase.config";
import { Interview } from "@/types";
import { useAuth } from "@clerk/clerk-react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { Plus, Calendar, Clock, Target, Users, Newspaper, MessageSquare, FileText } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Dashboard = () => {
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);

  const { userId } = useAuth();

  useEffect(() => {
    // set upa realtime listener even for the interviews collection where the userId matches

    const interviewQuery = query(
      collection(db, "interviews"),
      where("userId", "==", userId)
    );

    const unsubscribe = onSnapshot(
      interviewQuery,
      (snapshot) => {
        const interviewList: Interview[] = snapshot.docs.map((doc) =>
          doc.data()
        ) as Interview[];
        setInterviews(interviewList);
        setLoading(false);
      },
      (error) => {
        console.log("Error on fetching : ", error);
        toast.error("Error", {
          description: "Something went wrong. Please try again later.",
        });
        setLoading(false);
      }
    );

    //  clean up the listener when the component unmount

    return () => unsubscribe();
  }, [userId]);

  const totalInterviews = interviews.length;
  const totalQuestions = interviews.reduce((acc, interview) => acc + (interview.questions?.length || 0), 0);
  const totalFeedback = interviews.reduce((acc, interview) => acc + (interview.feedback?.length || 0), 0);
  const totalTimeSpent = interviews.reduce((acc, interview) => acc + (interview.timeSpent || 0), 0);

  const stats = [
    {
      title: "Total Interviews",
      value: totalInterviews,
      icon: <Newspaper className="h-4 w-4" />,
    },
    {
      title: "Total Questions",
      value: totalQuestions,
      icon: <MessageSquare className="h-4 w-4" />,
    },
    {
      title: "Total Feedback",
      value: totalFeedback,
      icon: <FileText className="h-4 w-4" />,
    },
    {
      title: "Time Spent",
      value: `${Math.round(totalTimeSpent / 60)} min`,
      icon: <Clock className="h-4 w-4" />,
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex w-full items-center justify-between">
        {/* heading */}
        <Headings
          title="Dashboard"
          description="Create and start your AI Mock interview"
        />
        {/* action button */}
        <Link to={"/generate/create"}>
          <Button size={"lg"} className="bg-primary hover:bg-primary/90">
            <Plus className="min-w-5 min-h-5 mr-2" />
            Create New Interview
          </Button>
        </Link>
      </div>

      {/* Stats Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <div className="flex items-center justify-end text-sm font-medium text-muted-foreground">
                {stat.icon}
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Separator />

      {/* Interviews Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Your Interviews</h2>
          <p className="text-sm text-muted-foreground">
            {interviews.length} interview{interviews.length !== 1 ? 's' : ''} created
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-48 rounded-xl" />
            ))}
          </div>
        ) : interviews.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {interviews.map((interview) => (
              <InterviewPin key={interview.id} data={interview} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[60vh] bg-muted/50 rounded-xl p-8">
            <img
              src="/svg/not-found.svg"
              className="w-48 h-48 object-contain mb-6"
              alt="No interviews found"
            />
            <h2 className="text-2xl font-semibold text-muted-foreground mb-2">
              No Interviews Found
            </h2>
            <p className="text-center text-muted-foreground max-w-md mb-6">
              Start your interview preparation journey by creating your first mock interview
            </p>
            <Link to={"/generate/create"}>
              <Button size={"lg"} className="bg-primary hover:bg-primary/90">
                <Plus className="min-w-5 min-h-5 mr-2" />
                Create Your First Interview
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

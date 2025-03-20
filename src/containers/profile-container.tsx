import { Button } from "@/components/ui/button";
import { useAuth, UserButton } from "@clerk/clerk-react";
import { Loader } from "lucide-react";
import { Link } from "react-router-dom";

export const ProfileContainer = () => {
  const { isSignedIn, isLoaded } = useAuth();

  if (!isLoaded) {
    return (
      <div className="flex items-center">
        <Loader className="min-w-4 min-h-4 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-6">
      {isSignedIn ? (
        <UserButton afterSignOutUrl="/" />
      ) : (
        <>
          <Link to={"/sign-in"}>
            <Button size={"sm"} variant={"outline"}>
              Login
            </Button>
          </Link>

          <Link to={"/sign-up"}>
            <Button size={"sm"}>Get Started</Button>
          </Link>
        </>
      )}
    </div>
  );
};

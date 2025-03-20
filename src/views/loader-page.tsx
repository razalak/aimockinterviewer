import { cn } from "@/lib/utils";
import { Loader } from "lucide-react";

export const LoaderPage = ({ className }: { className?: string }) => {
  return (
    <div
      className={cn(
        "w-screen h-screen flex items-center justify-center bg-transparentfixed z-50",
        className
      )}
    >
      <Loader className="text-3xl text-emerald-500 animate-spin" />
    </div>
  );
};

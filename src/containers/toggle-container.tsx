import { NavLink } from "react-router-dom";
import { Menu } from "lucide-react";
import { useAuth } from "@clerk/clerk-react";

import { MainRoutes } from "@/lib/helper";
import { cn } from "@/lib/utils";

import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export const ToggleContainer = () => {
  const { userId } = useAuth();

  return (
    <Sheet>
      <SheetTrigger className="block md:hidden">
        <Menu />
      </SheetTrigger>
      <SheetContent>
        <nav>
          <ul className="flex flex-col items-start gap-8">
            {MainRoutes.map((route) => (
              <NavLink
                className={({ isActive }) =>
                  cn(
                    "text-base text-neutral-600",
                    isActive && "text-neutral-900 font-semibold"
                  )
                }
                key={route.href}
                to={route.href}
              >
                {route.label}
              </NavLink>
            ))}

            {userId && (
              <NavLink
                className={({ isActive }) =>
                  cn(
                    "text-base text-neutral-600",
                    isActive && "text-neutral-900 font-semibold"
                  )
                }
                to={"/generate"}
              >
                Take an Interview
              </NavLink>
            )}
          </ul>
        </nav>
      </SheetContent>
    </Sheet>
  );
};

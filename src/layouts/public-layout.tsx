import { Header } from "@/components/header";
import AuthHandler from "@/handlers/user-auth-handler";
import { Footer } from "@/views/footer";
import { Outlet } from "react-router-dom";

export const PublicLayout = () => {
  return (
    <div className="w-full">
      <AuthHandler />
      <Header />
      <Outlet />
      <Footer />
    </div>
  );
};

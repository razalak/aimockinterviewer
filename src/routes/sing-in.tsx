import { SignIn } from "@clerk/clerk-react";

export const SignInPage = () => {
  return (
    <div className="w-screen h-screen overflow-hidden flex items-center justify-center relative">
      <img
        src="/img/bg.png"
        alt=""
        className="absolute w-full h-full object-cover opacity-20"
      />

      <SignIn path="/sign-in" />
    </div>
  );
};

import { SignUp } from "@clerk/clerk-react";

export const SignUpPage = () => {
  return (
    <div className="w-screen h-screen overflow-hidden flex items-center justify-center relative">
      <img
        src="/img/bg.png"
        alt=""
        className="absolute w-full h-full object-cover opacity-20"
      />

      <SignUp path="/sign-up" />
    </div>
  );
};

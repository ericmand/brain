import { createRootRoute, Outlet } from "@tanstack/react-router";
import { SignedIn, SignedOut, SignIn } from "@clerk/clerk-react";

export const Route = createRootRoute({
  component: () => (
    <>
      <SignedIn>
        <Outlet />
      </SignedIn>
      <SignedOut>
        <div className="min-h-screen flex items-center justify-center bg-white dark:bg-zinc-900 p-6">
          <SignIn />
        </div>
      </SignedOut>
    </>
  ),
});

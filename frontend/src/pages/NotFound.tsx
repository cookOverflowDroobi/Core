import { CircleAlert, CookingPot } from "lucide-react";
import { isRouteErrorResponse, useRouteError } from "react-router";
import { Logo } from "@/components/Logo";
import { Button, ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/misc";
import { useDocumentTitle } from "@/hooks";

export default function NotFound() {
  useDocumentTitle("Page not found");
  return (
    <div className="card">
      <EmptyState icon={CookingPot} title="This page burnt to a crisp" action={<ButtonLink to="/">Back to the kitchen</ButtonLink>}>
        We couldn't find what you were looking for. It may have moved, or the link is wrong.
      </EmptyState>
    </div>
  );
}

/** Shown when a route throws while rendering. */
export function RouteError() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : "Unknown error";
  return (
    <div className="grid min-h-dvh place-items-center p-6">
      <div className="card w-full max-w-md">
        <div className="flex justify-center pt-8">
          <Logo />
        </div>
        <EmptyState
          icon={CircleAlert}
          title="Something went wrong"
          action={<Button onClick={() => window.location.reload()}>Reload the page</Button>}
        >
          <span className="block">Sorry about that. Reloading usually fixes it.</span>
          <code className="mt-3 block rounded-lg bg-subtle px-3 py-2 text-xs text-ink-3">{message}</code>
        </EmptyState>
      </div>
    </div>
  );
}

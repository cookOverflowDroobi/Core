import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import App from "./App";
import { ApiError } from "./lib/api";
import { keys } from "./lib/queries";
import { initTheme, resolvedTheme, themeStore } from "./lib/theme";
import "./index.css";

initTheme();

// A 403 on any request means the session expired: forget the user so the app shows sign-in.
const onError = (error: unknown) => {
  if (error instanceof ApiError && error.status === 403 && queryClient.getQueryData(keys.me)) {
    queryClient.invalidateQueries({ queryKey: keys.me });
  }
};

const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError }),
  mutationCache: new MutationCache({ onError }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: true,
      retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
    },
  },
});

function ThemedToaster() {
  const theme = themeStore.use();
  return <Toaster position="bottom-center" theme={resolvedTheme(theme)} richColors closeButton offset={88} mobileOffset={96} />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <ThemedToaster />
    </QueryClientProvider>
  </StrictMode>,
);

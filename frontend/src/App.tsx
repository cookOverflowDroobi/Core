import { lazy, Suspense, type ReactNode } from "react";
import { createBrowserRouter, RouterProvider } from "react-router";
import { AppShell, PublicOnly } from "./components/layout/AppShell";
import { Spinner } from "./components/ui/misc";
import Home from "./pages/Home";
import NotFound, { RouteError } from "./pages/NotFound";

// Split rarely-first pages into their own chunks.
const Explore = lazy(() => import("./pages/Explore"));
const Cook = lazy(() => import("./pages/Cook"));
const PostDetail = lazy(() => import("./pages/PostDetail"));
const Profile = lazy(() => import("./pages/Profile"));
const Settings = lazy(() => import("./pages/Settings"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Messages = lazy(() => import("./pages/Messages"));
const Shopping = lazy(() => import("./pages/Shopping"));
const Saved = lazy(() => import("./pages/Collections").then((m) => ({ default: m.Saved })));
const TagPage = lazy(() => import("./pages/Collections").then((m) => ({ default: m.TagPage })));
const SearchPage = lazy(() => import("./pages/Collections").then((m) => ({ default: m.SearchPage })));
const Login = lazy(() => import("./pages/auth/Login"));
const Register = lazy(() => import("./pages/auth/Register"));
const ForgotPassword = lazy(() => import("./pages/auth/PasswordReset").then((m) => ({ default: m.ForgotPassword })));
const ResetPassword = lazy(() => import("./pages/auth/PasswordReset").then((m) => ({ default: m.ResetPassword })));

const page = (element: ReactNode) => (
  <Suspense fallback={<Spinner className="w-full py-20" />}>{element}</Suspense>
);

const router = createBrowserRouter([
  {
    errorElement: <RouteError />,
    children: [
      {
        element: <PublicOnly />,
        children: [
          { path: "/login", element: page(<Login />) },
          { path: "/register", element: page(<Register />) },
        ],
      },
      { path: "/forgot-password", element: page(<ForgotPassword />) },
      { path: "/reset-password/:uid/:token", element: page(<ResetPassword />) },
      {
        element: <AppShell />,
        children: [
          { path: "/", element: <Home /> },
          { path: "/explore/:tab?", element: page(<Explore />) },
          { path: "/cook", element: page(<Cook />) },
          { path: "/posts/:id", element: page(<PostDetail />) },
          { path: "/u/:username/:tab?", element: page(<Profile />) },
          { path: "/tags/:tag", element: page(<TagPage />) },
          { path: "/search", element: page(<SearchPage />) },
          { path: "/saved", element: page(<Saved />) },
          { path: "/shopping", element: page(<Shopping />) },
          { path: "/notifications", element: page(<Notifications />) },
          { path: "/messages/:username?", element: page(<Messages />) },
          { path: "/settings", element: page(<Settings />) },
          { path: "*", element: <NotFound /> },
        ],
      },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}

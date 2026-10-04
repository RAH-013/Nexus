import { lazy, Suspense } from "react";
import {
  createBrowserRouter,
  createRoutesFromElements,
  Route,
  RouterProvider,
} from "react-router-dom";
import { PrivateRoute } from "./PrivateRoutes";
import { UserProvider } from "../providers/UserProvider";
import Main from "../layouts/Main";

const NotFound = lazy(() => import("../pages/NotFound"));
const Auth = lazy(() => import("../pages/Auth"));
const Home = lazy(() => import("../pages/Home"));
const Profile = lazy(() => import("../pages/private/Profile"));

const router = createBrowserRouter(
  createRoutesFromElements(
    <>
      <Route element={<UserProvider />}>
        <Route path="/auth" element={<Auth />} />

        <Route element={<Main />}>
          <Route path="/" element={<Home />} />
        </Route>

        <Route element={<PrivateRoute />}>
          <Route element={<Main />}>
            <Route
              path="/profile"
              element={<Profile />}
              handle={{ title: "Mi perfil" }}
            />
          </Route>
        </Route>

        <Route path="*" element={<NotFound />} />
      </Route>
    </>,
  ),
);

export default function AppRoutes() {
  return (
    <Suspense fallback={null}>
      <RouterProvider router={router} />
    </Suspense>
  );
}

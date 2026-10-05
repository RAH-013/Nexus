import { lazy, Suspense } from "react";
import {
  createBrowserRouter,
  createRoutesFromElements,
  Route,
  RouterProvider,
} from "react-router-dom";
import { PrivateRoute } from "./PrivateRoutes";
import { UserProvider } from "../providers/UserProvider";
import { ViewsProvider } from "../providers/ViewsProvider";
import { MoviesProvider } from "../providers/MoviesProvider";
import Main from "../layouts/Main";

const NotFound = lazy(() => import("../pages/NotFound"));
const Auth = lazy(() => import("../pages/Auth"));
const Home = lazy(() => import("../pages/Home"));
const SearchResults = lazy(() => import("../pages/SearchResults"));
const Profile = lazy(() => import("../pages/private/Profile"));
const TitleDetail = lazy(() => import("../pages/TitleDetail"));
const Movies = lazy(() => import("../pages/Movies"));

const router = createBrowserRouter(
  createRoutesFromElements(
    <>
      {/* ViewsProvider dentro de UserProvider (spec 003, D6): vistos en cards y ficha. */}
      <Route element={<UserProvider><ViewsProvider /></UserProvider>}>
        <Route path="/auth" element={<Auth />} />

        <Route element={<Main />}>
          <Route path="/" element={<Home />} />
          {/* Vista de resultados de búsqueda (enmienda spec 001): pública. */}
          <Route path="/search" element={<SearchResults />} />
        </Route>

        {/* Ficha pública (spec 002, D7): sin menú lateral y con cabecera «Volver». */}
        <Route element={<Main detail />}>
          <Route path="/title/:type/:id" element={<TitleDetail />} />
        </Route>

        {/* Vista Películas (spec 003, D7/D8): pública; el provider de filtros
            vive en el layout para compartir sidebar y cuadrícula. */}
        <Route element={<MoviesProvider><Main browse /></MoviesProvider>}>
          <Route path="/movies" element={<Movies />} />
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

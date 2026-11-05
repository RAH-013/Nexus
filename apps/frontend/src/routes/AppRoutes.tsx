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
import { ReactionsProvider } from "../providers/ReactionsProvider";
import { InteractionsProvider } from "../providers/InteractionsProvider";
import { MoviesProvider } from "../providers/MoviesProvider";
import Series from "../pages/Series";
import SeriesSidebar from "../components/series/SeriesSideBar";
import { SeriesProvider } from "../providers/SeriesProvider";
import Actors from "../pages/Actors";
import ActorsSidebar from "../components/actors/ActorsSidebar";
import { ActorsProvider } from "../providers/ActorsProvider";
import Main from "../layouts/Main";

const NotFound = lazy(() => import("../pages/NotFound"));
const Auth = lazy(() => import("../pages/Auth"));
const Home = lazy(() => import("../pages/Home"));
const SearchResults = lazy(() => import("../pages/SearchResults"));
const Recent = lazy(() => import("../pages/private/Recent")); 
const ForYou = lazy(() => import("../pages/ForYou"));
const Profile = lazy(() => import("../pages/private/Profile"));
const TitleDetail = lazy(() => import("../pages/TitleDetail"));
const ActorProfile = lazy(() => import("../pages/ActorProfile"));
const Movies = lazy(() => import("../pages/Movies"));

const router = createBrowserRouter(
  createRoutesFromElements(
    <>
      {/* Jerarquía de Providers de usuario, vistos, reacciones e interacciones avanzadas */}
      <Route
        element={
          <UserProvider>
            <ViewsProvider>
              <ReactionsProvider>
                <InteractionsProvider />
              </ReactionsProvider>
            </ViewsProvider>
          </UserProvider>
        }
      >
        <Route path="/auth" element={<Auth />} />

        <Route element={<Main />}>
          <Route path="/" element={<Home />} />
          {/* Vista de resultados de búsqueda: pública */}
          <Route
            path="/search"
            element={<SearchResults />}
            handle={{ title: "Resultados de busqueda" }}
          />
        </Route>

        {/* Ficha pública: sin menú lateral y con cabecera «Volver» */}
        <Route element={<Main detail />}>
          <Route path="/title/:type/:id" element={<TitleDetail />} />
          {/* Perfil público del actor */}
          <Route path="/actor/:name" element={<ActorProfile />} />
        </Route>

        {/* Vista Películas */}
        <Route
          element={
            <MoviesProvider>
              <Main browse />
            </MoviesProvider>
          }
        >
          <Route
            path="/movies"
            element={<Movies />}
            handle={{ title: "Peliculas" }}
          />
        </Route>

        <Route
          element={
            <SeriesProvider>
              <Main browse sidebar={<SeriesSidebar />} />
            </SeriesProvider>
          }
        >
          <Route
            path="/series"
            element={<Series />}
            handle={{ title: "Series" }}
          />
        </Route>

        {/* Vista Actores */}
        <Route
          element={
            <ActorsProvider>
              <Main browse sidebar={<ActorsSidebar />} />
            </ActorsProvider>
          }
        >
          <Route
            path="/actors"
            element={<Actors />}
            handle={{ title: "Actores" }}
          />
        </Route>

        <Route element={<PrivateRoute />}>
          <Route element={<Main />}>
            <Route
              path="/profile"
              element={<Profile />}
              handle={{ title: "Mi perfil" }}
            />
            <Route
              path="/recent"
              element={<Recent />}
              handle={{ title: "Recientes" }}
            />
            <Route
              path="/for-you"
              element={<ForYou />}
              handle={{ title: "Para ti" }}
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

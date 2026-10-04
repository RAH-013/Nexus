import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiSignIn, apiSignUp } from "../api/betterAuth";
import { useUser } from "../hooks/useUser";
import { swal, toast } from "../utils/swal";

function Auth() {
  const navigate = useNavigate();
  const { refreshUser } = useUser();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const isLogin = mode === "login";

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isLogin && password !== confirmPassword) {
      toast.fire({
        icon: "error",
        title: "Las contraseñas no coinciden",
      });
      return;
    }

    setLoading(true);

    try {
      if (isLogin) {
        const result = await apiSignIn({ email, password });

        if (!result.success) {
          toast.fire({
            icon: "error",
            title: result.error ?? "El correo o la contraseña son incorrectos.",
          });
          return;
        }
      } else {
        const result = await apiSignUp({ name, email, password });

        if (!result.success) {
          toast.fire({
            icon: "error",
            title: result.error ?? "No se pudo crear la cuenta.",
          });
          return;
        }
      }

      await refreshUser();

      await swal.fire({
        icon: "success",
        title: isLogin ? "¡Bienvenido de nuevo!" : "¡Cuenta creada!",
        text: isLogin
          ? "Has iniciado sesión correctamente."
          : "Tu cuenta se creó correctamente.",
        timer: 2000,
        timerProgressBar: true,
        showConfirmButton: false,
      });

      navigate("/");
    } catch {
      toast.fire({
        icon: "error",
        title: isLogin
          ? "No se pudo iniciar sesión"
          : "No se pudo crear la cuenta",
        text: "Inténtalo nuevamente.",
      });
    } finally {
      setLoading(false);
    }
  };

  const changeMode = (newMode: "login" | "register") => {
    setMode(newMode);
  };

  return (
    <main className="flex min-h-dvh w-full items-center justify-center overflow-hidden bg-slate-950 px-4 text-white sm:px-6">
      <section className="w-full max-w-sm rounded-2xl border border-slate-700/60 bg-slate-900/95 p-5 shadow-2xl shadow-black/30 backdrop-blur sm:max-w-md sm:p-7">
        <div className="mb-5 text-center sm:mb-6">
          <Link to="/" className="inline-flex">
            <img
              src="/logo.png"
              alt="Nexus"
              className="mb-3 h-9 w-auto sm:mb-4 sm:h-12"
            />
          </Link>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
            {isLogin ? "Bienvenido de nuevo" : "Crea tu cuenta"}
          </h1>
        </div>

        <div
          className="mb-4 grid grid-cols-2 rounded-xl bg-slate-800 p-1 sm:mb-5"
          role="tablist"
        >
          <button
            type="button"
            role="tab"
            aria-selected={isLogin}
            onClick={() => changeMode("login")}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-all ${
              isLogin
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Iniciar sesión
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={!isLogin}
            onClick={() => changeMode("register")}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-all ${
              !isLogin
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Registrarse
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {!isLogin && (
            <div>
              <label
                htmlFor="name"
                className="mb-1 block text-xs font-medium text-slate-300"
              >
                Nombre
              </label>
              <input
                id="name"
                name="name"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Tu nombre"
                autoComplete="name"
                required
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          )}

          <div>
            <label
              htmlFor="email"
              className="mb-1 block text-xs font-medium text-slate-300"
            >
              Correo electrónico
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="correo@ejemplo.com"
              autoComplete="email"
              required
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          {isLogin ? (
            <div>
              <label
                htmlFor="password"
                className="mb-1 block text-xs font-medium text-slate-300"
              >
                Contraseña
              </label>
              <input
                id="password"
                name="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
                minLength={8}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2.5 text-sm text-white outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="password"
                  className="mb-1 block text-xs font-medium text-slate-300"
                >
                  Contraseña
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2.5 text-sm text-white outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
              <div>
                <label
                  htmlFor="confirmPassword"
                  className="mb-1 block text-xs font-medium text-slate-300"
                >
                  Confirmar contraseña
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2.5 text-sm text-white outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/10 transition hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading
              ? "Procesando..."
              : isLogin
                ? "Iniciar sesión"
                : "Crear cuenta"}
          </button>
        </form>
      </section>
    </main>
  );
}

export default Auth;

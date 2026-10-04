import { useState } from "react";

import { DeleteIcon } from "lucide-animated";

import { apiUpdateUser } from "../../api/betterAuth";
import { useUser } from "../../hooks/useUser";
import { swal, toast } from "../../utils/swal";

function Profile() {
  const { user, refreshUser } = useUser();

  const [name, setName] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!user) {
    return (
      <main className="flex min-h-full items-center justify-center p-6 text-slate-300">
        No hay una sesión activa.
      </main>
    );
  }

  const currentName = name.trim() || user.name;
  const currentImage = image ?? user.image ?? "";
  const avatarUrl = user.image || "/api/auth/get-avatar";

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!currentName.trim()) {
      toast.fire({
        icon: "error",
        title: "El nombre no puede estar vacío",
      });
      return;
    }

    setLoading(true);

    try {
      const result = await apiUpdateUser({
        name: currentName.trim(),
        image: image === null ? user.image || null : image.trim() || null,
      });

      if (!result.success) {
        toast.fire({
          icon: "error",
          title: result.error ?? "No se pudo actualizar el perfil",
        });
        return;
      }

      await refreshUser();

      await swal.fire({
        icon: "success",
        title: "Perfil actualizado",
        timer: 2000,
        timerProgressBar: true,
        showConfirmButton: false,
      });

      setName("");
      setImage(null);
    } catch {
      toast.fire({
        icon: "error",
        title: "No se pudo actualizar el perfil",
        text: "Inténtalo nuevamente.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteImage = () => {
    setImage("");
  };

  return (
    <main className="mx-auto w-full max-w-2xl p-4 text-white sm:p-6">
      <section className="rounded-2xl border border-slate-700 bg-slate-800 p-5 shadow-lg sm:p-6">
        <div className="mb-6 flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-700">
            <img
              src={avatarUrl}
              alt={`Foto de perfil de ${user.name}`}
              className="h-full w-full object-cover"
              onError={(event) => {
                if (event.currentTarget.src.endsWith("/api/auth/get-avatar")) {
                  return;
                }

                event.currentTarget.src = "/api/auth/get-avatar";
              }}
            />
          </div>

          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold">{user.name}</h2>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="name"
              className="mb-1.5 block text-sm font-medium text-slate-300"
            >
              Nombre
            </label>

            <input
              id="name"
              type="text"
              value={name || user.name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
              required
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20"
            />
          </div>

          <div>
            <label
              htmlFor="image"
              className="mb-1.5 block text-sm font-medium text-slate-300"
            >
              URL de imagen
            </label>

            <div className="flex gap-2">
              <input
                id="image"
                type="url"
                value={currentImage}
                onChange={(event) => setImage(event.target.value)}
                placeholder="https://ejemplo.com/avatar.jpg"
                autoComplete="url"
                className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20"
              />

              <button
                type="button"
                onClick={handleDeleteImage}
                aria-label="Eliminar imagen"
                title="Eliminar imagen"
                className="flex h-10.5 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-slate-400 transition hover:border-red-400/50 hover:bg-red-400/10 hover:text-red-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400"
              >
                <DeleteIcon size={18} />
              </button>
            </div>

            <p className="mt-1.5 text-xs text-slate-500">
              Si no agregas una imagen, se utilizará tu avatar generado
              automáticamente.
            </p>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-teal-400 px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-teal-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

export default Profile;

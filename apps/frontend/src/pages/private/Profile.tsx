import { useState } from "react";
import { DeleteIcon, SquarePenIcon } from "lucide-animated";

import { apiUpdateUser } from "../../api/betterAuth";
import { useUser } from "../../hooks/useUser";
import { swal, toast } from "../../utils/swal";

function Profile() {
  const { user, refreshUser } = useUser();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [image, setImage] = useState("");
  const [loading, setLoading] = useState(false);

  if (!user) {
    return (
      <main className="flex min-h-full items-center justify-center p-6 text-slate-300">
        No hay una sesión activa.
      </main>
    );
  }

  const avatarUrl = user.image || "/api/auth/get-avatar";

  const createdAt = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString("es-MX", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "Fecha no disponible";

  const handleEdit = () => {
    setName(user.name);
    setImage(user.image ?? "");
    setEditing(true);
  };

  const handleCancel = () => {
    setName("");
    setImage("");
    setEditing(false);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedName = name.trim();
    const trimmedImage = image.trim();

    if (!trimmedName) {
      toast.fire({
        icon: "error",
        title: "El nombre no puede estar vacío",
      });
      return;
    }

    setLoading(true);

    try {
      const result = await apiUpdateUser({
        name: trimmedName,
        image: trimmedImage || null,
      });

      if (!result.success) {
        toast.fire({
          icon: "error",
          title: result.error ?? "No se pudo actualizar el perfil",
        });
        return;
      }

      await refreshUser();

      setName("");
      setImage("");
      setEditing(false);

      await swal.fire({
        icon: "success",
        title: "Perfil actualizado",
        timer: 2000,
        timerProgressBar: true,
        showConfirmButton: false,
      });
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
    <main className="mx-auto w-full text-white">
      <section className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-800 shadow-xl">
        <div className="relative flex h-48 items-end justify-end bg-teal-600 p-4 sm:h-56">
          {!editing && (
            <button
              type="button"
              onClick={handleEdit}
              aria-label="Editar perfil"
              title="Editar perfil"
              className="relative z-20 flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900/50 text-white backdrop-blur-sm transition hover:bg-slate-900/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <SquarePenIcon size={20} />
            </button>
          )}
        </div>

        <div className="relative z-10 px-5 pb-6 sm:px-8">
          <div className="-mt-20 flex justify-start sm:-mt-24">
            <div className="flex items-center">
              <div className="relative z-10 h-36 w-36 shrink-0 overflow-hidden rounded-full border-4 border-slate-700 bg-slate-700 shadow-xl sm:h-44 sm:w-44">
                <img
                  src={avatarUrl}
                  alt={`Foto de perfil de ${user.name}`}
                  className="h-full w-full object-cover"
                  onError={(event) => {
                    if (
                      event.currentTarget.src.endsWith("/api/auth/get-avatar")
                    ) {
                      return;
                    }

                    event.currentTarget.src = "/api/auth/get-avatar";
                  }}
                />
              </div>

              <div className="-ml-3 rounded-r-2xl bg-slate-700 py-4 pl-7 pr-10 text-left sm:-ml-4 sm:pl-8 sm:pr-14">
                <h1 className="truncate text-2xl font-bold text-white">
                  {user.name}
                </h1>

                <p className="mt-1 text-sm text-slate-400">
                  Activo desde el {createdAt}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6">
            <h2 className="text-lg font-semibold text-white">
              Información del perfil
            </h2>

            <p className="mt-1 text-sm text-slate-400">
              {editing
                ? "Actualiza la información que se muestra en tu perfil."
                : "Información asociada a tu cuenta."}
            </p>

            {!editing ? (
              <div className="mt-6 space-y-5">
                <div>
                  <p className="mb-1.5 text-sm font-medium text-slate-300">
                    Nombre
                  </p>
                  <div className="rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-sm text-slate-200">
                    {user.name}
                  </div>
                </div>

                <div>
                  <p className="mb-1.5 text-sm font-medium text-slate-300">
                    Correo electrónico
                  </p>
                  <div className="rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-sm text-slate-200">
                    {user.email}
                  </div>
                </div>

                <div>
                  <p className="mb-1.5 text-sm font-medium text-slate-300">
                    Imagen de perfil
                  </p>
                  <div className="rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-sm text-slate-400">
                    {user.image
                      ? "Imagen personalizada"
                      : "Avatar generado automáticamente"}
                  </div>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-6 space-y-5">
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
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    autoComplete="name"
                    required
                    disabled={loading}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20 disabled:cursor-not-allowed disabled:opacity-60"
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
                      value={image}
                      onChange={(event) => setImage(event.target.value)}
                      placeholder="https://ejemplo.com/avatar.jpg"
                      autoComplete="url"
                      disabled={loading}
                      className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20 disabled:cursor-not-allowed disabled:opacity-60"
                    />

                    <button
                      type="button"
                      onClick={handleDeleteImage}
                      disabled={loading || !image}
                      aria-label="Eliminar imagen"
                      title="Eliminar imagen"
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-slate-400 transition hover:border-red-400/50 hover:bg-red-400/10 hover:text-red-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <DeleteIcon size={18} />
                    </button>
                  </div>

                  <p className="mt-1.5 text-xs text-slate-500">
                    Si no agregas una imagen, se utilizará tu avatar generado
                    automáticamente.
                  </p>
                </div>

                <div className="flex justify-end gap-3 border-t border-slate-700 pt-5">
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={loading}
                    className="rounded-lg border border-slate-700 bg-slate-900 px-5 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-slate-700 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    disabled={loading}
                    className="rounded-lg bg-teal-400 px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-teal-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? "Guardando..." : "Guardar cambios"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

export default Profile;

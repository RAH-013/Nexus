# Nexus

Plataforma distribuida de recomendaciones personalizadas de contenido.

Nexus recopila las acciones de los usuarios y utiliza diferentes algoritmos de recomendación para generar resultados personalizados. La aplicación está diseñada para ejecutarse mediante contenedores y posteriormente desplegarse en Kubernetes.

## Arquitectura

- **Frontend:** React + TypeScript + Vite
- **API Gateway:** Node.js + Express + TypeScript
- **Base de datos:** PostgreSQL
- **Caché:** Redis
- **Proxy / Ingress:** Nginx
- **Contenedores:** Docker

## Estructura

```text
Nexus/
├── apps/
│   ├── backend/
│   └── frontend/
├── nginx/
│   └── nginx.conf
├── docker-compose.yml
├── .env
└── .gitignore
```

## Ejecución

Desde la raíz del proyecto:

```bash
docker compose up --build
```

Para ejecutar los servicios en segundo plano:

```bash
docker compose up --build -d
```

Para detener los servicios:

```bash
docker compose down
```

Para detenerlos y eliminar también los volúmenes:

```bash
docker compose down -v
```

La aplicación estará disponible en:

```bash
http://localhost:8080
```

PostgreSQL está disponible durante el desarrollo en:

```bash
localhost:5432
```

La aplicación utiliza una red Docker `bridge` personalizada llamada
`nexus_network`. Los servicios se resuelven entre sí mediante sus nombres
(`frontend`, `backend`, `postgres` y `redis`).

Redis está configurado como servicio de caché y el backend expone
`/health/ready`, que verifica su disponibilidad. Frontend, backend, Redis,
PostgreSQL y Nginx tienen healthchecks configurados en Compose; Nginx espera
a que frontend y backend estén saludables antes de iniciar.

Las imágenes de frontend y backend usan builds multi-stage: el frontend se
compila y se sirve con Nginx, mientras que el backend compila TypeScript y
ejecuta únicamente el resultado compilado junto con sus dependencias de
producción.

## Persistencia y volúmenes

La base de datos utiliza el volumen nombrado `postgres_data`, montado en
`/var/lib/postgresql` dentro del contenedor `postgres`. Al ser un volumen
nombrado, los datos sobreviven a `docker compose down` y a la eliminación del
contenedor. Solo se eliminan explícitamente con:

```bash
docker compose down -v
```

Redis funciona como caché efímera y no utiliza un volumen persistente. Su
contenido puede reconstruirse y se pierde al recrear el contenedor.

Nginx utiliza un bind mount de solo lectura para
`./nginx/nginx.conf`, montado en `/etc/nginx/nginx.conf`. Este montaje
mantiene la configuración alineada con el repositorio y no almacena datos de
la aplicación.

## Red de contenedores

Compose crea explícitamente la red `nexus_network` con el controlador
`bridge`. Todos los servicios se conectan a ella y se comunican mediante DNS
interno usando el nombre del servicio:

| Servicio | Nombre DNS interno | Uso |
|---|---|---|
| `nginx` | `nginx` | Punto de entrada HTTP |
| `frontend` | `frontend` | Aplicación web en el puerto 80 |
| `backend` | `backend` | API en el puerto 3000 |
| `postgres` | `postgres` | Base de datos en el puerto 5432 |
| `redis` | `redis` | Caché en el puerto 6379 |

Solo Nginx, PostgreSQL y el puerto de desarrollo de PostgreSQL se publican
hacia el host. La comunicación entre frontend, backend, PostgreSQL y Redis
permanece dentro de `nexus_network`.

## Gestión de secretos y variables de entorno

El archivo `.env` es únicamente local y está excluido mediante `.gitignore`.
No debe confirmarse en Git ni compartirse, porque contiene
`BETTER_AUTH_SECRET` y la contraseña de PostgreSQL. Si un secreto real se
expuso, debe revocarse y regenerarse.

El archivo `.env.example` es una plantilla sin credenciales reales. Se debe
copiar antes de iniciar el proyecto y completar localmente:

```bash
Copy-Item .env.example .env
```

Compose carga las variables desde `.env` y las inyecta al backend y a
PostgreSQL. En entornos de producción, los secretos deben proporcionarse
mediante el gestor de secretos del entorno de despliegue, no mediante un
archivo versionado.

Consultá `.env.example` para la plantilla completa de variables. El backend
valida todas ellas con un schema Zod y falla al arrancar si faltan las
obligatorias:

| Variable | Obligatoria | Descripción |
|---|---|---|
| `BETTER_AUTH_SECRET` | ✅ | Secreto de better-auth (mínimo 32 caracteres) |
| `BETTER_AUTH_URL` | ✅ | URL pública base (por defecto `http://localhost:8080`) |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | ✅ | Credenciales de PostgreSQL |
| `REDIS_URL` | ❌ | Por defecto `redis://redis:6379` en Compose |
| `GEMINI_API_KEY` | ❌ | Sin esta clave se usa el motor heurístico local |
| `TMDB_API_KEY` | ❌ | Mejora los perfiles de actores (foto y biografía) |
| `GEMINI_MODELS` | ❌ | Modelos Gemini por comas, en orden de preferencia |
| `PORT` | ❌ | Puerto del backend (por defecto 3000) |
| `NODE_ENV` / `TZ` | ❌ | Entorno y zona horaria |

## Características

- **Catálogo de películas y series** alimentado por [Cinemeta](https://v3-cinemeta.strem.io)
  (API pública de Stremio), con datos de actores enriquecidos mediante TMDB.
- **Recomendaciones personalizadas** en la sección «Para ti»: perfil del
  usuario (vistos, favoritos, likes/dislikes, comentarios) → candidatos de
  tendencia → score con Google Gemini, con motor heurístico local como
  respaldo cuando no hay API key o se agota la cuota.
- **Autenticación** con email/password mediante better-auth.
- **Interacciones**: comentarios de títulos y actores, favoritos,
  me gusta / no me gusta y marcador de «visto».
- **Actividad reciente** con paginación por cursor e infinite scroll.
- **Avatares SVG** generados con DiceBear e interfaz con animaciones
  (Framer Motion) y diseño responsive (Tailwind CSS).

## Pantallas

| Ruta | Descripción |
|---|---|
| `/` | Inicio con hero y filas de contenido (destacados, tendencias, géneros) |
| `/movies` · `/series` | Catálogos con filtros por género y orden |
| `/actors` | Cuadrícula de actores de todo el catálogo |
| `/title/:type/:id` | Ficha con póster, reparto, trailer, comentarios y reacciones |
| `/actor/:name` | Perfil de actor con biografía (TMDB) y comentarios |
| `/search` | Resultados de búsqueda |
| `/for-you` | Recomendaciones personalizadas (privada) |
| `/recent` | Actividad reciente (privada) |
| `/profile` | Perfil de usuario (privada) |
| `/auth` | Registro e inicio de sesión |

## API

Todos los endpoints se sirven bajo `/api` a través de Nginx
(`http://localhost:8080/api/...`). Las rutas principales:

| Método | Ruta | Sesión | Descripción |
|---|---|---|---|
| GET/POST | `/api/auth/*` | — | Registro, inicio/cierre de sesión (better-auth) |
| GET | `/api/cinemeta/search?type=&q=&limit=` | — | Búsqueda de títulos |
| GET | `/api/cinemeta/catalog/:collection` | — | Colecciones: featured, trending, action, drama… |
| GET | `/api/cinemeta/movies/:list` · `/series/:list` | — | Listas por género/tendencia |
| GET | `/api/cinemeta/:type/:id` | — | Ficha de título (id tipo `tt…` de IMDb) |
| GET | `/api/cinemeta/actors` · `/actor?name=` | — | Actores (agregación + TMDB) |
| GET/POST | `/api/comments/:type/:id` | POST: sí | Comentarios de títulos |
| GET/POST | `/api/actors/:name/comments` | POST: sí | Comentarios de actores |
| GET/PUT/DELETE | `/api/views[/:type/:id]` | ✅ | Marcadores de «visto» |
| GET/PUT/DELETE | `/api/reactions/:kind/:type/:id` | ✅ | Favoritos, likes y dislikes |
| GET | `/api/recommendations/for-you?refresh=1` | ✅ | Recomendaciones «Para ti» |
| GET | `/api/activity/views` · `comments` · `actor-comments` | ✅ | Actividad del usuario |
| GET | `/health` · `/health/ready` | — | Healthchecks (`ready` verifica Redis) |

## Motor de recomendaciones «Para ti»

1. Construye el perfil del usuario a partir de vistos, favoritos, likes,
   dislikes y comentarios (títulos y actores).
2. Obtiene candidatos de tendencia de Cinemeta, deduplicados y excluyendo
   contenido ya visto, favorito o descartado.
3. Calcula un score heurístico local (afinidad de géneros + formato preferido
   + popularidad).
4. Si hay `GEMINI_API_KEY`, envía los 50 mejores candidatos a Gemini (lista de
   modelos configurable en `GEMINI_MODELS`, con reintento al siguiente modelo
   al agotarse la cuota). Cada recomendación incluye score y una razón en
   español. Si Gemini falla, se usa el heurístico local.
5. Requiere mínimo 3 señales de actividad; el resultado se cachea en Redis
   (24 h) y devuelve 10 títulos. `?refresh=1` invalida la caché.

## Desarrollo local sin Docker

```bash
# Backend (Node.js >= 22.18.0)
cd apps/backend
npm install
npm run prisma:generate
npm run prisma:migrate
npm run dev                # http://localhost:3000

# Frontend
cd apps/frontend
npm install
npm run dev                # Servidor de desarrollo de Vite
```

### Scripts

**Backend** (`apps/backend`):

| Script | Descripción |
|---|---|
| `npm run dev` | Desarrollo con recarga (tsx watch) |
| `npm run build` | Compila TypeScript con tsdown |
| `npm start` | Ejecuta el build de producción |
| `npm test` | Tests con el runner nativo de Node |
| `npm run typecheck` | Comprobación de tipos |
| `npm run prisma:generate` / `prisma:migrate` / `prisma:studio` | Gestión de Prisma |

**Frontend** (`apps/frontend`):

| Script | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo (Vite) |
| `npm run build` | Compilación de tipos + build de producción |
| `npm run lint` | ESLint (typescript-eslint, react-hooks) |
| `npm run preview` | Vista previa del build |

## Diseño

La interfaz está documentada en [`docs/design/`](docs/design/) con exports SVG
de cada pantalla y el diseño original en
[Figma](https://www.figma.com/design/obb87POqyYn2vFOHit9Hsm/Nexus).

## Roadmap

- ✅ Backend, frontend y Docker Compose funcionales (etapas 1–3).
- ⏳ Despliegue en Kubernetes/Minikube (etapas 4–13): ver
  [`PENDIENTES_PROYECTO.md`](PENDIENTES_PROYECTO.md).

## Equipo

Nexus es un **proyecto colaborativo** desarrollado por un equipo de
estudiantes con roles de DevOps, backend, frontend y base de datos:
[TheEdu28](https://github.com/TheEdu28), [Fer10K](https://github.com/Fer10K),
r13 y Romi322.

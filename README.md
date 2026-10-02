# Nexus

Plataforma distribuida de recomendaciones personalizadas de contenido.

Nexus recopila las acciones de los usuarios y utiliza diferentes algoritmos de recomendación para generar resultados personalizados. La aplicación está diseñada para ejecutarse mediante contenedores y posteriormente desplegarse en Kubernetes.

## Arquitectura

- **Frontend:** React + TypeScript + Vite
- **API Gateway:** Node.js + Express + TypeScript
- **Base de datos:** PostgreSQL
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
├── compose.yml
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

## API de recomendaciones

El backend expone una API REST bajo `/api`. El algoritmo incluido es una base
content-based: las acciones del usuario (vista, like, dislike, favorito y
calificación) generan afinidad por las categorías de los contenidos, y los
ítems no vistos se ordenan por esa afinidad.

| Ruta | Uso |
| --- | --- |
| `GET /api/health/live` | Liveness probe: comprueba que el proceso está activo. |
| `GET /api/health/ready` | Readiness probe: comprueba conexión con PostgreSQL. |
| `GET /api/items` | Lista catálogo con sus categorías; acepta `type=MOVIE|SERIES` y `limit`. |
| `POST /api/items` | Crea un ítem (`title`, `type`, `description?`, `releaseYear?`). |
| `GET /api/categories` | Lista categorías disponibles. |
| `POST /api/actions` | Registra una acción (`userId`, `type`, `itemId?`, `value?`, `searchQuery?`). |
| `GET /api/recommendations/:userId` | Genera recomendaciones personalizadas; acepta `limit`. |

Ejemplo de acción implícita:

```bash
curl -X POST http://localhost:8080/api/actions \
  -H "Content-Type: application/json" \
  -d '{"userId":"usuario-1","itemId":12,"type":"LIKE"}'
```

### Datos demo

La seed crea un usuario demo, ocho contenidos, categorías, preferencias y
acciones suficientes para que el frontend muestre catálogo y recomendaciones.
Es idempotente: puedes ejecutarla otra vez sin duplicar datos.

```bash
# Opción A — cargar automáticamente al arrancar (cómodo para desarrollo frontend)
SEED_DEMO=1 docker compose up --build

# Opción B — cargar manualmente después de docker compose up --build
docker compose exec backend npm run seed

# Ver catálogo y recomendaciones del usuario demo
curl http://localhost:8080/api/items
curl http://localhost:8080/api/recommendations/nexus-demo-user

# Borrar contenidos, usuario, acciones y preferencias demo
docker compose exec backend npm run seed:reset

# Reiniciar los datos demo de una sola vez
docker compose exec backend npm run seed:refresh
```

El borrado conserva las categorías para no eliminar una taxonomía que ya haya
sido usada por datos reales.

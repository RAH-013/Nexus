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

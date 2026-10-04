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

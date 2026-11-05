# Pendientes del proyecto integrador

## Objetivo

Completar la arquitectura, contenerización y despliegue de Nexus conforme a los
requerimientos del proyecto integrador:

- Docker y Docker Compose para desarrollo local.
- Kubernetes ejecutable en Minikube.
- Persistencia de PostgreSQL.
- Configuración segura mediante ConfigMaps y Secrets.
- Autorecuperación, límites de recursos y autoescalado.
- Documentación técnica y evidencias de funcionamiento.

## Estado actual

Actualmente el proyecto cuenta con:

- Frontend en React + TypeScript + Vite.
- Backend API en Node.js + Express + TypeScript.
- Base de datos PostgreSQL.
- Nginx como proxy inverso.
- `docker-compose.yml` funcional para desarrollo.
- Imágenes basadas en Alpine.
- Volumen Docker para PostgreSQL.
- Redis como servicio de caché e invalidación en tiempo real.
- Red Docker personalizada `nexus_network` de tipo `bridge`.
- Imágenes multi-stage para frontend y backend.
- Migraciones Prisma y nuevos tipos de interacción (`DETAIL_VIEW`, `NOT_INTERESTED`, `IMPRESSION`).
- Sistema multicriterio de recomendaciones con decaimiento temporal y análisis de sentimientos léxico.
- Calificaciones con estrellas interactivas (1-5) y botón de descarte «No me interesa».
- Endpoint de salud del backend: `/health`.
- Endpoint de readiness del backend: `/health/ready`.
- Healthchecks para frontend, backend, Redis, PostgreSQL y Nginx.
- Archivos `.dockerignore` para reducir los contextos de build.
- Gestión local de secretos mediante `.env` y `.env.example`.
- Manifiestos completos de Kubernetes organizados en `k8s/` listos para Minikube.

---

## Orden recomendado de trabajo

### Fase 1: Preparar la configuración del proyecto

**Objetivo:** dejar definidos los nombres, puertos y variables que utilizarán
Docker y Kubernetes.

- [x] Confirmar la URL que utilizará Better Auth cuando se acceda mediante
  Ingress (`http://nexus.local` o host configurado en Ingress).

**Estado:** completada.

### Fase 2: Convertir las imágenes Docker a multi-stage

**Objetivo:** cumplir el requisito de multi-stage builds y crear imágenes
adecuadas para producción.

**Estado:** completada. Frontend y backend utilizan etapas de dependencias,
build y producción; Compose usa las imágenes finales sin montar el código
fuente. Los `.dockerignore` reducen los contextos de build.

### Fase 3: Validar Docker Compose

**Objetivo:** confirmar que la arquitectura local continúa funcionando antes de
migrarla a Kubernetes.

**Estado:** completada para el entorno local. Se verificaron el build, el
arranque, `docker compose ps`, `/health`, frontend, registro, inicio de sesión,
catálogo, migraciones y la configuración de red/healthchecks.

### Fase 4: Crear la estructura de Kubernetes

**Objetivo:** organizar los manifiestos y evitar configuraciones dispersas.

Estructura creada en `k8s/`:

```text
k8s/
├── namespace.yaml
├── configmap.yaml
├── secret.yaml
├── storageclass.yaml
├── postgres-statefulset.yaml
├── postgres-service.yaml
├── redis-deployment.yaml
├── redis-service.yaml
├── backend-deployment.yaml
├── backend-service.yaml
├── backend-hpa.yaml
├── frontend-deployment.yaml
├── frontend-service.yaml
├── frontend-hpa.yaml
└── ingress.yaml
```

- [x] Crear un namespace para Nexus (`nexus`).
- [x] Usar el mismo namespace en todos los manifiestos.
- [x] Definir nombres consistentes para Deployments, Services y Pods.
- [x] Definir etiquetas comunes como `app.kubernetes.io/name` y `app.kubernetes.io/component`.

**Estado:** completada.

### Fase 5: Crear la configuración y los secretos

**Objetivo:** separar la configuración pública de las credenciales.

#### ConfigMap

- [x] Crear un `ConfigMap` para variables no sensibles (`k8s/configmap.yaml`):
  - `NODE_ENV`.
  - `PORT`.
  - `TZ`.
  - `BETTER_AUTH_URL`.
  - `CINEMETA_BASE_URL`.
  - `REDIS_URL`.

#### Secret

- [x] Crear un `Secret` (`k8s/secret.yaml`) para:
  - `BETTER_AUTH_SECRET`.
  - `POSTGRES_USER`.
  - `POSTGRES_PASSWORD`.
  - `POSTGRES_DB`.
  - `DATABASE_URL`.
- [x] Crear una plantilla segura o documentar cómo generar el Secret:

  ```bash
  kubectl create secret generic nexus-secrets \
    --namespace=nexus \
    --from-literal=POSTGRES_USER=nexus \
    --from-literal=POSTGRES_PASSWORD='cambiar-esta-clave' \
    --from-literal=POSTGRES_DB=nexus \
    --from-literal=BETTER_AUTH_SECRET='cambiar-este-secreto' \
    --from-literal=DATABASE_URL='postgresql://nexus:cambiar-esta-clave@postgres-service:5432/nexus'
  ```

- [x] Documentar la diferencia entre Secrets de desarrollo y producción.

**Estado:** completada.

### Fase 6: Crear la persistencia de PostgreSQL

**Objetivo:** garantizar que los datos sobrevivan a la recreación de los Pods.

- [x] Crear `storageclass.yaml`.
- [x] Crear un `StatefulSet` para PostgreSQL (`k8s/postgres-statefulset.yaml`).
- [x] Crear un `Service` interno tipo `ClusterIP` para PostgreSQL (`k8s/postgres-service.yaml`).
- [x] Crear un `PersistentVolumeClaim` mediante `volumeClaimTemplates`.
- [x] Configurar como mínimo:
  - Tamaño: `5Gi`.
  - Modo: `ReadWriteOnce`.
  - StorageClass para Minikube (`k8s.io/minikube-hostpath`).
- [x] Cargar las credenciales desde el Secret.
- [x] Configurar `pg_isready` como probe (liveness y readiness).
- [x] Definir requests y limits de CPU y memoria.
- [x] Verificar que `DATABASE_URL` del backend apunte a `postgres-service:5432`.

**Estado:** completada.

### Fase 7: Crear el Deployment y Service del backend

**Objetivo:** desplegar la API como servicio sin estado y permitir que otros
componentes la consuman internamente.

- [x] Crear `backend-deployment.yaml`.
- [x] Configurar como mínimo `2` réplicas.
- [x] Crear `backend-service.yaml` tipo `ClusterIP`.
- [x] Exponer el puerto `3000`.
- [x] Cargar variables públicas desde el ConfigMap.
- [x] Cargar credenciales desde el Secret.
- [x] Configurar la conexión a PostgreSQL mediante el Service interno.
- [x] Configurar `livenessProbe` con `GET /health`.
- [x] Configurar `readinessProbe` con `GET /health/ready` (valida PostgreSQL y Redis).
- [x] Definir requests y limits (CPU 250m/1000m, Mem 256Mi/512Mi).
- [x] Ejecutar migraciones de Prisma de forma controlada mediante un `initContainer` antes de levantar réplicas de la API.
- [x] Evitar que varias réplicas ejecuten migraciones incompatibles al mismo tiempo.

**Estado:** completada.

### Fase 8: Crear el Deployment y Service del frontend

**Objetivo:** desplegar el frontend con alta disponibilidad básica.

- [x] Crear `frontend-deployment.yaml`.
- [x] Configurar como mínimo `2` réplicas.
- [x] Crear `frontend-service.yaml` tipo `ClusterIP`.
- [x] Exponer el puerto `80`.
- [x] Configurar `livenessProbe` con `GET /`.
- [x] Configurar `readinessProbe` con `GET /`.
- [x] Definir requests y limits (CPU 100m/500m, Mem 128Mi/256Mi).
- [x] Confirmar que las llamadas `/api` sean dirigidas al backend mediante Ingress.

**Estado:** completada.

### Fase 9: Crear el Ingress

**Objetivo:** exponer frontend y backend al exterior usando una única entrada.

- [x] Crear `ingress.yaml`.
- [x] Configurar la ruta `/` hacia el Service del frontend.
- [x] Configurar la ruta `/api` hacia el Service del backend.
- [x] Configurar la ruta `/health` hacia el Service del backend.
- [x] Configurar el controlador Nginx Ingress (`ingressClassName: nginx`).
- [x] Configurar `BETTER_AUTH_URL` coordinado con el host de acceso.

Reglas:

```text
/       -> frontend-service:80
/api    -> backend-service:3000
/health -> backend-service:3000
```

**Estado:** completada.

### Fase 10: Agregar probes y recursos

**Objetivo:** permitir que Kubernetes detecte fallas y administre recursos.

- [x] Backend:
  - `livenessProbe`: `GET /health` (puerto 3000).
  - `readinessProbe`: `GET /health/ready` (puerto 3000).
- [x] Frontend:
  - `livenessProbe` y `readinessProbe`: `GET /` (puerto 80).
- [x] PostgreSQL:
  - `livenessProbe` y `readinessProbe`: `pg_isready`.
- [x] Redis:
  - `livenessProbe` y `readinessProbe`: `redis-cli ping`.
- [x] Definir `initialDelaySeconds`, `periodSeconds`, `timeoutSeconds` y `failureThreshold`.
- [x] Definir requests y limits para todos los contenedores.

**Estado:** completada.

### Fase 11: Configurar HPA

**Objetivo:** escalar automáticamente los servicios sin estado.

- [x] Crear `backend-hpa.yaml`.
- [x] Crear `frontend-hpa.yaml`.
- [x] Configurar:
  - `minReplicas: 2`.
  - `maxReplicas: 5`.
  - CPU objetivo: `70%`.
  - Memoria objetivo: `80%`.
- [x] No crear HPA para bases de datos (PostgreSQL se gestiona vía StatefulSet).

**Estado:** completada.

### Fase 12: Ejecutar y validar en Minikube

**Objetivo:** comprobar que el despliegue cumple la rúbrica en un clúster local.

- [ ] Iniciar Minikube:

  ```bash
  minikube start
  ```

- [ ] Habilitar complementos requeridos:

  ```bash
  minikube addons enable ingress
  minikube addons enable metrics-server
  minikube addons enable storage-provisioner
  minikube addons enable default-storageclass
  ```

- [ ] Estrategia de imágenes (ver guía en README / sección 6):
  * Opción A (Local Minikube): `minikube image build -t nexus-backend:1.0.0 ./apps/backend` y `minikube image build -t nexus-frontend:1.0.0 ./apps/frontend`.
  * Opción B (Docker Hub): `docker tag` y `docker push` hacia el registro público/privado.

- [ ] Aplicar manifiestos:

  ```bash
  kubectl apply -f k8s/
  ```

- [ ] Validar recursos:

  ```bash
  kubectl get all -n nexus
  kubectl get pvc,pv -n nexus
  kubectl get ingress -n nexus
  kubectl get hpa -n nexus
  ```

- [ ] Pruebas en clúster:
  - [ ] Verificar que todos los Pods alcancen `Running` y `Ready`.
  - [ ] Verificar que el PVC de PostgreSQL esté `Bound`.
  - [ ] Probar `/health` y `/health/ready` del backend.
  - [ ] Probar el frontend a través del Ingress.
  - [ ] Probar registro, inicio de sesión, calificación de 1 a 5 estrellas y recomendaciones.
  - [ ] Simular fallo de un Pod de backend para evidenciar autorecuperación.
  - [ ] Reiniciar Pod de PostgreSQL para verificar que los datos persisten en el PVC.
  - [ ] Generar carga para evidenciar el HPA.

### Fase 13: Completar la documentación de la propuesta

- [x] Documentar la estrategia Docker y justificación de imágenes Alpine multi-stage.
- [x] Explicar el algoritmo multicriterio de recomendaciones con decaimiento temporal y análisis de sentimientos léxico.
- [x] Documentar manifiestos de Kubernetes, Deployments, StatefulSet, Services, Ingress y HPA.
- [x] Documentar el procedimiento de construcción, etiquetado y publicación en Docker Hub vs Minikube.
- [ ] Adjuntar capturas y salidas de consola de la ejecución en vivo en Minikube.

---

## Tablas de referencia

### Inventario de servicios

| Servicio | Tecnología | Docker | Kubernetes | Puerto | Exposición |
|---|---|---|---|---:|---|
| Frontend | React/Vite/Nginx | Multi-stage (`node:24-alpine` -> `nginx:alpine`) | Deployment (2 réplicas) + Service + HPA | `80` | Ingress `/` |
| Backend | Node.js/Express/TS | Multi-stage (`node:24-alpine`) | Deployment (2 réplicas) + Service + HPA | `3000` | Ingress `/api`, `/health` |
| PostgreSQL | PostgreSQL | `postgres:18-alpine` | StatefulSet + PVC (5Gi) | `5432` | ClusterIP `postgres-service` |
| Redis | Redis | `redis:8-alpine` | Deployment + Service | `6379` | ClusterIP `redis-service` |
| Ingress | Nginx Ingress | Nginx Alpine (en Compose) | Ingress Controller | `80`/`443` | Gateway Exterior |

### Probes

| Servicio | Liveness | Readiness | Estado |
|---|---|---|---|
| Frontend | `GET /` | `GET /` | Configurado en Docker Compose y en `k8s/frontend-deployment.yaml` |
| Backend | `GET /health` | `GET /health/ready` | Configurado en Docker Compose y en `k8s/backend-deployment.yaml` |
| PostgreSQL | `pg_isready` | `pg_isready` | Configurado en Docker Compose y en `k8s/postgres-statefulset.yaml` |
| Redis | `redis-cli ping` | `redis-cli ping` | Configurado en Docker Compose y en `k8s/redis-deployment.yaml` |

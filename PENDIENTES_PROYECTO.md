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
- Redis como servicio de caché.
- Red Docker personalizada `nexus_network` de tipo `bridge`.
- Imágenes multi-stage para frontend y backend.
- Migraciones Prisma.
- Endpoint de salud del backend: `/health`.
- Endpoint de readiness del backend: `/health/ready`.
- Healthchecks para frontend, backend, Redis, PostgreSQL y Nginx.
- Archivos `.dockerignore` para reducir los contextos de build.
- Gestión local de secretos mediante `.env` y `.env.example`.

Todavía no existen manifiestos de Kubernetes ni el documento formal completo de
la propuesta.

---

## Orden recomendado de trabajo

Las tareas deben realizarse en el siguiente orden. Las fases posteriores
dependen de las anteriores.

### Fase 1: Preparar la configuración del proyecto

**Objetivo:** dejar definidos los nombres, puertos y variables que utilizarán
Docker y Kubernetes.

- [ ] Confirmar la URL que utilizará Better Auth cuando se acceda mediante
  Ingress.

**Estado:** la configuración Docker local, los puertos, los secretos locales y
los nombres DNS internos de Compose ya están documentados. Queda pendiente
confirmar la URL de Better Auth para Kubernetes/Ingress.

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

Crear la siguiente estructura:

```text
k8s/
├── namespace.yaml
├── configmap.yaml
├── secret.yaml
├── storageclass.yaml
├── postgres-statefulset.yaml
├── postgres-service.yaml
├── backend-deployment.yaml
├── backend-service.yaml
├── backend-hpa.yaml
├── frontend-deployment.yaml
├── frontend-service.yaml
├── frontend-hpa.yaml
└── ingress.yaml
```

- [ ] Crear un namespace para Nexus.
- [ ] Usar el mismo namespace en todos los manifiestos.
- [ ] Definir nombres consistentes para Deployments, Services y Pods.
- [ ] Definir etiquetas comunes como `app` y `component`.

**Resultado esperado:** estructura clara para aplicar y mantener Kubernetes.

### Fase 5: Crear la configuración y los secretos

**Objetivo:** separar la configuración pública de las credenciales.

#### ConfigMap

- [ ] Crear un `ConfigMap` para variables no sensibles:
  - `NODE_ENV`.
  - `PORT`.
  - `TZ`.
  - `BETTER_AUTH_URL`.
  - `CINEMETA_BASE_URL`.

#### Secret

- [ ] Crear un `Secret` para:
  - `BETTER_AUTH_SECRET`.
  - `POSTGRES_USER`.
  - `POSTGRES_PASSWORD`.
  - `POSTGRES_DB`.
  - `DATABASE_URL`, si se administra como valor completo.
- [ ] Crear una plantilla segura o documentar cómo generar el Secret:

  ```bash
  kubectl create secret generic nexus-secrets \
    --from-literal=POSTGRES_USER=nexus \
    --from-literal=POSTGRES_PASSWORD='cambiar-esta-clave' \
    --from-literal=POSTGRES_DB=nexus \
    --from-literal=BETTER_AUTH_SECRET='cambiar-este-secreto'
  ```

- [ ] Documentar la diferencia entre Secrets de desarrollo y producción.

**Resultado esperado:** ningún secreto expuesto en ConfigMaps, imágenes o
documentación pública.

### Fase 6: Crear la persistencia de PostgreSQL

**Objetivo:** garantizar que los datos sobrevivan a la recreación de los Pods.

- [ ] Crear `storageclass.yaml`.
- [ ] Crear un `StatefulSet` para PostgreSQL.
- [ ] Crear un `Service` interno tipo `ClusterIP` para PostgreSQL.
- [ ] Crear un `PersistentVolumeClaim` mediante `volumeClaimTemplates` o un
  PVC explícito.
- [ ] Configurar como mínimo:
  - Tamaño: `5Gi` o `10Gi`.
  - Modo: `ReadWriteOnce`.
  - StorageClass para Minikube.
- [ ] Cargar las credenciales desde el Secret.
- [ ] Configurar `pg_isready` como probe.
- [ ] Definir requests y limits de CPU y memoria.
- [ ] Verificar que `DATABASE_URL` del backend apunte a:

  ```text
  postgres:5432
  ```

**Resultado esperado:** PostgreSQL funcionando como StatefulSet con
almacenamiento persistente.

### Fase 7: Crear el Deployment y Service del backend

**Objetivo:** desplegar la API como servicio sin estado y permitir que otros
componentes la consuman internamente.

- [ ] Crear `backend-deployment.yaml`.
- [ ] Configurar como mínimo `2` réplicas.
- [ ] Crear `backend-service.yaml` tipo `ClusterIP`.
- [ ] Exponer el puerto `3000`.
- [ ] Cargar variables públicas desde el ConfigMap.
- [ ] Cargar credenciales desde el Secret.
- [ ] Configurar la conexión a PostgreSQL mediante el Service interno.
- [ ] Configurar `livenessProbe` con `GET /health`.
- [ ] Configurar `readinessProbe` con `GET /health`.
- [ ] Definir requests y limits.
- [ ] Ejecutar migraciones de Prisma de forma controlada antes de usar la API.
- [ ] Evitar que varias réplicas ejecuten migraciones incompatibles al mismo
  tiempo.

**Resultado esperado:** backend accesible dentro del clúster y preparado para
escalar horizontalmente.

### Fase 8: Crear el Deployment y Service del frontend

**Objetivo:** desplegar el frontend con alta disponibilidad básica.

- [ ] Crear `frontend-deployment.yaml`.
- [ ] Configurar como mínimo `2` réplicas.
- [ ] Crear `frontend-service.yaml` tipo `ClusterIP`.
- [ ] Exponer el puerto correspondiente al servidor de frontend.
- [ ] Configurar `livenessProbe`.
- [ ] Configurar `readinessProbe`.
- [ ] Definir requests y limits.
- [ ] Confirmar que las llamadas `/api` sean dirigidas al backend mediante
  Ingress o Nginx.

**Resultado esperado:** frontend accesible internamente y disponible en dos o
más réplicas.

### Fase 9: Crear el Ingress

**Objetivo:** exponer frontend y backend al exterior usando una única entrada.

- [ ] Crear `ingress.yaml`.
- [ ] Configurar la ruta `/` hacia el Service del frontend.
- [ ] Configurar la ruta `/api` hacia el Service del backend.
- [ ] Configurar el controlador Nginx Ingress.
- [ ] Revisar el comportamiento de rutas de React.
- [ ] Configurar `BETTER_AUTH_URL` con la URL que realmente utilizará el
  navegador.
- [ ] Documentar acceso mediante IP de Minikube o dominio local.

Reglas esperadas:

```text
/    -> frontend
/api -> backend
```

**Resultado esperado:** el usuario accede al sistema desde un solo punto de
entrada.

### Fase 10: Agregar probes y recursos

**Objetivo:** permitir que Kubernetes detecte fallas y administre recursos.

#### Probes

- [ ] Backend:
  - `livenessProbe`: `GET /health`.
  - `readinessProbe`: `GET /health`.
- [ ] Frontend:
  - Probar `/` o un endpoint estático estable.
- [ ] PostgreSQL:
  - Ejecutar `pg_isready`.
- [ ] Definir `initialDelaySeconds`.
- [ ] Definir `periodSeconds`.
- [ ] Definir `timeoutSeconds`.
- [ ] Definir `failureThreshold`.

#### Recursos sugeridos

Estos valores deben ajustarse después de observar el consumo real:

| Servicio | Requests CPU | Requests memoria | Limits CPU | Limits memoria |
|---|---:|---:|---:|---:|
| Frontend | `100m` | `128Mi` | `500m` | `256Mi` |
| Backend | `250m` | `256Mi` | `1` | `512Mi` |
| PostgreSQL | `250m` | `256Mi` | `1` | `1Gi` |

- [ ] Agregar `resources.requests` y `resources.limits` a cada contenedor.
- [ ] Verificar que los valores sean compatibles con la memoria disponible en
  Minikube.

**Resultado esperado:** Pods supervisados y con consumo de recursos controlado.

### Fase 11: Configurar HPA

**Objetivo:** escalar automáticamente los servicios sin estado.

- [ ] Crear `backend-hpa.yaml`.
- [ ] Crear `frontend-hpa.yaml`.
- [ ] Configurar:
  - `minReplicas: 2`.
  - `maxReplicas: 5` o `10`.
  - CPU objetivo aproximado: `70%`.
  - Memoria objetivo aproximada: `80%`.
- [ ] No crear HPA para PostgreSQL.
- [ ] Habilitar Metrics Server en Minikube:

  ```bash
  minikube addons enable metrics-server
  ```

- [ ] Verificar métricas:

  ```bash
  kubectl top pods
  kubectl get hpa
  ```

**Resultado esperado:** frontend y backend pueden aumentar o reducir réplicas
según el uso de recursos.

### Fase 12: Ejecutar y validar en Minikube

**Objetivo:** comprobar que el despliegue cumple la rúbrica en un clúster
local.

- [ ] Iniciar Minikube:

  ```bash
  minikube start
  ```

- [ ] Habilitar complementos:

  ```bash
  minikube addons enable ingress
  minikube addons enable metrics-server
  minikube addons enable storage-provisioner
  minikube addons enable default-storageclass
  ```

- [ ] Construir las imágenes dentro del entorno de Minikube o publicarlas en
  un registro:

  ```bash
  minikube image build -t nexus-backend:dev ./apps/backend
  minikube image build -t nexus-frontend:dev ./apps/frontend
  ```

- [ ] Aplicar los manifiestos:

  ```bash
  kubectl apply -f k8s/
  ```

- [ ] Revisar los recursos:

  ```bash
  kubectl get pods
  kubectl get deployments
  kubectl get statefulsets
  kubectl get services
  kubectl get ingress
  kubectl get pvc
  kubectl get storageclass
  kubectl get hpa
  ```

- [ ] Verificar que todos los Pods estén `Running` y `Ready`.
- [ ] Verificar que el PVC esté `Bound`.
- [ ] Probar el endpoint `/health`.
- [ ] Probar el frontend.
- [ ] Probar registro e inicio de sesión.
- [ ] Reiniciar un Pod del backend y comprobar su recuperación.
- [ ] Reiniciar el Pod de PostgreSQL y comprobar que los datos persisten.
- [ ] Generar carga suficiente para observar el HPA.

**Resultado esperado:** aplicación funcional en Minikube con evidencias de
persistencia, escalamiento y autorecuperación.

### Fase 13: Completar la documentación de la propuesta

**Objetivo:** entregar el documento solicitado por la materia.

- [ ] Agregar portada.
- [ ] Registrar integrantes y roles:
  - DevOps Lead.
  - Backend Developer.
  - Frontend Developer.
  - Database Administrator.
- [ ] Redactar el resumen ejecutivo.
- [ ] Describir el problema que resuelve Nexus.
- [ ] Describir funcionalmente frontend, backend, PostgreSQL y Nginx/Ingress.
- [ ] Incluir el diagrama de arquitectura.
- [ ] Explicar la estrategia Docker.
- [ ] Justificar el uso de imágenes Alpine.
- [ ] Explicar multi-stage builds.
- [ ] Documentar redes y puertos.
- [ ] Explicar Deployments, StatefulSet, Services y PVC.
- [ ] Documentar ConfigMaps y Secrets.
- [ ] Incluir tabla de probes.
- [ ] Incluir tabla de requests y limits.
- [ ] Documentar la configuración del HPA.
- [ ] Documentar el procedimiento completo de Minikube.
- [ ] Incluir evidencias de ejecución.

## Tablas para completar durante la implementación

### Inventario de servicios

| Servicio | Tecnología | Docker | Kubernetes | Puerto | Exposición |
|---|---|---|---|---:|---|
| Frontend | React/Vite | Multi-stage | Deployment + Service | `80` | Ingress |
| Backend | Node.js/Express | Multi-stage | Deployment + Service + HPA | `3000` | Ingress `/api` |
| PostgreSQL | PostgreSQL | `postgres:18-alpine` | StatefulSet + PVC | `5432` | ClusterIP |
| Redis | Redis | `redis:8-alpine` | Deployment + Service | `6379` | ClusterIP |
| Proxy | Nginx | `nginx:alpine` | Ingress Controller | `80` | Externo |

### Probes

| Servicio | Liveness | Readiness | Estado |
|---|---|---|---|
| Frontend | `GET /` | `GET /` | Implementado en Docker Compose |
| Backend | `GET /health` | `GET /health/ready` | Implementado en Docker Compose |
| PostgreSQL | `pg_isready` | `pg_isready` | Implementado en Docker Compose; pendiente en StatefulSet |
| Redis | `redis-cli ping` | `/health/ready` del backend | Implementado en Docker Compose |
| Nginx | `GET /` | `GET /` | Implementado en Docker Compose |

### Evidencias requeridas

- [ ] `kubectl get pods`.
- [ ] `kubectl get deployments`.
- [ ] `kubectl get statefulsets`.
- [ ] `kubectl get services`.
- [ ] `kubectl get ingress`.
- [ ] `kubectl get pvc`.
- [ ] `kubectl get storageclass`.
- [ ] `kubectl get hpa`.
- [ ] Evidencia de persistencia de PostgreSQL.
- [ ] Evidencia de autorecuperación de un Pod.
- [ ] Evidencia de escalamiento del HPA.

## Criterio de finalización

El proyecto podrá considerarse completo cuando:

1. Docker Compose funcione para el desarrollo local.
2. Frontend y backend estén desplegados con al menos dos réplicas.
3. PostgreSQL se ejecute como StatefulSet.
4. PostgreSQL tenga PVC y StorageClass.
5. Backend y PostgreSQL se comuniquen mediante Services `ClusterIP`.
6. Frontend y API estén expuestos mediante Ingress.
7. Existan ConfigMap y Secret correctamente separados.
8. Todos los Pods tengan requests, limits y probes.
9. Backend y frontend tengan HPA.
10. El sistema funcione en Minikube.
11. La documentación incluya arquitectura, seguridad, despliegue y evidencias.

Los puntos de multi-stage, Compose local, volúmenes Docker, red personalizada,
Redis, healthchecks y gestión local de `.env` ya están implementados. Los
pendientes restantes de este documento corresponden principalmente al
despliegue en Kubernetes y a sus evidencias.

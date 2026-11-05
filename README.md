# Nexus

Plataforma distribuida de recomendaciones personalizadas de películas y series.

Nexus recopila las interacciones de los usuarios y utiliza algoritmos de recomendación híbridos (basados en contenido y comportamiento) para generar resultados personalizados. La aplicación cuenta con arquitectura contenerizada en Docker (Compose local) y orquestación completa en Kubernetes (Minikube).

---

## Arquitectura

- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS (empaquetado en imagen ligera `nginx:alpine`).
- **Backend API:** Node.js 24 + Express + TypeScript + Prisma ORM.
- **Base de datos:** PostgreSQL 18.
- **Caché:** Redis 8 con invalidación en tiempo real ante cambios de perfil.
- **Proxy / Ingress:** Nginx (local en Compose e Ingress Controller en Kubernetes).
- **Imágenes oficiales en Docker Hub:**
  - `theedu117/nexus-backend:1.0.0`
  - `theedu117/nexus-frontend:1.0.0`

---

## Estructura del proyecto

```text
Nexus/
├── apps/
│   ├── backend/            # API REST, Prisma, modelos y algoritmos
│   └── frontend/           # SPA React, componentes, vistas y Tailwind
├── k8s/                    # Manifiestos declarativos para Kubernetes
│   ├── namespace.yaml
│   ├── configmap.yaml
│   ├── secret.yaml
│   ├── storageclass.yaml
│   ├── postgres-statefulset.yaml
│   ├── postgres-service.yaml
│   ├── redis-deployment.yaml
│   ├── redis-service.yaml
│   ├── backend-deployment.yaml
│   ├── backend-service.yaml
│   ├── backend-hpa.yaml
│   ├── frontend-deployment.yaml
│   ├── frontend-service.yaml
│   ├── frontend-hpa.yaml
│   └── ingress.yaml
├── nginx/
│   └── nginx.conf          # Configuración de proxy para Docker Compose
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## Despliegue en Kubernetes con Minikube (Instrucciones para el equipo)

Todos los manifiestos ya están enlazados con las imágenes de Docker Hub (`theedu117/nexus-backend:1.0.0` y `theedu117/nexus-frontend:1.0.0`). Cualquier miembro del equipo puede levantar la arquitectura completa en Minikube siguiendo estos pasos.

> ** Recomendación:** Si estás en Windows, ejecuta estos comandos dentro de la terminal de **WSL (Ubuntu)** para evitar problemas de permisos de red y DNS.

### 1. Iniciar Minikube con los recursos adecuados
Para evitar que Minikube sobreasigne la memoria del sistema, arráncalo con 4GB de RAM y 2 CPUs:

```bash
minikube start --driver=docker --cpus=2 --memory=4096mb
```

### 2. Habilitar los complementos requeridos
```bash
minikube addons enable ingress
minikube addons enable metrics-server
minikube addons enable storage-provisioner
minikube addons enable default-storageclass
```

### 3. Aplicar los manifiestos de Kubernetes
Desde la raíz del proyecto (`Nexus/`):

```bash
kubectl apply -f k8s/
```
*(Nota: si es la primera vez que se crea el namespace `nexus`, vuelve a correr `kubectl apply -f k8s/` para asegurar que todos los recursos se asocien correctamente).*

### 4. Verificar el estado del clúster
Espera unos segundos y comprueba que todos los Pods estén en estado `Running (1/1)`:

```bash
kubectl get pods -n nexus
```

Salida esperada:
- `postgres-0`: `1/1 Running` (StatefulSet con volumen persistente PVC de 5Gi).
- `redis-...`: `1/1 Running` (servicio de caché).
- `backend-...`: `1/1 Running` (2 réplicas automáticas tras correr migraciones).
- `frontend-...`: `1/1 Running` (2 réplicas de Nginx).

Para verificar el almacenamiento persistente:
```bash
kubectl get pvc -n nexus
```

### 5. Abrir la aplicación en el navegador
En una **segunda pestaña de terminal** de WSL, inicia el túnel de Ingress:

```bash
minikube tunnel
```
*(Te pedirá tu contraseña de `sudo` para enlazar la red).*

Abre tu navegador web en Windows e ingresa a:
 **`http://127.0.0.1`** (o `http://localhost`).

---

## Ejecución local alternativa con Docker Compose

Si deseas probar la aplicación localmente sin Kubernetes:

```bash
# 1. Copiar variables de entorno
cp .env.example .env

# 2. Levantar los 5 contenedores
docker compose up -d --build

# 3. Comprobar salud
docker compose ps
```
Acceso en el navegador:
 **`http://localhost:8080`**

Para detenerlo:
```bash
docker compose down
```
*(O `docker compose down -v` si deseas reiniciar la base de datos desde cero).*

---

## Novedades del Sistema de Recomendaciones e Interacciones

Se mejoró integralmente el sistema para reflejar la experiencia de plataformas de streaming reales:

1. **Ponderación multicriterio de interacciones:**
   - **Calificaciones numéricas (1 a 5 estrellas):** Selector interactivo en la ficha de cada título. 4 y 5 estrellas impulsan fuertemente el género y reparto (+3.0 a +4.0); 1 y 2 estrellas penalizan (-3.0 a -4.0).
   - **Botón «No me interesa»:** Permite descartar títulos directamente desde la ficha o desde las tarjetas en «Para ti». Excluye inmediatamente el título de futuras sugerencias (-5.0).
   - **Apertura de ficha técnica (`DETAIL_VIEW`):** Registra interés implícito débil (+0.5) con límite logarítmico para evitar distorsiones por clics repetidos.
   - **Favoritos (+3.0), Me gusta (+3.0) y No me gusta (-3.0):** Señales explícitas directas.
   - **Vistos (`VIEW`, +1.0):** Contenido ya consumido (excluido de sugerencias como novedad).
   - **Impresiones (`IMPRESSION`, 0):** Registro de apariciones para auditoría.

2. **Decaimiento temporal (*Time Decay*):**
   Las interacciones antiguas pierden peso progresivamente según una función exponencial con vida media de 30 días:
   $$w(t) = w_0 \cdot \left(\frac{1}{2}\right)^{\frac{\Delta t}{30\text{ días}}}$$
   Esto permite que las recomendaciones evolucionen con los gustos actuales del usuario.

3. **Análisis léxico de sentimientos en comentarios:**
   Motor de reglas sin dependencias pesadas que clasifica el texto de las opiniones en *positivo* (+2.0), *negativo* (-2.0) o *neutro* (0), interpretando negaciones contextuales.

4. **Rotación dinámica de recomendaciones:**
   Al presionar **«Actualizar recomendaciones»**, el motor no repite los mismos 10 títulos; realiza un muestreo estocástico entre los 35 mejores candidatos afines para rotar y descubrir novedades.

5. ** Fila «Recomendado para ti» en la Pantalla Principal (Home):**
   Al ingresar a la app con tu usuario autenticado, debajo del Hero Carousel aparece una fila personalizada con tus títulos recomendados, tu nivel de compatibilidad y el motivo de la recomendación.

---

## 📡 Endpoints de la API

Todos los endpoints se sirven bajo `/api` a través de Nginx / Ingress:

| Método | Ruta | Requiere Sesión | Descripción |
|---|---|:---:|---|
| `POST` | `/api/auth/*` | — | Registro e inicio de sesión seguro (Better Auth) |
| `GET` | `/api/cinemeta/catalog/:collection` | — | Catálogo: featured, trending, géneros |
| `GET` | `/api/cinemeta/:type/:id` | — | Ficha técnica de película o serie |
| `GET` / `PUT` | `/api/interactions/rating/:type/:id` | ✅ | Consultar o guardar calificación de 1 a 5 estrellas |
| `GET` | `/api/interactions/ratings` | ✅ | Lista de todas las calificaciones del usuario |
| `PUT` / `DELETE` | `/api/interactions/not-interested/:type/:id` | ✅ | Descartar / restaurar títulos que no te interesan |
| `POST` | `/api/interactions/detail/:type/:id` | ✅ | Registrar apertura de ficha técnica |
| `POST` | `/api/interactions/impression` | ✅ | Registrar impresiones de recomendaciones |
| `GET` | `/api/recommendations/for-you?refresh=1` | ✅ | Recomendaciones personalizadas (con rotación) |
| `GET` / `PUT` / `DELETE` | `/api/reactions/:kind/:type/:id` | ✅ | Favoritos, Me gusta y No me gusta |
| `GET` / `PUT` / `DELETE` | `/api/views[/:type/:id]` | ✅ | Títulos vistos |
| `GET` | `/health` | — | Liveness probe del backend |
| `GET` | `/health/ready` | — | Readiness probe (valida conexión con DB y Redis) |

---

## Cómo actualizar las imágenes en Docker Hub (Si haces cambios de código)

Si realizas cambios en el código de `apps/backend` o `apps/frontend` y quieres compartirlos con el equipo:

```bash
# 1. Asegúrate de estar desconectado del docker-env de Minikube
eval $(minikube docker-env -u)

# 2. Iniciar sesión en Docker Hub
docker login -u theedu117

# 3. Construir las imágenes
docker build -t theedu117/nexus-backend:1.0.0 ./apps/backend
docker build -t theedu117/nexus-frontend:1.0.0 ./apps/frontend

# 4. Subir a Docker Hub
docker push theedu117/nexus-backend:1.0.0
docker push theedu117/nexus-frontend:1.0.0

# 5. Reiniciar los Pods en Minikube para descargar la nueva versión
kubectl rollout restart deployment/backend -n nexus
kubectl rollout restart deployment/frontend -n nexus
```

---

## Pruebas automatizadas

Para ejecutar la suite de 90 pruebas unitarias y de integración del backend:

```bash
cd apps/backend
npm test
```

Para comprobar la compilación de TypeScript en ambos componentes:
```bash
npm --prefix apps/backend run typecheck
npm --prefix apps/frontend run build
```

# U3 · Sesión 5 · Su API le pregunta a una IA

Respuestas listas para copiar en `u3_sesion05_practica.html`. Faltan a propósito la captura
y el reporte de `probar_api.py` (van en el PDF).

## Tus datos

- **Nombre completo:** `<tu nombre completo>`
- **Matrícula:** `<tu matrícula>`
- **Tu equipo:** Nexus

---

## 01 · Su endpoint con IA

- **Lenguaje y framework:** Node.js + Express 5 (TypeScript)
- **Método y ruta del endpoint:** `POST /api/recommendations/ficha`
- **Enlace al pull request:** `<enlace al pull request>`

### La instrucción que su API le manda a la IA

```text
Eres el asistente de fichas de Nexus, una plataforma de películas y series.
Escribe la ficha del título que aparece en la última línea.
Responde SOLO con un objeto JSON con esta forma exacta:
{"genero": "drama", "sinopsis": "Una historia..."}
- genero: el género principal en español, en una o dos palabras.
- sinopsis: dos o tres frases en español, sin inventar datos sobre personas reales.

Título: Coco
```

### ¿Qué dato del usuario le mandan a la IA, y qué datos NO le mandan?

Solo el **título** que el usuario escribe (`{"titulo": "Coco"}`), recortado y validado entre
2 y 300 caracteres. **No** se le mandan el nombre, el correo, el id de usuario, la matrícula,
el token de sesión, el historial de vistas, los comentarios, las reacciones ni las
calificaciones. La ficha se puede generar sin identificar a la persona.

---

## 02 · Funciona… y no se cae

- **`probar_ia.py`:** 4 de 4 (la IA funciona, está muy lenta, está caída y responde basura).
- **Reporte completo de `probar_api.py`:** *se pega en el PDF.*
- **Captura del endpoint con la IA real:** *se pega en el PDF.*

> El arnés se corrió con `clase-s5/probar_api_nexus.py`, copia de `probar_api.py` adaptada a
> nuestro auth (Better Auth entrega un token opaco, no un JWT): mismas 25 pruebas, mismo
> reporte y misma matrícula.

---

## 03 · Explica tu código

### 1 · La línea con el tiempo máximo de espera

Archivo `apps/backend/src/services/externo.ts`, línea 17:

```ts
const TIMEOUT_MS = 4_000;
```

y donde se aplica a cada intento de la llamada (línea 86):

```ts
signal: AbortSignal.timeout(TIMEOUT_MS),
```

### 2 · ¿Qué pasaría si quitaran ese tiempo máximo y la IA tardara 20 segundos? ¿Por qué ese número?

Sin tiempo máximo, la petición de nuestro backend se quedaría esperando los 20 segundos (o
más) y el usuario vería el *spinner* sin respuesta; además se acumularían peticiones
abiertas y el proxy podría cortar con un error que no controlamos ni devolvemos en JSON.
Con el límite, a los 4 segundos se aborta el intento, se reintenta con espera creciente y,
si no hay respuesta, se devuelve un `504` claro y en JSON.

Elegimos **4 segundos** midiendo el arranque en frío de Gemini desde el contenedor: el primer
intento tarda ~3.2 s (DNS + TLS + respuesta) y en caliente ~1 s. Con los 2 segundos del kit,
los tres intentos se abortaban y el usuario recibía un 504 aunque la IA sí respondía. El
presupuesto total de la llamada es de 9 segundos (`PRESUPUESTO_MS`), así que el peor caso
(respuesta lenta) sigue quedando por debajo de los 10 segundos que exige `probar_ia.py`, y
si la IA falla rápido (429/5xx) se alcanzan a hacer los 3 intentos.

### 3 · Si la IA se cae, ¿qué código de estado responde su API y qué mensaje ve el usuario? ¿Por qué no un 500?

- Si la IA **no responde a tiempo** (timeout agotado): **`504`** con
  `{"message": "El servicio externo no respondió a tiempo (3 intentos)"}`.
- Si la IA **responde un error pasajero** después de los reintentos: **`502`** con
  `{"message": "El servicio externo sigue fallando (503) después de 3 intentos"}`.
- Si la IA **no devuelve JSON** (por ejemplo, HTML): **`502`** con
  `{"message": "El servicio externo respondió algo que no es JSON"}`.
- Si el JSON exterior es válido pero **por dentro no trae la ficha**: **`502`** con
  `{"message": "La IA respondió algo que no es JSON"}`,
  `{"message": "La IA no devolvió la ficha esperada"}` o
  `{"message": "La IA respondió en un formato inesperado"}`.
- Si **falta la clave** (no es una falla de la IA): **`503`** con
  `{"message": "Falta configurar la variable de entorno GEMINI_API_KEY"}`.

No usamos `500` porque un `500` significa «mi código se rompió». Aquí el problema está en el
servicio del que dependemos, no en nosotros: `502 Bad Gateway` y `504 Gateway Timeout`
describen exactamente esa situación y le dicen al cliente que puede reintentar más tarde o
usar un respaldo, en lugar de hacerle creer que hay un error interno nuestro. Solo
reintentamos `429`, `5xx` y timeout; un `400`, `401` o `404` no se reintenta porque no se
arregla solo.

### 4 · La línea donde el código lee la clave

Archivo `apps/backend/src/services/gemini.ts`:

```ts
const apiKey = env.GEMINI_API_KEY;
```

La clave viaja al servicio en el encabezado `x-goog-api-key` y nunca aparece en el código,
en la URL ni en los logs; se configura en `.env`, que está ignorado por git.

### 5 · Uso de IA en esta actividad

Usé un asistente de IA (OpenCode) para contrastar la guía con el código que ya existía,
proponer la estructura del cliente externo (`llamarExterno`) y redactar los casos de prueba.
Revisé y adapté cada cambio: ajusté el tiempo máximo a 4 s después de medir el arranque en
frío de Gemini, comprobé el mapeo de errores con el simulador, y verifiqué todo con
`npm run typecheck`, `probar_ia.py` y el arnés adaptado a nuestro auth. Puedo explicar el
flujo completo: validación → llamada externa con timeout y reintentos → validación del JSON
exterior e interior → respuesta o error controlado.

### Declaración

Declaro que corrí las pruebas (`probar_api_nexus.py`, copia de `probar_api.py` adaptada a
nuestro auth) con mi matrícula contra la API de mi equipo y que puedo explicar sin notas las
tres respuestas de este bloque.

- [x] Acepto la declaración

---

## 04 · Cómo correr las pruebas (Linux, para el equipo)

Se usa `probar_api_nexus.py`, la copia de `probar_api.py` adaptada a Better Auth (token
opaco, `propio.privado` y `propio.metodo_ajeno`). El original asume JWT y no pasa las
pruebas 16–20.

**Requisitos:** repo de Nexus, Docker, Node 22+ y Python 3.10+ (el arnés solo usa la
biblioteca estándar; no hay que instalar nada). Cada quien debe usar **su matrícula de 8
dígitos** y su propio correo de pruebas para no chocar con los usuarios de los demás.

### Paso 1 · Backend en el host (no en Docker)

El simulador escucha en `127.0.0.1:9000`; un contenedor no lo alcanza. Por eso el backend se
arranca en la terminal, no con `docker compose`.

```bash
cd ~/Nexus/Nexus
docker compose up -d postgres
docker compose stop backend          # libera el puerto 3000

cd apps/backend
set -a; . ../../.env; set +a
export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@127.0.0.1:5432/${POSTGRES_DB}"
export BETTER_AUTH_URL="http://127.0.0.1:3000"
export REDIS_URL="redis://127.0.0.1:6380"
export EXTERNO_URL="http://127.0.0.1:9000"

npx tsx src/server.ts
```

Redis no hace falta para estas pruebas: si no está, solo se degrada la caché de «Para ti».

### Paso 2 · Simulador de fallas (otra terminal)

```bash
cd ~/Nexus/Nexus/clase-s5
python3 simulador.py
```

`probar_api_nexus.py` lo arranca solo si no lo encuentra, pero `probar_ia.py` sí lo necesita
abierto.

### Paso 3 · Crear los tres usuarios

En una tercera terminal, con tu matrícula y una contraseña de prueba:

```bash
cd ~/Nexus/Nexus/clase-s5
MAT=20205295                 # cámbiala por la tuya (8 dígitos)
PASS='NexusU3S5-2026'        # sin "!" para que bash no la interprete

for rol in admin usuario otro; do
  curl -s -o /dev/null -w "$rol -> %{http_code}\n" \
    -H 'Content-Type: application/json' \
    -d "{\"name\":\"U3S5 $rol\",\"email\":\"u3s5.$MAT.$rol@nexus.test\",\"password\":\"$PASS\"}" \
    http://127.0.0.1:3000/api/auth/sign-up/email
done
```

`200` = creado y `422` = ya existía (no es error, el login seguirá funcionando). Better Auth
guarda el usuario en `user`; si cambias la contraseña después, el login falla y hay que usar
otro correo.

### Paso 4 · Generar la configuración

```bash
cat > /tmp/prueba_api_nexus.json <<JSON
{
  "matricula": "$MAT",
  "base": "http://127.0.0.1:3000",
  "coleccion": "/api/comments/movie/tt0468569",
  "campo_id": "id",
  "valido":   { "text": "Comentario de prueba U3S5." },
  "invalido": { "text": "" },
  "cambio":   { "text": "Comentario actualizado U3S5." },
  "metodo_cambio": "PUT",
  "id_inexistente": "999999999",
  "openapi": "/api/openapi.yaml",
  "auth": {
    "login": "/api/auth/sign-in/email",
    "campo_token": "token",
    "admin":   { "email": "u3s5.$MAT.admin@nexus.test",   "password": "$PASS" },
    "usuario": { "email": "u3s5.$MAT.usuario@nexus.test", "password": "$PASS" },
    "otro":    { "email": "u3s5.$MAT.otro@nexus.test",    "password": "$PASS" }
  },
  "propio": {
    "coleccion": "/api/comments/movie/tt0468569",
    "valido": { "text": "Comentario privado de la prueba U3S5." },
    "privado": "/api/reactions",
    "metodo_ajeno": "DELETE"
  },
  "externo": {
    "metodo": "POST",
    "ruta": "/api/recommendations/ficha",
    "cuerpo": { "titulo": "Coco" },
    "token": "admin",
    "simulador": "http://127.0.0.1:9000"
  }
}
JSON
```

El archivo queda en `/tmp` a propósito: lleva contraseñas y no debe commitserse.

### Paso 5 · Correr las pruebas (dos veces)

```bash
cd ~/Nexus/Nexus/clase-s5

# Fallas de IA: debe dar 4 de 4
python3 probar_ia.py /tmp/prueba_api_nexus.json

# Primera corrida: 24 de 25 (la 15 queda PENDIENTE)
python3 probar_api_nexus.py /tmp/prueba_api_nexus.json
```

Ahora **reinicia el backend** (Ctrl+C en la Terminal 1 y vuelve a ejecutar los mismos
`export` + `npx tsx src/server.ts`) y repite:

```bash
python3 probar_api_nexus.py /tmp/prueba_api_nexus.json     # 25 de 25
```

El reporte se escribe en `clase-s5/reporte_U3S5_<tu_matrícula>.txt`. **No borres** el archivo
`.persistencia_U3S5_*.json` que aparece en esa carpeta: es lo que la prueba 15 comprueba
después del reinicio.

### Paso 6 · Captura con Gemini real

En la Terminal 1, sin simulador:

```bash
unset EXTERNO_URL
export GEMINI_MODELO="gemini-2.5-flash"
npx tsx src/server.ts
```

```bash
TOKEN=$(curl -s -H 'Content-Type: application/json' \
  -d "{\"email\":\"u3s5.$MAT.admin@nexus.test\",\"password\":\"$PASS\"}" \
  http://127.0.0.1:3000/api/auth/sign-in/email \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])')

curl -s -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"titulo":"Coco"}' http://127.0.0.1:3000/api/recommendations/ficha
```

Captura esa respuesta (200 + JSON) para el PDF.

### Paso 7 · Restaurar el stack

```bash
# Ctrl+C en la Terminal 1
cd ~/Nexus/Nexus
docker compose up -d backend nginx
```

Deja `EXTERNO_URL=` vacío en `.env`: dentro del contenedor `127.0.0.1:9000` no existe y la
ficha respondería 504.

### Si algo falla

| Síntoma | Causa y solución |
|---|---|
| `No pude conectarme a http://127.0.0.1:3000` | El backend no está corriendo o el puerto está ocupado por el contenedor: `docker compose stop backend`. |
| `No pude iniciar sesión como admin` o 401 en la prueba 1 | Usuario inexistente o contraseña distinta: repite el paso 3 con otro correo y regenera el JSON. |
| `falta "auth" en prueba.json` | La config no tiene los bloques `admin`/`usuario`/`otro` o `campo_token` no es `token`. |
| `"matricula" debe ser tu matrícula de 8 dígitos` | Ajusta `"matricula"` en el JSON. |
| La 15 sale `PENDIENTE` | Es lo normal en la primera corrida: reinicia el backend y corre otra vez. No borres `.persistencia_U3S5_*.json`. |
| La 15 dice «el registro desapareció» | Se borró el archivo de persistencia o cambió la BD entre corridas: repite las dos corridas seguidas. |
| `probar_ia.py` dice «No hay simulador» | Arranca `python3 simulador.py` en la Terminal 2. |
| La ficha devuelve 504 con el simulador apagado | `EXTERNO_URL` apunta al simulador y no está abierto, o el backend corre dentro de Docker. |
| Las pruebas 16–20 fallan con `probar_api.py` | Es el original (asume JWT): usa `probar_api_nexus.py`. |
| `npm test` no encuentra archivos | Node < 22 no expande el glob: usa `node --import tsx --test src/routes/*.test.ts`. |

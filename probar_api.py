
import hashlib
import http.cookiejar
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

CONFIG = sys.argv[1] if len(sys.argv) > 1 else "prueba.json"

try:
    with open(CONFIG, encoding="utf-8") as f:
        cfg = json.load(f)
except FileNotFoundError:
    sys.exit(f"No encuentro {CONFIG}. Debe estar en la misma carpeta que probar_api.py.")
except json.JSONDecodeError as e:
    sys.exit(f"{CONFIG} no es un JSON válido (línea {e.lineno}): revisa comas y comillas.")

MAT = str(cfg.get("matricula", ""))
BASE = cfg.get("base", "http://127.0.0.1:8000").rstrip("/")
COL = "/" + cfg.get("coleccion", "/recursos").strip("/")
CAMPO_ID = cfg.get("campo_id", "id")
VALIDO = cfg.get("valido", {})
INVALIDO = cfg.get("invalido", {})
CAMBIO = cfg.get("cambio", VALIDO)
METODO_CAMBIO = cfg.get("metodo_cambio", "PUT").upper()
ID_INEXISTENTE = str(cfg.get("id_inexistente", "999999"))
ENCABEZADOS = cfg.get("encabezados", {})
OPENAPI = "/" + str(cfg.get("openapi", "/openapi.json")).strip("/")

AUTH = cfg.get("auth", {})
LOGIN = "/" + str(AUTH.get("login", "/login")).strip("/")
ADMIN = AUTH.get("admin", {})
USUARIO = AUTH.get("usuario", {})
OTRO = AUTH.get("otro", {})

PROPIO = cfg.get("propio", {})
PROPIO_COL = "/" + str(PROPIO.get("coleccion", "")).strip("/")
PROPIO_VALIDO = PROPIO.get("valido", {})

EXTERNO = cfg.get("externo", {})
SIM_URL = str(EXTERNO.get("simulador", "http://127.0.0.1:9000")).rstrip("/")

ESTADO = (
    f".persistencia_U3S6_{MAT}_"
    f"{hashlib.sha256((BASE + COL).encode()).hexdigest()[:6]}.json"
)

SESIONES = {
    nombre: http.cookiejar.CookieJar()
    for nombre in ("admin", "usuario", "otro")
}

APERTURAS = {
    nombre: urllib.request.build_opener(
        urllib.request.HTTPCookieProcessor(SESIONES[nombre])
    )
    for nombre in SESIONES
}

APERTURA_ANONIMA = urllib.request.build_opener()

if not (MAT.isdigit() and len(MAT) == 8):
    sys.exit("En prueba.json, \"matricula\" debe ser tu matrícula de 8 dígitos.")

if not VALIDO or not INVALIDO:
    sys.exit("En prueba.json faltan \"valido\" o \"invalido\".")

if METODO_CAMBIO not in ("PUT", "PATCH"):
    sys.exit("\"metodo_cambio\" debe ser PUT o PATCH.")

SIN_AUTH = not (ADMIN and USUARIO and OTRO)

if not EXTERNO.get("ruta"):
    sys.exit("En prueba.json falta \"externo\": la ruta de SU API que llama al servicio externo.")

if not SIN_AUTH and not (PROPIO_COL.strip("/") and PROPIO_VALIDO):
    sys.exit("En prueba.json falta \"propio\": la colección con dueño y un \"valido\" para crear ahí.")

TOKEN_ADMIN = None
TOKEN_USUARIO = None
TOKEN_OTRO = None


def pedir(
    metodo,
    ruta,
    cuerpo=None,
    crudo=None,
    token="admin",
    espera=10,
    sesion=None,
    encabezados=None
):
    datos = crudo.encode() if crudo is not None else (
        json.dumps(cuerpo).encode() if cuerpo is not None else None
    )

    h = {
        "Accept": "application/json",
        **ENCABEZADOS,
        **(encabezados or {})
    }

    perfil = sesion if sesion in SESIONES else (
        token if token in SESIONES else None
    )

    if perfil is None and token is not None:
        if token == "admin":
            t = TOKEN_ADMIN
        else:
            t = token

        if t:
            h["Authorization"] = f"Bearer {t}"

    if datos is not None:
        h["Content-Type"] = "application/json"

    req = urllib.request.Request(
        BASE + ruta,
        data=datos,
        method=metodo,
        headers=h
    )

    cliente = APERTURAS[perfil] if perfil else APERTURA_ANONIMA

    try:
        with cliente.open(req, timeout=espera) as r:
            return r.status, dict(r.headers), r.read().decode("utf-8", "replace")

    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), e.read().decode("utf-8", "replace")

    except (TimeoutError, OSError) as e:
        if isinstance(e, urllib.error.URLError) and not isinstance(
            getattr(e, "reason", None), TimeoutError
        ):
            sys.exit(f"No pude conectarme a {BASE}: {e.reason}. ¿Tu API está corriendo?")

        return None, {}, ""

def como_json(texto):
    try:
        return json.loads(texto)
    except (json.JSONDecodeError, ValueError, TypeError):
        return None


def lista_de(cuerpo):
    if isinstance(cuerpo, list):
        return cuerpo

    if isinstance(cuerpo, dict):
        for v in cuerpo.values():
            if isinstance(v, list):
                return v

    return None


def objeto_de(cuerpo):
    if isinstance(cuerpo, dict) and CAMPO_ID not in cuerpo:
        for v in cuerpo.values():
            if isinstance(v, dict) and CAMPO_ID in v:
                return v

    return cuerpo


def contiene(obj, esperado):
    return isinstance(obj, dict) and all(
        str(obj.get(k)) == str(v)
        for k, v in esperado.items()
    )


resultados = []
salida = []


def registrar(n, nombre, ok, detalle):
    resultados.append("1" if ok else "0")
    linea = f"[{'OK' if ok else 'X '} ] {n:>2}. {nombre:<44} {detalle}"
    linea = linea.replace("]  ", "] ")
    salida.append(linea)
    print(linea)


def es_error_json(cuerpo_texto):
    return como_json(cuerpo_texto) is not None


def entrar(cred, perfil):
    c, _, t = pedir(
        "POST",
        LOGIN,
        cred,
        token=None,
        sesion=perfil,
        encabezados={
            "Origin": ENCABEZADOS.get("Origin", "http://127.0.0.1:8080"),
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
    )

    tiene_cookie = len(SESIONES[perfil]) > 0

    return c, t, perfil if c == 200 and tiene_cookie else None


print(f"Probando {BASE}{COL} con la matrícula {MAT}\n")

if not SIN_AUTH:
    c_adm, t_adm, TOKEN_ADMIN = entrar(ADMIN, "admin")

    if not TOKEN_ADMIN:
        print(f"No pude iniciar sesión como admin en POST {LOGIN} (-> {c_adm}).")
        print(f"Respuesta: {t_adm[:300]}")
        sys.exit(
            "Revisa las credenciales de admin y que Better Auth devuelva "
            "una cookie de sesión válida."
        )
else:
    print(
        '(prueba.json no tiene "auth": '
        "las pruebas 16 a 20 se marcan como no pasadas)\n"
    )

# 15 (parte 2). Comprobar persistencia después del reinicio.

persistio = None

if os.path.exists(ESTADO):
    try:
        with open(ESTADO, encoding="utf-8") as f:
            guardado = json.load(f)
    except (OSError, json.JSONDecodeError):
        guardado = {}

    if guardado.get("url") == BASE + COL and guardado.get("id"):
        c, _, t = pedir("GET", f"{COL}/{guardado['id']}")
        persistio = c == 200 and contiene(objeto_de(como_json(t)), VALIDO)
        pedir("DELETE", f"{COL}/{guardado['id']}")

    os.remove(ESTADO)

# 1. Crear.

c, h, t = pedir("POST", COL, VALIDO)
creado = objeto_de(como_json(t))
nuevo_id = None

if isinstance(creado, dict) and CAMPO_ID in creado:
    nuevo_id = str(creado[CAMPO_ID])
else:
    loc = {k.lower(): v for k, v in h.items()}.get("location", "")

    if loc:
        nuevo_id = loc.rstrip("/").split("/")[-1]

registrar(
    1,
    "POST con datos válidos crea (201)",
    c == 201 and nuevo_id is not None,
    f"-> {c}" + ("" if nuevo_id else " (no encontré el id en la respuesta ni en Location)")
)

if not nuevo_id:
    print(
        "\nSin el id del recurso creado no puedo seguir. "
        "Revisa que el POST responda 201 y regrese el recurso con su id."
    )
    sys.exit(1)

UNO = f"{COL}/{nuevo_id}"

# 2. Consultar.

c, h, t = pedir("GET", UNO)

registrar(
    2,
    "GET del recurso creado (200)",
    c == 200 and contiene(objeto_de(como_json(t)), VALIDO),
    f"-> {c}"
)

# 3. Listar.

c, h, t = pedir("GET", COL)
lista = lista_de(como_json(t))

esta = isinstance(lista, list) and any(
    isinstance(x, dict) and str(x.get(CAMPO_ID)) == nuevo_id
    for x in lista
)

registrar(3, "GET de la colección lo incluye (200)", c == 200 and esta, f"-> {c}")

antes = len(lista) if isinstance(lista, list) else None

# 4-6. Datos inválidos.

c, h, t = pedir("POST", COL, INVALIDO)
_, _, t2 = pedir("GET", COL)

l2 = lista_de(como_json(t2))
despues = len(l2) if isinstance(l2, list) else None
protegido = antes is not None and despues == antes

registrar(4, "POST inválido se rechaza (422 o 400)", c in (400, 422), f"-> {c}")

registrar(
    5,
    "…y no se guardó nada (la foto no cambió)",
    protegido,
    f"antes {antes}, después {despues}" if antes is not None else "no pude leer la colección"
)

ok6 = c in (400, 422) and es_error_json(t)

registrar(
    6,
    "…y el error viene en JSON",
    ok6,
    "" if ok6 else ("la respuesta no es JSON" if c in (400, 422) else "no hubo error")
)

# 7. JSON roto.

c, h, t = pedir("POST", COL, crudo='{"esto no es": JSON,,}')

ok7 = c in (400, 422) and es_error_json(t)

nota7 = (
    " (un 500 es un bug: tu API se cayó)"
    if c is not None and c >= 500
    else (
        " (el error no viene en JSON)"
        if c in (400, 422) and not ok7
        else ""
    )
)

registrar(7, "JSON roto: 400/422 con error en JSON", ok7, f"-> {c}{nota7}")

# 8. No existe.

c, h, t = pedir("GET", f"{COL}/{ID_INEXISTENTE}")

registrar(8, "GET de uno que no existe (404)", c == 404, f"-> {c}")

# 9. Cambio dos veces: idempotencia.

c1, _, _ = pedir(METODO_CAMBIO, UNO, CAMBIO)
_, _, f1 = pedir("GET", UNO)

c2, _, _ = pedir(METODO_CAMBIO, UNO, CAMBIO)
_, _, f2 = pedir("GET", UNO)

foto1 = objeto_de(como_json(f1))
foto2 = objeto_de(como_json(f2))

ok9 = (
    c1 in (200, 204)
    and c2 in (200, 204)
    and foto1 == foto2
    and contiene(foto1, CAMBIO)
)

registrar(
    9,
    f"{METODO_CAMBIO} dos veces: misma foto",
    ok9,
    f"-> {c1} y {c2}" + ("" if foto1 == foto2 else " (la foto cambió)")
)

# 10. Borrar dos veces.

c1, _, _ = pedir("DELETE", UNO)
c2, _, _ = pedir("DELETE", UNO)

registrar(
    10,
    "DELETE dos veces (204/200 y luego 404)",
    c1 in (200, 204) and c2 == 404,
    f"-> {c1} y {c2}"
)

# 11. Ya no existe.

c, _, _ = pedir("GET", UNO)

registrar(11, "GET después de borrar (404)", c == 404, f"-> {c}")

# 12-14. Contrato OpenAPI.

c, h, t = pedir("GET", OPENAPI)

es_openapi = (
    c == 200
    and re.search(r'["\']?openapi["\']?\s*:\s*["\']?3\.', t) is not None
)

registrar(
    12,
    f"El contrato OpenAPI existe ({OPENAPI})",
    es_openapi,
    f"-> {c}" + (
        "" if es_openapi or c != 200 else " (no dice openapi: 3.x)"
    )
)

col_re = re.escape(COL)

documenta = (
    es_openapi
    and re.search(col_re + r'["\']?\s*:', t) is not None
    and re.search(col_re + r'/\{[^}]+\}', t) is not None
)

registrar(
    13,
    "…documenta la colección y /{id}",
    documenta,
    "" if documenta else f"no encuentro {COL} y {COL}/{{id}}"
)

cods = [
    k for k in ("201", "404", "422")
    if re.search(r'(["\']' + k + r'["\']|^\s*' + k + r')\s*:', t, re.M)
]

ok14 = es_openapi and len(cods) == 3

registrar(
    14,
    "…y documenta 201, 404 y 422",
    ok14,
    "" if ok14 else f"solo encontré: {', '.join(cods) or 'ninguno'}"
)

# 15. Persistencia.

PID15 = None

if persistio is None:
    c, h, t = pedir("POST", COL, VALIDO)
    obj = objeto_de(como_json(t))

    pid = (
        str(obj[CAMPO_ID])
        if isinstance(obj, dict) and CAMPO_ID in obj
        else None
    )

    if c == 201 and pid:
        PID15 = pid

        with open(ESTADO, "w", encoding="utf-8") as f:
            json.dump({"url": BASE + COL, "id": pid}, f)

        registrar(
            15,
            "Los datos sobreviven a un reinicio",
            False,
            "PENDIENTE: reinicia tu API y vuelve a correr la prueba"
        )
    else:
        registrar(
            15,
            "Los datos sobreviven a un reinicio",
            False,
            f"no pude crear el registro de prueba (-> {c})"
        )
else:
    registrar(
        15,
        "Los datos sobreviven a un reinicio",
        persistio,
        "" if persistio else "el registro desapareció: ¿sigues guardando en memoria?"
    )

# 16-20. Autenticación y autorización con cookies Better Auth.

if not SIN_AUTH:
    mala = dict(USUARIO)

    campo_clave = "password" if "password" in mala else list(mala)[-1]
    mala[campo_clave] = str(mala[campo_clave]) + "x"

    c_mal, _, t_mal = pedir(
        "POST",
        LOGIN,
        mala,
        token=None
    )

    c_ok, t_ok, TOKEN_USUARIO = entrar(USUARIO, "usuario")
    _, _, TOKEN_OTRO = entrar(OTRO, "otro")

    filtra = str(USUARIO[campo_clave]) in t_ok

    ok16 = (
        c_mal == 401
        and es_error_json(t_mal)
        and c_ok == 200
        and TOKEN_USUARIO is not None
        and not filtra
    )

    registrar(
        16,
        "Login: clave mala 401; buena crea sesión",
        ok16,
        f"-> {c_mal} y {c_ok}"
        + (" (¡la respuesta incluye la clave!)" if filtra else "")
        + ("" if TOKEN_USUARIO else " (no se creó la sesión del usuario)")
        + ("" if TOKEN_OTRO else ' (no se pudo iniciar sesión como "otro")')
    )

    # 17. Sin sesión: escribir en la colección.

    _, _, ta = pedir("GET", COL)
    la = lista_de(como_json(ta))

    c, _, t = pedir("POST", COL, VALIDO, token=None)

    _, _, tb = pedir("GET", COL)
    lb = lista_de(como_json(tb))

    no_guardo = (
        isinstance(la, list)
        and isinstance(lb, list)
        and len(la) == len(lb)
    )

    if c in (200, 201):
        o = objeto_de(como_json(t))

        if isinstance(o, dict) and CAMPO_ID in o:
            pedir("DELETE", f"{COL}/{o[CAMPO_ID]}")

    registrar(
        17,
        "Sin sesión: POST se rechaza (401)",
        c == 401 and no_guardo and es_error_json(t),
        f"-> {c}"
    )

    # 18. Bearer token inválido sin cookie de sesión.

    alterado = "invalid.better-auth.session.token"

    c, _, t = pedir(
        "GET",
        PROPIO_COL,
        token=alterado
    )

    registrar(
        18,
        "Token inválido se rechaza (401)",
        c == 401,
        f"-> {c}"
    )

    # 19. El usuario normal no puede borrar un recurso del administrador.

    c, _, t = pedir("POST", COL, VALIDO)

    o = objeto_de(como_json(t))

    rid = (
        str(o[CAMPO_ID])
        if isinstance(o, dict) and CAMPO_ID in o
        else None
    )

    limpiar = rid is not None

    if rid is None and PID15:
        rid = PID15

    if rid and TOKEN_USUARIO:
        c19, _, t19 = pedir(
            "DELETE",
            f"{COL}/{rid}",
            token=TOKEN_USUARIO
        )

        sigue, _, _ = pedir("GET", f"{COL}/{rid}")

        ok19 = c19 in (403, 404) and sigue == 200

        registrar(
            19,
            "Rol sin permiso: DELETE se rechaza (403)",
            ok19,
            f"-> {c19}" + (" (¡lo borró!)" if sigue != 200 else "")
        )

        if limpiar:
            pedir("DELETE", f"{COL}/{rid}")
    else:
        registrar(
            19,
            "Rol sin permiso: DELETE se rechaza (403)",
            False,
            "no pude crear el recurso de prueba como admin"
        )

    # 20. Un usuario no puede ver los recursos privados de otro.

    ok20 = False
    det20 = ""

    if TOKEN_USUARIO and TOKEN_OTRO:
        c, h, t = pedir(
            "POST",
            PROPIO_COL,
            PROPIO_VALIDO,
            token=TOKEN_USUARIO
        )

        o = objeto_de(como_json(t))

        pid = (
            str(o[CAMPO_ID])
            if isinstance(o, dict) and CAMPO_ID in o
            else None
        )

        if c == 201 and pid:
            c_otro, _, _ = pedir(
                "GET",
                f"{PROPIO_COL}/{pid}",
                token=TOKEN_OTRO
            )

            c_dueno, _, _ = pedir(
                "GET",
                f"{PROPIO_COL}/{pid}",
                token=TOKEN_USUARIO
            )

            ok20 = c_otro in (403, 404) and c_dueno == 200

            det20 = (
                f"otro -> {c_otro}, dueño -> {c_dueno}"
                + (" (¡otro usuario lo pudo ver!)" if c_otro == 200 else "")
            )

            pedir(
                "DELETE",
                f"{PROPIO_COL}/{pid}",
                token=TOKEN_USUARIO
            )
        else:
            det20 = f"el usuario no pudo crear en {PROPIO_COL} (-> {c})"
    else:
        det20 = "faltan las sesiones del usuario y otro"

    registrar(
        20,
        "Dueño: otro usuario no ve lo ajeno",
        ok20,
        det20
    )

else:
    for n, nom in (
        (16, "Login: clave mala 401; buena crea sesión"),
        (17, "Sin sesión: POST se rechaza (401)"),
        (18, "Token inválido se rechaza (401)"),
        (19, "Rol sin permiso: DELETE se rechaza (403)"),
        (20, "Dueño: otro usuario no ve lo ajeno")
    ):
        registrar(n, nom, False, 'falta "auth" en prueba.json (sesión 4)')

# 21-25. Integración con un servicio externo.

def control(datos=None):
    req = urllib.request.Request(
        SIM_URL + "/_control",
        data=json.dumps(datos).encode() if datos else None,
        method="POST" if datos else "GET",
        headers={"Content-Type": "application/json"}
    )

    with urllib.request.urlopen(req, timeout=5) as r:
        return json.loads(r.read())


try:
    control()
except Exception:
    try:
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        import simulador

        if EXTERNO.get("real"):
            simulador.REAL = str(EXTERNO["real"]).rstrip("/")

        simulador.arrancar(int(SIM_URL.rsplit(":", 1)[1]))
        time.sleep(0.3)

    except Exception as e:
        print(f"(no pude arrancar el simulador: {e})")

E_MET = str(EXTERNO.get("metodo", "POST")).upper()
E_RUTA = "/" + str(EXTERNO["ruta"]).strip("/")

E_TOKEN = {
    "admin": TOKEN_ADMIN,
    "usuario": TOKEN_USUARIO,
    "otro": TOKEN_OTRO,
    "ninguno": None
}.get(EXTERNO.get("token", "admin"), "admin")


def integrar(modo):
    try:
        control({
            "modo": modo,
            "reiniciar": True,
            "segundos": 20
        })
    except Exception:
        return None, 0.0, "", -1

    t0 = time.time()

    c, _, t = pedir(
        E_MET,
        E_RUTA,
        EXTERNO.get("cuerpo"),
        token=E_TOKEN,
        espera=15
    )

    dt = time.time() - t0

    try:
        n = control()["llamadas_recibidas"]
    except Exception:
        n = -1

    return c, dt, t, n


c, dt, t, n = integrar("normal")

if n == -1:
    registrar(
        21,
        "Externo normal: responde 2xx",
        False,
        "no hay simulador en " + SIM_URL
    )
else:
    pasa = n >= 1

    registrar(
        21,
        "Externo normal: responde 2xx",
        c is not None and 200 <= c < 300 and pasa,
        f"-> {c}, {n} llamada(s) al simulador"
        + (
            ""
            if pasa
            else " (¡su API no pasó por el simulador! ¿la arrancaron con EXTERNO_URL="
            + SIM_URL + "?)"
        )
    )

c, dt, t, n = integrar("lento")

registrar(
    22,
    "Externo tarda: responde en < 10 s (502/504)",
    c in (502, 503, 504) and dt <= 10 and es_error_json(t),
    (
        f"-> {c} en {dt:.1f} s"
        if c is not None
        else f"-> su API no respondió en {dt:.0f} s"
    )
    + (" (¿tiene timeout la llamada al externo?)" if dt > 10 else "")
)

c, dt, t, n = integrar("falla_una")

registrar(
    23,
    "Externo falla 1 vez: reintenta y responde 2xx",
    c is not None and 200 <= c < 300 and n >= 2,
    f"-> {c}, {n} llamada(s)"
    + (" (no reintentó)" if n == 1 else "")
)

c, dt, t, n = integrar("error_400")

registrar(
    24,
    "Externo responde 400: NO reintenta",
    c is not None and c >= 400 and n == 1 and es_error_json(t),
    f"-> {c}, {n} llamada(s)"
    + (" (no se reintenta un 400)" if n > 1 else "")
)

c, dt, t, n = integrar("basura")

registrar(
    25,
    "Externo responde basura: 502 en JSON",
    c in (502, 503, 504) and es_error_json(t),
    f"-> {c}"
    + (
        " (¿validan lo que responde el externo?)"
        if c == 500 or (c is not None and c < 300)
        else ""
    )
)

try:
    control({"modo": "normal"})
except Exception:
    pass

# 26-28. CORS.

CORS = cfg.get("cors", {}) if isinstance(cfg.get("cors"), dict) else {}

ORIGEN = str(
    CORS.get("origen", "http://127.0.0.1:5500")
).rstrip("/")

AJENO = "http://sitio-ajeno.example"

RUTA_CORS = "/" + str(CORS.get("ruta", COL)).strip("/")


def con_origen(metodo, origen, extra=None):
    h = {"Origin": origen, **(extra or {})}

    req = urllib.request.Request(
        BASE + RUTA_CORS,
        method=metodo,
        headers=h
    )

    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.status, {k.lower(): v for k, v in r.headers.items()}

    except urllib.error.HTTPError as e:
        return e.code, {k.lower(): v for k, v in e.headers.items()}

    except OSError:
        return None, {}


c, h = con_origen("GET", ORIGEN)

acao = h.get("access-control-allow-origin")

registrar(
    26,
    "CORS: su página recibe permiso",
    acao in (ORIGEN, "*"),
    f"-> Access-Control-Allow-Origin: {acao}"
    if acao
    else f"-> {c} sin Access-Control-Allow-Origin (¿agregaron {ORIGEN} a su lista de CORS?)"
)

c, h = con_origen("GET", AJENO)

acao = h.get("access-control-allow-origin")

registrar(
    27,
    "CORS: una página ajena NO recibe permiso",
    acao not in ("*", AJENO),
    "-> sin permiso, bien"
    if not acao
    else f"-> Access-Control-Allow-Origin: {acao} (usen una lista de orígenes, no *)"
)

c, h = con_origen(
    "OPTIONS",
    ORIGEN,
    {
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "authorization, content-type"
    }
)

ah = h.get("access-control-allow-headers", "").lower()
am = h.get("access-control-allow-methods", "").upper()

ok28 = (
    c is not None
    and 200 <= c < 300
    and h.get("access-control-allow-origin") in (ORIGEN, "*")
    and ("authorization" in ah or ah.strip() == "*")
    and ("POST" in am or am.strip() == "*")
)

registrar(
    28,
    "CORS: la pregunta previa acepta Authorization",
    ok28,
    f"-> {c}"
    + (
        ""
        if ok28
        else (
            " (¿responden OPTIONS antes de pedir el token?)"
            if c in (401, 403, 404, 405)
            else f" (Allow-Headers: {ah or 'ninguno'}; Allow-Methods: {am or 'ninguno'})"
        )
    )
)

# Resultado final.

bits = "".join(resultados)

codigo = hashlib.sha256(
    f"{MAT}|U3S6|{bits}".encode()
).hexdigest()[:8].upper()

total = bits.count("1")

fin = [
    "",
    f"RESULTADO: {total} de {len(bits)}",
    f"U3S6;{MAT};{BASE}{COL};{bits};{codigo}",
]

for x in fin:
    print(x)

salida.extend(fin)

with open(
    f"reporte_U3S6_{MAT}.txt",
    "w",
    encoding="utf-8"
) as f:
    f.write(
        f"Probando {BASE}{COL} con la matrícula {MAT}\n\n"
        + "\n".join(salida)
        + "\n"
    )

if persistio is None and os.path.exists(ESTADO):
    print(
        "\n>>> Falta la prueba 15: reinicia tu API "
        "(Ctrl+C y vuelve a correrla) y corre otra vez: python probar_api.py"
    )

print(f"\nGuardado en reporte_U3S6_{MAT}.txt. Pégalo completo en el artefacto.")

# borra SOLO los datos de demostracion: las 4 cuentas demo, sus negocios, publicaciones,
# cuaderno, consultas y fotos. no toca nada real.
# uso: las mismas variables que crear_demo.py y luego: python scripts/demo/borrar_demo.py
import json, os, sys, urllib.request, urllib.error

URL = os.environ.get('SUPABASE_URL', '').rstrip('/')
CLAVE = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')
if not URL or not CLAVE:
    sys.exit('Falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
CORREOS = ['demo.esperanza@example.com', 'demo.morichal@example.com', 'demo.tienda@example.com', 'demo.comprador@example.com']


def pedir(metodo, ruta, cuerpo=None):
    req = urllib.request.Request(URL + ruta, data=json.dumps(cuerpo).encode() if cuerpo is not None else None, method=metodo,
                                 headers=dict({'apikey': CLAVE, 'Content-Type': 'application/json'}, **({} if CLAVE.startswith('sb_') else {'Authorization': 'Bearer ' + CLAVE})))
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            t = r.read().decode()
            return json.loads(t) if t.strip() else None
    except urllib.error.HTTPError as e:
        raise RuntimeError(metodo + ' ' + ruta + ' -> ' + str(e.code) + ' ' + e.read().decode()[:300])


def archivos(prefijo):
    # lista todas las fotos dentro de una carpeta (y sus subcarpetas)
    salida = []
    for item in pedir('POST', '/storage/v1/object/list/sava-media', {'prefix': prefijo, 'limit': 1000}) or []:
        ruta = prefijo + '/' + item['name']
        if item.get('id'):
            salida.append(ruta)
        else:
            salida.extend(archivos(ruta))
    return salida


usuarios = pedir('GET', '/auth/v1/admin/users?per_page=200').get('users', [])
for u in usuarios:
    if u.get('email') not in CORREOS:
        continue
    fotos = archivos(u['id'])
    if fotos:
        pedir('DELETE', '/storage/v1/object/sava-media', {'prefixes': fotos})
    # borrar la cuenta borra en cascada sus negocios, publicaciones, ventas, cuaderno y consultas
    pedir('DELETE', '/auth/v1/admin/users/' + u['id'])
    print('borrada', u['email'], '(' + str(len(fotos)) + ' fotos)')
print('Listo: datos de demostración borrados.')

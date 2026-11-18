# datos de DEMOSTRACION para mostrar sava en una exposicion.
# todo queda marcado "(Demo)" y se borra con borrar_demo.py.
# uso (en powershell, dentro de la carpeta Sava):
#   $env:SUPABASE_URL="https://TU-PROYECTO.supabase.co"
#   $env:SUPABASE_SERVICE_ROLE_KEY="la-clave-service_role"   (nunca la subas a github)
#   python scripts/demo/crear_demo.py
import json, os, sys, uuid, urllib.request, urllib.error
from datetime import datetime, timedelta, timezone

URL = os.environ.get('SUPABASE_URL', '').rstrip('/')
CLAVE = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')
if not URL or not CLAVE:
    sys.exit('Falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
FOTOS = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fotos')
CLAVE_DEMO = 'SavaDemo2026!'
TELEFONO_DEMO = '3000000000'
NS = uuid.UUID('6f2c1d4e-0000-4000-8000-5a7a0de30000')


def id_fijo(texto):
    # siempre el mismo id para el mismo dato: se puede correr varias veces sin duplicar
    return str(uuid.uuid5(NS, texto))


def hace(dias, horas=0):
    return (datetime.now(timezone.utc) - timedelta(days=dias, hours=horas)).isoformat()


def pedir(metodo, ruta, cuerpo=None, extra=None, tipo='application/json', datos=None):
    # las claves nuevas (sb_secret_...) solo van en apikey; las antiguas (jwt) tambien en authorization
    cab = {'apikey': CLAVE, 'Content-Type': tipo}
    if not CLAVE.startswith('sb_'):
        cab['Authorization'] = 'Bearer ' + CLAVE
    if extra:
        cab.update(extra)
    data = datos if datos is not None else (json.dumps(cuerpo).encode() if cuerpo is not None else None)
    req = urllib.request.Request(URL + ruta, data=data, method=metodo, headers=cab)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            t = r.read().decode() or 'null'
            return json.loads(t) if t.strip().startswith(('{', '[', 'null')) else t
    except urllib.error.HTTPError as e:
        raise RuntimeError(metodo + ' ' + ruta + ' -> ' + str(e.code) + ' ' + e.read().decode()[:300])


def upsert(tabla, filas):
    return pedir('POST', '/rest/v1/' + tabla, filas, {'Prefer': 'resolution=merge-duplicates,return=minimal'})


def usuario(correo, nombre, rol):
    lista = pedir('GET', '/auth/v1/admin/users?per_page=200')
    for u in lista.get('users', []):
        if u.get('email') == correo:
            return u['id']
    u = pedir('POST', '/auth/v1/admin/users', {'email': correo, 'password': CLAVE_DEMO, 'email_confirm': True, 'user_metadata': {'nombre': nombre, 'rol': rol, 'autoriza_datos': True, 'politica_version': '1.1', 'autorizacion_version': 'datos-1.0', 'autoriza_ia': True}})
    return u['id']


def subir_foto(ruta_servidor, archivo):
    datos = open(os.path.join(FOTOS, archivo), 'rb').read()
    pedir('POST', '/storage/v1/object/sava-media/' + ruta_servidor, extra={'x-upsert': 'true'}, tipo='image/jpeg', datos=datos)
    return ruta_servidor


# 1. cuentas de demostracion
esperanza = usuario('demo.esperanza@example.com', 'Rosa Pérez (Demo)', 'agricultor')
morichal = usuario('demo.morichal@example.com', 'Luis Camacho (Demo)', 'agricultor')
tienda_u = usuario('demo.tienda@example.com', 'Agro El Llano (Demo)', 'tienda')
comprador = usuario('demo.comprador@example.com', 'Comprador (Demo)', 'comprador')
print('cuentas listas')

# 2. negocios
negocios = {
    'esperanza': {'id': id_fijo('negocio-esperanza'), 'owner_id': esperanza, 'name': 'Finca La Esperanza (Demo)', 'category': 'Finca', 'municipality': 'Aguazul', 'description': 'Negocio de demostración. Piña, yuca y papaya.'},
    'morichal': {'id': id_fijo('negocio-morichal'), 'owner_id': morichal, 'name': 'Finca El Morichal (Demo)', 'category': 'Finca', 'municipality': 'Yopal', 'description': 'Negocio de demostración. Plátano, arroz y maíz.'},
    'tienda': {'id': id_fijo('negocio-tienda'), 'owner_id': tienda_u, 'name': 'Agro El Llano (Demo)', 'category': 'Tienda agropecuaria', 'municipality': 'Yopal', 'description': 'Tienda de demostración. Abonos, semillas y herramientas.'},
}
upsert('businesses', [dict(n, phone=TELEFONO_DEMO, is_published=True) for n in negocios.values()])
print('negocios listos')

# 3. publicaciones con fotos reales (creditos en creditos_fotos.md)
publicaciones = [
    ('esperanza', 'Piña oro miel', 'Frutas', 'kg', 550, 100, 0, ['pina.jpg', 'pina-2.jpg'], 1, 'Piña dulce recién cosechada, de primera. Entrega en la finca o en Aguazul.'),
    ('esperanza', 'Yuca', 'Tubérculos', 'tonelada', 1.5, 0.5, 1200000, ['yuca.jpg', 'yuca-2.jpg'], 5, 'Yuca fresca, buena para cocinar o para almidón.'),
    ('esperanza', 'Papaya', 'Frutas', 'canastilla', 37, 0, 45000, ['papaya.jpg', 'papaya-2.jpg'], 2, 'Papaya madura en canastillas de unos 20 kilos.'),
    ('morichal', 'Plátano hartón', 'Frutas', 'racimo', 60, 0, 28000, ['platano.jpg', 'platano-2.jpg'], 0, 'Racimos grandes, cosecha de esta semana.'),
    ('morichal', 'Arroz paddy', 'Granos', 'bulto', 120, 20, 0, ['arroz.jpg', 'arroz-2.jpg'], 4, 'Arroz paddy seco, en bultos. Precio a convenir según cantidad.'),
    ('morichal', 'Maíz amarillo', 'Granos', 'kg', 1500, 200, 1400, ['maiz.jpg', 'maiz-2.jpg'], 8, 'Maíz amarillo seco, desgranado o en mazorca.'),
    ('tienda', 'Abono triple 15 x 50 kg', 'Nutrición de cultivos', 'bulto', 30, 0, 165000, ['abono.jpg'], 3, 'Bulto de 50 kilos.'),
    ('tienda', 'Semillas de maíz', 'Semillas y plantas', 'kg', 80, 0, 18000, ['semillas.jpg'], 6, 'Semilla de maíz para siembra.'),
    ('tienda', 'Machete 22 pulgadas', 'Herramientas', 'unidad', 20, 0, 32000, ['machete.jpg'], 10, 'Machete de acero con cacha.'),
    ('tienda', 'Fumigadora de espalda 20 L', 'Equipos agrícolas', 'unidad', 8, 0, 240000, ['fumigadora.jpg'], 1, 'Fumigadora manual de espalda.'),
]
productos = {}
filas = []
for neg, nombre, cat, unidad, stock, minimo, precio, fotos, dias, desc in publicaciones:
    n = negocios[neg]
    pid = id_fijo('producto-' + nombre)
    rutas = [subir_foto(n['owner_id'] + '/' + n['id'] + '/' + pid + ('' if i == 0 else '-' + str(i + 1)) + '.jpg', f) for i, f in enumerate(fotos)]
    productos[nombre] = {'id': pid, 'negocio': n['id'], 'unidad': unidad, 'precio': precio}
    filas.append({'id': pid, 'business_id': n['id'], 'name': nombre, 'category': cat, 'description': 'Publicación de demostración. ' + desc, 'price_cop': precio, 'stock': stock, 'unit': unidad,
                  'photo_path': rutas[0], 'photo_paths': rutas[1:], 'is_published': True, 'municipality': n['municipality'], 'available_from': hace(dias)[:10], 'delivery': 'A convenir',
                  'retired': False, 'min_order': minimo, 'created_at': hace(dias, 3), 'updated_at': hace(dias, 3)})
upsert('products', filas)
print('publicaciones listas:', len(filas))

# 4. cuaderno: ventas (tabla sales) y movimientos
def venta(clave, negocio, producto, cantidad, precio, dias, pagado=True, persona=''):
    p = productos[producto]
    vid = id_fijo('venta-' + clave)
    total = round(cantidad * precio)
    upsert('sales', [{'id': vid, 'business_id': negocio, 'total_cop': total, 'sold_at': hace(dias)}])
    upsert('sale_items', [{'id': id_fijo('item-' + clave), 'sale_id': vid, 'product_id': p['id'], 'quantity': cantidad, 'unit_price_cop': precio}])
    return {'id': vid, 'business_id': negocio, 'tipo': 'venta', 'product_id': p['id'], 'producto': producto, 'cantidad': cantidad, 'unidad': p['unidad'], 'monto': total, 'pagado': pagado, 'ref_id': None, 'persona': persona, 'nota': '', 'fecha': hace(dias)}


def mov(clave, negocio, tipo, dias, producto=None, cantidad=0, monto=0, nota='', persona='', ref=None):
    p = productos[producto] if producto else None
    return {'id': id_fijo('mov-' + clave), 'business_id': negocio, 'tipo': tipo, 'product_id': p['id'] if p else None, 'producto': producto or '', 'cantidad': cantidad, 'unidad': p['unidad'] if p else '',
            'monto': monto, 'pagado': True, 'ref_id': ref, 'persona': persona, 'nota': nota, 'fecha': hace(dias)}


e = negocios['esperanza']['id']
t = negocios['tienda']['id']
fiada = venta('pina-fiada', e, 'Piña oro miel', 100, 2100, 3, pagado=False, persona='Don Pedro (Demo)')
movimientos = [
    mov('cosecha-pina', e, 'cosecha', 10, 'Piña oro miel', 800),
    venta('pina-1', e, 'Piña oro miel', 150, 2000, 7),
    venta('yuca-1', e, 'Yuca', 0.5, 1200000, 5),
    fiada,
    mov('cobro-pedro', e, 'cobro', 1, 'Piña oro miel', monto=100000, persona='Don Pedro (Demo)', ref=fiada['id']),
    mov('gasto-abono', e, 'gasto', 8, monto=180000, nota='Abono'),
    mov('gasto-jornal', e, 'gasto', 6, monto=120000, nota='Jornal'),
    mov('gasto-transporte', e, 'gasto', 2, monto=60000, nota='Transporte'),
    mov('perdida-papaya', e, 'perdida', 4, 'Papaya', 3, nota='Se maduraron demasiado'),
    mov('compra-abono', t, 'compra', 12, 'Abono triple 15 x 50 kg', 40, 5200000, persona='Distribuidor (Demo)'),
    mov('compra-machete', t, 'compra', 11, 'Machete 22 pulgadas', 25, 550000, persona='Distribuidor (Demo)'),
    venta('abono-1', t, 'Abono triple 15 x 50 kg', 10, 165000, 3),
    venta('machete-1', t, 'Machete 22 pulgadas', 5, 32000, 2),
    mov('gasto-arriendo', t, 'gasto', 9, monto=800000, nota='Arriendo'),
]
upsert('movimientos', movimientos)
print('cuaderno listo:', len(movimientos), 'movimientos')

# 5. interes de compradores: consultas y contactos por whatsapp (para mis cosechas y notificaciones)
pina = productos['Piña oro miel']
yuca = productos['Yuca']
upsert('orders', [
    {'id': id_fijo('consulta-1'), 'business_id': e, 'customer_id': comprador, 'customer_name': 'Comprador (Demo)', 'customer_phone': TELEFONO_DEMO, 'note': 'Hola, ¿me puede vender 200 kilos para el viernes?', 'status': 'pending', 'total_cop': 0, 'created_at': hace(0, 5), 'updated_at': hace(0, 5)},
    {'id': id_fijo('consulta-2'), 'business_id': e, 'customer_id': comprador, 'customer_name': 'Comprador (Demo)', 'customer_phone': TELEFONO_DEMO, 'note': '¿Tiene yuca para entregar en Yopal?', 'status': 'accepted', 'total_cop': 1200000, 'created_at': hace(1), 'updated_at': hace(0, 20)},
])
upsert('order_items', [
    {'id': id_fijo('consulta-1-item'), 'order_id': id_fijo('consulta-1'), 'product_id': pina['id'], 'product_name': 'Piña oro miel', 'quantity': 200, 'unit': 'kg', 'unit_price_cop': 0, 'line_total_cop': 0},
    {'id': id_fijo('consulta-2-item'), 'order_id': id_fijo('consulta-2'), 'product_id': yuca['id'], 'product_name': 'Yuca', 'quantity': 1, 'unit': 'tonelada', 'unit_price_cop': 1200000, 'line_total_cop': 1200000},
])
upsert('contactos', [
    {'id': id_fijo('contacto-1'), 'product_id': pina['id'], 'business_id': e, 'buyer_id': comprador, 'created_at': hace(0, 3)},
    {'id': id_fijo('contacto-2'), 'product_id': pina['id'], 'business_id': e, 'buyer_id': comprador, 'created_at': hace(1, 2)},
    {'id': id_fijo('contacto-3'), 'product_id': productos['Papaya']['id'], 'business_id': e, 'buyer_id': comprador, 'created_at': hace(2)},
])
print('consultas y contactos listos')
print('')
print('LISTO. Cuentas de demostración (contraseña: ' + CLAVE_DEMO + '):')
print('  demo.esperanza@example.com  -> Finca La Esperanza (cuaderno, consultas)')
print('  demo.morichal@example.com   -> Finca El Morichal')
print('  demo.tienda@example.com     -> Agro El Llano (cuaderno de tienda)')
print('  demo.comprador@example.com  -> comprador')

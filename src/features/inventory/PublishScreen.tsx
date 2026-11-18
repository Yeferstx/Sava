import { useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { preguntarOrigen, tomarOElegirFoto } from '../../shared/fotos';
import { ImagePlus, Mic, X } from 'lucide-react-native';
import { createProduct, updateProduct } from './data/inventoryRepository';
import { getBusinessProfile } from '../business/data/businessRepository';
import { getProductImageUri } from '../marketplace/getProductImageUri';
import { useEspacioTeclado } from '../../shared/useEspacioTeclado';
import { colors } from '../../shared/theme';
import type { ProductDraft } from '../chat/types';
import type { Product } from './types';
import { CANTIDAD_MAXIMA, errorCantidad, leerCantidad, leerPrecio, municipios, tecladoCantidad } from '../../shared/validaciones';
import { categoriasAgricolas, categoriasInsumos, categoriaVisible, fechaDesdeHoy, formasEntrega, opcionesFecha, unidades, unidadesInsumo } from '../../shared/agro';
import BotonEscuchar from '../../shared/components/BotonEscuchar';

type Props = { onBack: () => void; onCreated: () => void; initialDraft?: ProductDraft | null; producto?: Product | null; tipo?: 'agricultor' | 'tienda'; onUsarVoz?: () => void };

// separa "Recogida en la finca · detalle" en la forma y el detalle
function partirEntrega(texto: string | undefined) {
  if (!texto) return { forma: 'A convenir', detalle: '' };
  for (const forma of formasEntrega) {
    if (texto === forma) return { forma, detalle: '' };
    if (texto.startsWith(forma + ' · ')) return { forma, detalle: texto.slice(forma.length + 3) };
  }
  return { forma: 'A convenir', detalle: texto };
}

export default function PublishScreen({ onBack, onCreated, initialDraft, producto, tipo = 'agricultor', onUsarVoz }: Props) {
  const editando = !!producto;
  // la tienda del campo publica insumos, el campesino publica cosechas
  const esTienda = tipo === 'tienda';
  let listaCategorias = categoriasAgricolas;
  let listaUnidades = unidades;
  if (esTienda) { listaCategorias = categoriasInsumos; listaUnidades = unidadesInsumo; }
  let base: ProductDraft | null = null;
  if (producto) base = producto;
  else if (initialDraft) base = initialDraft;
  const entregaInicial = partirEntrega(producto ? producto.delivery : undefined);

  const [name, setName] = useState(base ? base.name : '');
  const [description, setDescription] = useState(base ? base.description : '');
  const [category, setCategory] = useState(base ? categoriaVisible(base.category) : listaCategorias[0]);
  const [price, setPrice] = useState(base && base.price_cop ? String(base.price_cop) : '');
  const [stock, setStock] = useState(base && base.stock ? String(base.stock) : '');
  const [unit, setUnit] = useState(base ? base.unit : listaUnidades[0]);
  const [municipio, setMunicipio] = useState(producto && producto.municipality ? producto.municipality : initialDraft && initialDraft.municipality ? initialDraft.municipality : '');
  const [disponible, setDisponible] = useState(producto && producto.available_from ? producto.available_from : initialDraft && initialDraft.available_from ? initialDraft.available_from : fechaDesdeHoy(0));
  const [entrega, setEntrega] = useState(entregaInicial.forma);
  const [detalleEntrega, setDetalleEntrega] = useState(entregaInicial.detalle);
  // precio a convenir: el productor prefiere negociarlo con cada comprador
  const [aConvenir, setAConvenir] = useState((!!producto && producto.price_cop === 0) || (!!initialDraft && initialDraft.price_cop === 0));
  const [minimo, setMinimo] = useState(producto && producto.min_order ? String(producto.min_order) : initialDraft && initialDraft.min_order ? String(initialDraft.min_order) : '');
  const [photoUri, setPhotoUri] = useState<string | null>(producto ? producto.photo_uri : null);
  // hasta 3 fotos mas para la galeria
  const [extras, setExtras] = useState<string[]>(() => { try { return producto && producto.extra_photos ? JSON.parse(producto.extra_photos) as string[] : []; } catch { return []; } });
  const [saving, setSaving] = useState(false);
  const teclaEspacio = useEspacioTeclado();

  // el municipio por defecto es el de la finca
  useEffect(() => {
    if (municipio !== '') return;
    void getBusinessProfile().then((finca) => {
      if (finca && municipios.includes(finca.city)) setMunicipio(finca.city);
      else setMunicipio('Yopal');
    }).catch(() => setMunicipio('Yopal'));
  }, []);

  // la foto se toma o se elige y se achica antes de guardarla (sube mas rapido)
  function choosePhoto() {
    preguntarOrigen('Foto principal', (origen) => { void tomarOElegirFoto(origen).then((uri) => { if (uri) setPhotoUri(uri); }); });
  }
  function agregarExtra() {
    preguntarOrigen('Otra foto', (origen) => { void tomarOElegirFoto(origen).then((uri) => { if (uri) setExtras((lista) => lista.concat(uri).slice(0, 3)); }); });
  }

  async function submit(borrador = false) {
    const parsedPrice = leerPrecio(price);
    const parsedStock = leerCantidad(stock);
    if (name.trim().length < 3) {
      Alert.alert('Revisa la publicación', 'El nombre debe tener al menos 3 letras.');
      return;
    }
    const error = errorCantidad(parsedStock, unit);
    if (error !== '') {
      Alert.alert('Revisa la cantidad', error);
      return;
    }
    if (parsedStock > CANTIDAD_MAXIMA) {
      Alert.alert('Revisa la cantidad', 'La cantidad no puede pasar de ' + CANTIDAD_MAXIMA + '.');
      return;
    }
    let pedidoMinimo = 0;
    if (minimo.trim() !== '') {
      pedidoMinimo = leerCantidad(minimo);
      if (pedidoMinimo <= 0 || pedidoMinimo > parsedStock) {
        Alert.alert('Revisa el pedido mínimo', 'Debe ser mayor que 0 y no más de lo que tienes disponible. Si vendes cualquier cantidad, déjalo vacío.');
        return;
      }
    }
    if (!aConvenir && parsedPrice === 0) {
      Alert.alert('Revisa el precio', 'Escribe un precio sin centavos, por ejemplo 2500 o 2.500. Si prefieres negociarlo, toca «A convenir».');
      return;
    }
    if (municipios.includes(municipio) === false) {
      Alert.alert('Elige el municipio', 'Toca el municipio de Casanare donde está el producto.');
      return;
    }
    let textoEntrega = entrega;
    if (detalleEntrega.trim() !== '') textoEntrega = entrega + ' · ' + detalleEntrega.trim();
    const datos = { name: name.trim(), category, description: description.trim(), price_cop: aConvenir ? 0 : parsedPrice, stock: parsedStock, min_order: pedidoMinimo, is_published: borrador ? 0 : 1, unit, photo_uri: photoUri, extra_photos: extras, municipality: municipio, available_from: disponible, delivery: textoEntrega };
    try {
      setSaving(true);
      if (producto) {
        await updateProduct(producto.id, datos);
        Alert.alert('Publicación actualizada', 'Los cambios quedaron guardados en el celular y se sincronizarán cuando haya internet.');
      } else {
        await createProduct(datos);
        if (borrador) Alert.alert('Borrador guardado', 'Quedó en tu celular y no lo ven los compradores. Cuando quieras, ábrelo en «Mis cosechas» y toca «Reanudar» para publicarlo.');
        else Alert.alert('Listo para publicar', 'Quedó guardado en el celular. Los compradores lo verán cuando se suba a internet; mientras tanto aparece como «Pendiente de publicación».');
      }
      onCreated();
    } catch (error) {
      Alert.alert('No se pudo guardar', error instanceof Error ? error.message : 'Intenta de nuevo.');
    } finally { setSaving(false); }
  }

  const fotoVisible = getProductImageUri(photoUri);
  const tituloPrecio = 'Precio por ' + unit;
  let textoBoton = 'Publicar';
  if (editando) textoBoton = 'Guardar cambios';
  if (saving) textoBoton = 'Guardando…';

  return (
    <View ref={teclaEspacio.ref} onLayout={teclaEspacio.medir} style={[styles.flex, { paddingBottom: teclaEspacio.espacio }]}><ScrollView style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
      <Pressable onPress={onBack}><Text style={styles.back}>‹  Volver</Text></Pressable>
      <Text style={styles.title}>{editando ? 'Editar publicación' : esTienda ? 'Publicar producto' : 'Publicar cosecha'}</Text>
      <Text style={styles.subtitle}>Cuéntales a los compradores qué tienes disponible.</Text>
      <BotonEscuchar texto={'Llena los datos de arriba hacia abajo. Puedes hablar tocando el micrófono de tu teclado. Al final toca el botón verde.'} />
      {!!onUsarVoz && <Pressable accessibilityRole="button" onPress={onUsarVoz} style={styles.voz}><Mic size={20} color={colors.white} /><View style={{ flex: 1 }}><Text style={styles.vozTitulo}>Decirlo con mi voz</Text><Text style={styles.vozTexto}>Cuéntale a tu asistente qué tienes y él llena los datos</Text></View></Pressable>}

      <Text style={styles.label}>{esTienda ? 'Foto del producto' : 'Foto de la cosecha'}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={fotoVisible ? 'Cambiar foto' : 'Elegir foto'} onPress={() => void choosePhoto()} style={styles.photoPicker}>
        {fotoVisible ? <Image source={{ uri: fotoVisible }} style={styles.photoPreview} resizeMode="cover" /> : <View style={styles.photoEmpty}><ImagePlus size={27} color={colors.brown} /><Text style={styles.photoHint}>Añade una foto real</Text><Text style={styles.photoSubhint}>Una buena foto ayuda a vender</Text></View>}
      </Pressable>
      {!!fotoVisible && <Pressable accessibilityRole="button" onPress={() => setPhotoUri(null)} style={styles.removePhoto}><X size={14} color={colors.brown} /><Text style={styles.removePhotoText}>Quitar foto</Text></Pressable>}
      {!!fotoVisible && <View style={styles.extras}>
        {extras.map((uri, i) => { const ver = getProductImageUri(uri); return <View key={uri + i} style={styles.extra}>
          {ver ? <Image source={{ uri: ver }} style={styles.extraImagen} /> : null}
          <Pressable accessibilityRole="button" accessibilityLabel="Quitar esta foto" hitSlop={8} onPress={() => setExtras(extras.filter((_, j) => j !== i))} style={styles.extraQuitar}><X size={13} color={colors.white} /></Pressable>
        </View>; })}
        {extras.length < 3 && <Pressable accessibilityRole="button" accessibilityLabel="Agregar otra foto" onPress={agregarExtra} style={[styles.extra, styles.extraAgregar]}><ImagePlus size={20} color={colors.verde} /><Text style={styles.extraTexto}>Otra foto</Text></Pressable>}
      </View>}

      <Text style={styles.label}>{esTienda ? '¿Qué vendes? *' : '¿Qué cosechaste? *'}</Text>
      <TextInput value={name} onChangeText={setName} placeholder={esTienda ? 'Ej. Abono triple 15 x 50 kg' : 'Ej. Piña oro miel'} placeholderTextColor={colors.muted} style={styles.input} maxLength={80} />

      <Text style={styles.label}>Categoría</Text>
      <View style={styles.options}>{listaCategorias.map((item) => <Pressable key={item} onPress={() => setCategory(item)} style={[styles.option, category === item && styles.optionSelected]}><Text style={[styles.optionText, category === item && styles.optionTextSelected]}>{item}</Text></Pressable>)}</View>

      {category === 'Protección de cultivos' && <Text style={styles.aviso}>Si publicas agroquímicos (venenos, herbicidas, fungicidas), solo con registro ICA vigente y etiqueta original. Indica en la descripción el registro y las precauciones de uso.</Text>}

      <Text style={styles.label}>Cantidad disponible *</Text>
      <TextInput value={stock} onChangeText={setStock} placeholder="Ej. 150" placeholderTextColor={colors.muted} style={[styles.input, styles.stockInput]} keyboardType={tecladoCantidad(unit)} maxLength={10} />
      <Text style={styles.label}>Unidad de medida</Text>
      <View style={styles.options}>{listaUnidades.map((item) => <Pressable key={item} onPress={() => setUnit(item)} style={[styles.option, unit === item && styles.optionSelected]}><Text style={[styles.optionText, unit === item && styles.optionTextSelected]}>{item}</Text></Pressable>)}</View>

      <Text style={styles.label}>Pedido mínimo (opcional)</Text>
      <TextInput value={minimo} onChangeText={setMinimo} placeholder={'Ej. 100. Vacío = vendes cualquier cantidad'} placeholderTextColor={colors.muted} style={[styles.input, styles.stockInput]} keyboardType={tecladoCantidad(unit)} maxLength={10} />
      <Text style={styles.ayuda}>Si vendes por lotes, escribe desde cuántos {unit === 'unidad' ? 'unidades' : unit + 's'} ofreces.</Text>

      <Text style={styles.label}>{tituloPrecio}</Text>
      <View style={styles.options}>
        <Pressable accessibilityRole="button" onPress={() => setAConvenir(false)} style={[styles.option, !aConvenir && styles.optionSelected]}><Text style={[styles.optionText, !aConvenir && styles.optionTextSelected]}>Pongo precio</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => setAConvenir(true)} style={[styles.option, aConvenir && styles.optionSelected]}><Text style={[styles.optionText, aConvenir && styles.optionTextSelected]}>A convenir</Text></Pressable>
      </View>
      {!aConvenir && <TextInput value={price} onChangeText={setPrice} placeholder="Ej. 2.500 (pesos)" placeholderTextColor={colors.muted} style={[styles.input, styles.spaced]} keyboardType="number-pad" maxLength={13} />}
      {aConvenir && <Text style={styles.ayuda}>Los compradores verán «Precio a convenir» y te escribirán para negociar.</Text>}

      <Text style={styles.label}>Municipio *</Text>
      <View style={styles.options}>{municipios.map((item) => <Pressable key={item} onPress={() => setMunicipio(item)} style={[styles.option, municipio === item && styles.optionSelected]}><Text style={[styles.optionText, municipio === item && styles.optionTextSelected]}>{item}</Text></Pressable>)}</View>

      <Text style={styles.label}>¿Desde cuándo está disponible?</Text>
      <View style={styles.options}>{opcionesFecha.map((item) => {
        const fecha = fechaDesdeHoy(item.dias);
        const elegida = disponible === fecha || (item.dias === 0 && disponible < fecha);
        return <Pressable key={item.texto} onPress={() => setDisponible(fecha)} style={[styles.option, elegida && styles.optionSelected]}><Text style={[styles.optionText, elegida && styles.optionTextSelected]}>{item.texto}</Text></Pressable>;
      })}</View>

      <Text style={styles.label}>Entrega o recogida</Text>
      <View style={styles.options}>{formasEntrega.map((item) => <Pressable key={item} onPress={() => setEntrega(item)} style={[styles.option, entrega === item && styles.optionSelected]}><Text style={[styles.optionText, entrega === item && styles.optionTextSelected]}>{item}</Text></Pressable>)}</View>
      <TextInput value={detalleEntrega} onChangeText={setDetalleEntrega} placeholder="Detalle opcional, ej. vereda La Chaparrera, sábados" placeholderTextColor={colors.muted} style={[styles.input, styles.spaced]} maxLength={100} />

      <Text style={styles.label}>Descripción (opcional)</Text>
      <TextInput value={description} onChangeText={setDescription} placeholder="Variedad, tamaño, estado de la cosecha…" placeholderTextColor={colors.muted} style={[styles.input, styles.multiline]} multiline textAlignVertical="top" maxLength={240} />
      <Text style={styles.counter}>{description.length}/240</Text>

      <Pressable disabled={saving} onPress={() => void submit()} style={[styles.submit, saving && styles.disabled]}><Text style={styles.submitText}>{textoBoton}</Text></Pressable>
      {!editando && <Pressable accessibilityRole="button" disabled={saving} onPress={() => void submit(true)} style={styles.borrador}><Text style={styles.borradorTexto}>Guardar como borrador</Text></Pressable>}
      <Text style={styles.footnote}>Puedes publicar sin internet. La publicación queda pendiente y se sube cuando vuelva la conexión.</Text>
    </ScrollView></View>
  );
}

const styles = StyleSheet.create({
  voz: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, backgroundColor: colors.verde, marginTop: 12 },
  vozTitulo: { color: colors.white, fontSize: 16, fontWeight: '900' },
  vozTexto: { color: colors.verdeClaro, fontSize: 13, marginTop: 2 },
  extras: { flexDirection: 'row', gap: 8, marginTop: 4 },
  extra: { width: 74, height: 74, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.salvia },
  extraImagen: { width: '100%', height: '100%' },
  extraQuitar: { position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(38,51,47,0.75)', alignItems: 'center', justifyContent: 'center' },
  extraAgregar: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.verde, borderStyle: 'dashed', backgroundColor: colors.white },
  extraTexto: { color: colors.verde, fontSize: 11, fontWeight: '800', marginTop: 2 },
  borrador: { alignItems: 'center', paddingVertical: 13, marginTop: 8, borderRadius: 24, borderWidth: 1.5, borderColor: colors.verde },
  borradorTexto: { color: colors.verde, fontSize: 15, fontWeight: '800' },
  ayuda: { color: colors.muted, fontSize: 13, lineHeight: 18, marginTop: 6 },
  flex: { flex: 1 }, content: { padding: 22, paddingTop: 14, paddingBottom: 40 }, back: { color: colors.brown, fontWeight: '700', fontSize: 15, marginBottom: 18 },
  title: { color: colors.ink, fontSize: 24, fontWeight: '900' }, subtitle: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: 7, marginBottom: 8 },
  label: { color: colors.ink, fontSize: 14, fontWeight: '800', marginTop: 18, marginBottom: 8 },
  input: { backgroundColor: colors.white, borderColor: colors.line, borderWidth: 1, borderRadius: 13, paddingHorizontal: 14, paddingVertical: 12, color: colors.ink, fontSize: 15 },
  spaced: { marginTop: 9 },
  photoPicker: { height: 175, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: colors.line, borderStyle: 'dashed', backgroundColor: colors.white },
  photoPreview: { width: '100%', height: '100%' }, photoEmpty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 7 },
  photoHint: { color: colors.brown, fontSize: 14, fontWeight: '800' }, photoSubhint: { color: colors.muted, fontSize: 12 },
  removePhoto: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, padding: 9 }, removePhotoText: { color: colors.brown, fontSize: 12, fontWeight: '700' },
  multiline: { height: 92 }, counter: { color: colors.muted, fontSize: 11, textAlign: 'right', marginTop: 4 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  option: { borderRadius: 18, paddingHorizontal: 13, paddingVertical: 9, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
  optionSelected: { backgroundColor: colors.verdeClaro, borderColor: colors.brown }, optionText: { fontSize: 13, color: colors.ink }, optionTextSelected: { color: colors.brown, fontWeight: '800' },
  stockInput: { width: 140 },
  aviso: { color: '#775D50', backgroundColor: '#F5E7E2', borderRadius: 12, padding: 11, fontSize: 13, lineHeight: 18, marginTop: 10, overflow: 'hidden' },
  submit: { backgroundColor: colors.brown, borderRadius: 26, alignItems: 'center', padding: 16, marginTop: 26 }, disabled: { opacity: 0.6 }, submitText: { color: colors.white, fontWeight: '800', fontSize: 15 },
  footnote: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 10, textAlign: 'center' },
});

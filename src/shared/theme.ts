// paleta oficial de sava
// primarios: verde profundo, beige crema y arcilla suave
// secundarios: verde claro, blanco y grafito
export const colors = {
  paper: '#F0E9DF', // beige crema, fondo de la app
  ink: '#26332F', // grafito, texto principal
  muted: '#636A64', // grafito suavizado con crema, texto secundario
  brown: '#174B3F', // verde profundo, botones y acentos (se deja el nombre para no cambiar todas las pantallas)
  gold: '#C98770', // arcilla suave, detalles
  line: '#DCD7CD', // bordes
  white: '#FFFFFF',
  verde: '#174B3F',
  crema: '#F0E9DF',
  arcilla: '#C98770',
  verdeClaro: '#E8F2EE',
  grafito: '#26332F',
  salvia: '#DCEBE2', // verde salvia, cuerpo del asistente y detalles suaves
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 18, xl: 24, xxl: 32 } as const;

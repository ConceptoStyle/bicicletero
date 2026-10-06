'use strict';
// Número internacional, solo dígitos. Vacío: entrega de solicitudes en conserjería.
window.IDENTIFICACION_CONFIG = { whatsapp: '56935926232' };

// Los códigos son permanentes: no renumerar al retirar una bicicleta.
// Estados admitidos: pendiente, revision, registrada. Nunca incluir datos personales aquí.
window.BICICLETAS_POR_IDENTIFICAR = [
  { id: 'SR-001', titulo: 'SILVERBACK SPLASH MORADA', marca: '', color: 'Morado / fucsia', descripcion: 'Bicicleta de montaña con silla infantil trasera gris y amarilla.', fotos: ['./images_sreg/1_sreg.jpeg'], estado: 'pendiente' },
  { id: 'SR-002', titulo: 'TREK MARLIN ROJA', marca: 'Trek', color: 'Rojo', descripcion: 'Bicicleta de montaña con portaequipaje trasero negro y letras blancas.', fotos: ['./images_sreg/2_sreg.jpeg'], estado: 'pendiente' },
  { id: 'SR-003', titulo: 'SUBROSA BALANCE BMX ', marca: '', color: 'Verde', descripcion: 'Bicicleta tipo BMX con manubrio alto negro y ruedas pequeñas.', fotos: ['./images_sreg/3_sreg.jpeg'], estado: 'pendiente' },
  { id: 'SR-004', titulo: 'URBANA VERDE MENTA', marca: '', color: 'Verde menta', descripcion: 'Bicicleta de paseo con canasto delantero, guardabarros claros y parrilla trasera.', fotos: ['./images_sreg/4_sreg.jpeg'], estado: 'pendiente' },
  { id: 'SR-005', titulo: 'TRINX MONTAÑERA', marca: 'Trinx', color: 'Gris / amarillo', descripcion: 'Bicicleta de montaña con detalles amarillo fluorescente y portabotella.', fotos: ['./images_sreg/5_sreg.jpeg'], estado: 'pendiente' },
  { id: 'SR-006', titulo: 'JEEP VESUBIO', marca: 'Jeep', color: 'Gris / rojo / blanco', descripcion: 'Bicicleta de montaña con horquilla y sillín blancos, y detalles rojos.', fotos: ['./images_sreg/6_sreg.jpeg'], estado: 'pendiente' },
  { id: 'SR-007', titulo: 'NORCO MOUNTAINEER', marca: '', color: 'Negro / amarillo', descripcion: 'Bicicleta de montaña con sillín amarillo y negro y suspensión delantera.', fotos: ['./images_sreg/7_sreg.jpeg'], estado: 'pendiente' },
  { id: 'SR-008', titulo: 'BENOTTO WOLF', marca: '', color: 'Gris / naranjo', descripcion: 'Bicicleta de montaña con detalles naranjos en las ruedas y el sillín.', fotos: ['./images_sreg/8_sreg.jpeg'], estado: 'pendiente' }
];

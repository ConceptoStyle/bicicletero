'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-CL').trim();
  const labels = { pendiente: 'Por identificar', revision: 'Solicitud en revisión', registrada: 'Registrada' };
  const safePhoto = path => /^\.\/images_sreg\/[a-z0-9_-]+\.(jpe?g|png|webp)$/i.test(path);
  const seen = new Set();
  const source = window.BICICLETAS_POR_IDENTIFICAR;
  const bikes = (Array.isArray(source) ? source : []).filter(bike => {
    if (!bike || !/^SR-\d{3,}$/.test(bike.id) || seen.has(bike.id) || !Object.hasOwn(labels, bike.estado)) return false;
    seen.add(bike.id);
    return true;
  }).map(bike => ({ ...bike, fotos: (Array.isArray(bike.fotos) ? bike.fotos : []).filter(safePhoto) }));
  const phone = String(window.IDENTIFICACION_CONFIG?.whatsapp ?? '').trim();
  const hasWhatsApp = /^[1-9]\d{7,14}$/.test(phone);
  let selectedBike = null;
  let viewerBike = null;
  let photoIndex = 0;

  function render() {
    const query = normalize($('bikeSearch').value);
    const status = $('bikeStatus').value;
    const rows = bikes.filter(bike => (!status || bike.estado === status) && (!query || normalize([bike.id, bike.titulo, bike.marca, bike.color, bike.descripcion].join(' ')).includes(query)));
    $('pendingCount').textContent = bikes.filter(bike => bike.estado !== 'registrada').length;
    $('gallerySummary').textContent = `${rows.length} de ${bikes.length} bicicletas`;
    $('resetGallery').disabled = !query && !status;
    $('galeria').setAttribute('aria-busy', 'false');
    $('galeria').innerHTML = rows.length ? rows.map(bike => `
      <article class="card" id="${escapeHtml(bike.id)}">
        <div class="media">${bike.fotos.length ? `<button class="image-button" type="button" data-photo="${escapeHtml(bike.id)}" aria-label="Ampliar fotografía de ${escapeHtml(bike.id)}"><img class="bike-photo" src="${escapeHtml(bike.fotos[0])}" alt="${escapeHtml(bike.titulo)} · ${escapeHtml(bike.id)}" loading="lazy" width="1600" height="900"><span class="zoom-hint">Ampliar${bike.fotos.length > 1 ? ` · ${bike.fotos.length} fotos` : ''}</span><span class="fallback" hidden>No se pudo cargar la fotografía. Consulta en conserjería con el código ${escapeHtml(bike.id)}.</span></button>` : '<p class="fallback">Fotografía no disponible</p>'}</div>
        <div class="card-body"><div class="card-top"><span class="bike-code">${escapeHtml(bike.id)}</span><span class="bike-state ${bike.estado}">${labels[bike.estado]}</span></div>
        <h2 class="bike-title">${escapeHtml(bike.titulo)}</h2><p class="bike-description">${escapeHtml(bike.descripcion)}</p>
        <button class="button primary-button bike-claim" type="button" data-claim="${escapeHtml(bike.id)}" ${bike.estado === 'registrada' ? 'disabled' : ''}>${bike.estado === 'registrada' ? 'Registro completado' : 'Esta bicicleta es mía'}</button>
        <p class="bike-caption">${bike.estado === 'registrada' ? 'Identificación completada por administración.' : bike.estado === 'revision' ? 'Administración está revisando los antecedentes. Si es tuya, puedes contactarnos.' : 'Para identificarla en conserjería, indica su código.'}</p></div>
      </article>`).join('') : '<div class="state"><strong>No encontramos bicicletas</strong>Prueba con otro color o código, o limpia los filtros.</div>';
  }

  function showPhoto() {
    $('fullPhoto').src = viewerBike.fotos[photoIndex];
    $('fullPhoto').alt = `${viewerBike.titulo} · ${viewerBike.id}`;
    $('fullPhoto').hidden = false;
    $('photoCaption').textContent = `${viewerBike.id} · ${viewerBike.titulo}`;
    $('photoPosition').textContent = `${photoIndex + 1} / ${viewerBike.fotos.length}`;
    $('photoNavigation').hidden = viewerBike.fotos.length < 2;
    $('previousPhoto').disabled = photoIndex === 0;
    $('nextPhoto').disabled = photoIndex === viewerBike.fotos.length - 1;
  }

  function clearPreparedMessage() {
    $('claimResult').hidden = true;
    $('claimMessage').value = '';
    $('claimFeedback').textContent = '';
    $('whatsappClaim').removeAttribute('href');
    $('whatsappClaim').hidden = true;
  }

  function openClaim(bike) {
    if (bike.estado === 'registrada') return;
    selectedBike = bike;
    $('claimForm').reset();
    clearPreparedMessage();
    $('claimTitle').textContent = `Esta bicicleta es mía · ${bike.id}`;
    $('claimIntro').textContent = `${bike.titulo}. Completa tus datos para preparar una solicitud de identificación.`;
    $('claimDialog').showModal();
    $('claimName').focus();
  }

  async function copyText(field, feedback, success) {
    try {
      await navigator.clipboard.writeText(field.value);
      feedback.textContent = success;
    } catch {
      field.focus();
      field.select();
      feedback.textContent = 'Seleccionamos el texto. Mantén presionado y elige Copiar, o usa Ctrl+C.';
    }
  }

  $('galeria').addEventListener('click', event => {
    const photo = event.target.closest('[data-photo]');
    const claim = event.target.closest('[data-claim]');
    if (photo && !photo.disabled) {
      viewerBike = bikes.find(bike => bike.id === photo.dataset.photo);
      if (!viewerBike?.fotos.length) return;
      photoIndex = 0;
      showPhoto();
      $('photoViewer').showModal();
    } else if (claim && !claim.disabled) {
      const bike = bikes.find(item => item.id === claim.dataset.claim);
      if (bike) openClaim(bike);
    }
  });
  $('galeria').addEventListener('error', event => {
    if (!event.target.matches('img.bike-photo')) return;
    const button = event.target.closest('button');
    event.target.hidden = true;
    button.disabled = true;
    button.querySelector('.zoom-hint').hidden = true;
    button.querySelector('.fallback').hidden = false;
  }, true);
  $('fullPhoto').addEventListener('error', () => {
    if (!viewerBike) return;
    $('fullPhoto').hidden = true;
    $('photoCaption').textContent = `${viewerBike.id} · No se pudo cargar la fotografía. Consulta en conserjería.`;
  });
  $('previousPhoto').addEventListener('click', () => { if (photoIndex > 0) { photoIndex--; showPhoto(); } });
  $('nextPhoto').addEventListener('click', () => { if (photoIndex < viewerBike.fotos.length - 1) { photoIndex++; showPhoto(); } });
  $('closePhoto').addEventListener('click', () => $('photoViewer').close());
  $('photoViewer').addEventListener('close', () => { $('fullPhoto').removeAttribute('src'); viewerBike = null; });
  $('closeClaim').addEventListener('click', () => $('claimDialog').close());
  $('claimDialog').addEventListener('close', () => { $('claimForm').reset(); clearPreparedMessage(); selectedBike = null; });
  $('claimForm').addEventListener('input', event => { event.target.setCustomValidity?.(''); clearPreparedMessage(); });
  $('claimForm').addEventListener('submit', event => {
    event.preventDefault();
    if (!selectedBike) return;
    for (const id of ['claimName', 'claimApartment', 'claimContact', 'claimEvidence']) {
      const field = $(id);
      field.value = field.value.trim();
      field.setCustomValidity(field.value ? '' : 'Completa este campo.');
    }
    $('claimEvidence').setCustomValidity($('claimEvidence').value.length >= 10 ? '' : 'Describe tus antecedentes en al menos 10 caracteres.');
    if (!$('claimForm').reportValidity()) return;
    const message = [
      'Hola, conserjería de Concepto Style Ñuñoa.',
      `Quisiera solicitar la identificación y el registro de la bicicleta ${selectedBike.id} (${selectedBike.titulo}).`,
      '', `Nombre: ${$('claimName').value}`, `Departamento: ${$('claimApartment').value}`,
      `Contacto: ${$('claimContact').value}`, `Antecedentes de propiedad: ${$('claimEvidence').value}`,
      '', 'Entiendo que administración debe verificar la propiedad antes de completar el registro.'
    ].join('\n');
    $('claimMessage').value = message;
    $('claimResult').hidden = false;
    $('whatsappClaim').hidden = !hasWhatsApp;
    if (hasWhatsApp) $('whatsappClaim').href = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    $('deliveryHelp').textContent = hasWhatsApp ? 'Abre WhatsApp de administración, revisa el mensaje y presiona Enviar allí. También puedes copiarlo o mostrarlo en conserjería.' : 'Copia el mensaje y entrégalo a administración por su canal habitual, o muéstralo en conserjería.';
    $('resultTitle').focus();
  });
  $('copyClaim').addEventListener('click', () => copyText($('claimMessage'), $('claimFeedback'), 'Solicitud copiada. Entrégala a administración para iniciar la revisión.'));
  $('bikeSearch').addEventListener('input', render);
  $('bikeStatus').addEventListener('change', render);
  $('resetGallery').addEventListener('click', () => { $('bikeSearch').value = ''; $('bikeStatus').value = ''; render(); $('bikeSearch').focus(); });
  $('shareGallery').addEventListener('click', () => {
    const url = new URL(location.href);
    const hosted = ['https:', 'http:'].includes(url.protocol) && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    url.hash = ''; url.search = '';
    $('galleryLink').value = hosted ? url.href : '';
    $('galleryLink').hidden = !hosted;
    document.querySelector('label[for="galleryLink"]').hidden = !hosted;
    $('copyGalleryLink').hidden = !hosted;
    $('shareHelp').textContent = hosted ? 'Comparte este enlace en el canal de residentes. La galería muestra las bicicletas y permite preparar solicitudes para administración.' : 'Esta es una vista local. Para compartir un enlace con residentes, publica la galería en el sitio del edificio. Por ahora puedes imprimir las fotografías para conserjería.';
    $('shareFeedback').textContent = '';
    $('shareDialog').showModal();
  });
  $('copyGalleryLink').addEventListener('click', () => copyText($('galleryLink'), $('shareFeedback'), 'Enlace copiado.'));
  $('closeShare').addEventListener('click', () => $('shareDialog').close());
  $('printGallery').addEventListener('click', async () => {
    const button = $('printGallery');
    button.disabled = true;
    button.textContent = 'Preparando impresión…';
    $('bikeSearch').value = ''; $('bikeStatus').value = ''; render();
    const photos = [...$('galeria').querySelectorAll('img')];
    photos.forEach(photo => { photo.loading = 'eager'; });
    // Esperar las fotos fuera de pantalla antes de abrir la impresión.
    let timer;
    await Promise.race([
      Promise.allSettled(photos.map(photo => photo.decode())),
      new Promise(resolve => { timer = setTimeout(resolve, 8000); })
    ]);
    clearTimeout(timer);
    try { window.print(); } finally { button.disabled = false; button.textContent = 'Imprimir galería'; }
  });
  for (const id of ['photoViewer', 'claimDialog', 'shareDialog']) $(id).addEventListener('click', event => { if (event.target === $(id)) { const rect = $(id).getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) $(id).close(); } });
  if (!Array.isArray(source)) {
    $('galeria').setAttribute('aria-busy', 'false');
    $('gallerySummary').textContent = 'No se pudo cargar la galería.';
    $('galeria').innerHTML = '<div class="state" role="alert"><strong>Fotografías no disponibles</strong>Intenta recargar la página o consulta en conserjería.</div>';
  } else {
    render();
    const target = bikes.find(bike => `#${bike.id}` === location.hash);
    if (target) $(target.id).scrollIntoView();
  }
})();

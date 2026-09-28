'use strict';
const state={data:[],metadata:{},filters:{search:'',zone:'',status:'',sort:'space'}};
const el={
  grid:document.getElementById('listado'),search:document.getElementById('search'),
  zone:document.getElementById('zoneFilter'),status:document.getElementById('statusFilter'),
  sort:document.getElementById('sortBy'),clear:document.getElementById('clearFilters'),
  summary:document.getElementById('resultSummary'),error:document.getElementById('errorNotice'),
  total:document.getElementById('totalCount'),occupied:document.getElementById('occupiedCount'),
  available:document.getElementById('availableCount'),visible:document.getElementById('visibleCount'),
  source:document.getElementById('sourceLabel'),updated:document.getElementById('updatedLabel'),
  viewer:document.getElementById('imageViewer'),viewerImage:document.getElementById('viewerImage'),
  viewerCaption:document.getElementById('viewerCaption'),viewerClose:document.getElementById('viewerClose')
};
function esc(value){
  return String(value??'').replace(/[&<>'\x22]/g,character=>{
    if(character==='&')return '&amp;';if(character==='<')return '&lt;';
    if(character==='>')return '&gt;';if(character==='\x22')return '&quot;';return '&#39;';
  });
}
const normalize=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es-CL').trim();
const compare=(a,b)=>String(a??'').localeCompare(String(b??''),'es-CL',{numeric:true,sensitivity:'base'});
function safeImagePath(value){const path=String(value??'').trim().replace(/\\/g,'/');return /^\.\/images\/[a-z0-9._-]+\.(jpe?g|png|webp|svg)$/i.test(path)?path:''}
function record(item){return{id:String(item.id??'').trim(),zona:String(item.zona??'').trim(),dpto:String(item.dpto??'').trim(),nombre:String(item.nombre??'').trim(),marca:String(item.marca??'').trim(),color:String(item.color??'').trim(),estado:item.estado===true,imagen:String(item.imagen??'').trim(),imageUrl:safeImagePath(item.imageUrl),hasPhoto:item.hasPhoto===true,observacion:String(item.observacion??'').trim()}}
function setMetadata(meta){
  el.source.textContent=`Fuente: ${meta.origen||'BICICLETERO 2026.xlsx'}`;
  const date=new Date(meta.actualizado||'');
  el.updated.textContent=Number.isNaN(date.getTime())?'':`Actualizado: ${new Intl.DateTimeFormat('es-CL',{dateStyle:'medium',timeStyle:'short'}).format(date)}`;
}
function setup(){
  const zones=[...new Set(state.data.map(item=>item.zona).filter(Boolean))].sort(compare);
  el.zone.innerHTML=`<option value=''>Todas las zonas</option>`+zones.map(zone=>`<option value='${esc(zone)}'>${esc(zone)}</option>`).join('');
  const occupied=state.data.filter(item=>item.estado).length;
  el.total.textContent=state.data.length;el.occupied.textContent=occupied;el.available.textContent=state.data.length-occupied;
}
function filtered(){
  const needle=normalize(state.filters.search);
  const rows=state.data.filter(item=>{
    const text=normalize([item.id,item.zona,item.dpto,item.nombre,item.marca,item.color,item.observacion].join(' '));
    return(!needle||text.includes(needle))&&(!state.filters.zone||item.zona===state.filters.zone)&&(!state.filters.status||String(item.estado)===state.filters.status);
  });
  return rows.sort((a,b)=>state.filters.sort==='zone'?(compare(a.zona,b.zona)||compare(a.id,b.id)):state.filters.sort==='resident'?(compare(a.nombre||'ZZZ',b.nombre||'ZZZ')||compare(a.id,b.id)):compare(a.id,b.id));
}
function detail(label,value,empty){return`<div class='detail'><dt>${esc(label)}</dt><dd class='${value?'':'missing'}'>${esc(value||empty)}</dd></div>`}
function media(item){
  const imageUrl=item.imageUrl||'./images/bicicleta-default.svg';
  const imageAlt=item.hasPhoto?`Fotografía del espacio ${item.id}`:`Símbolo de bicicleta para el espacio ${item.id}`;
  const caption=item.hasPhoto?`Espacio N° ${item.id} · ${item.zona}`:`Imagen predeterminada · Espacio N° ${item.id}`;
  return`<div class='media ${item.hasPhoto?'':'default-media'}'><button class='image-button' type='button' data-image='${esc(imageUrl)}' data-alt='${esc(imageAlt)}' data-caption='${esc(caption)}' aria-label='Ver imagen completa del espacio N° ${esc(item.id)}'><img class='bike-photo' src='${esc(imageUrl)}' alt='${esc(imageAlt)}' loading='lazy'><span class='zoom-hint'>Ampliar</span><div class='fallback' hidden><b>▧</b>No se pudo mostrar la imagen.</div></button></div>`;
}
function card(item){
  return`<article class='card ${item.estado?'occupied':'available'}' data-id='${esc(item.id)}'>${media(item)}<div class='card-body'><div class='card-top'><div><span class='space-label'>Espacio</span><h2 class='space-number'>N° ${esc(item.id)}</h2></div><span class='badge ${item.estado?'':'free'}'>${item.estado?`OCUPADO<img class='verified-icon' src='./images/verificado.svg' alt='Verificado' title='Verificado' width='28' height='28'>`:'DISPONIBLE'}</span></div><div class='zone'>⌖ ${esc(item.zona||'Sin ubicación')}</div><dl class='details'>${detail('Departamento',item.dpto,'Sin asignar')}${detail('Residente',item.nombre,'Sin asignar')}${detail('Marca / modelo',item.marca,'No registrada')}${detail('Color',item.color,'No registrado')}</dl>${item.observacion?`<p class='observation'><strong>Observación:</strong> ${esc(item.observacion)}</p>`:''}</div></article>`;
}
function render(){
  const rows=filtered();el.visible.textContent=rows.length;el.grid.setAttribute('aria-busy','false');
  el.clear.disabled=!(state.filters.search||state.filters.zone||state.filters.status||state.filters.sort!=='space');
  el.summary.innerHTML=`<strong>${rows.length}</strong> de ${state.data.length} espacios`;
  el.grid.innerHTML=rows.length?rows.map(card).join(''):`<div class='state'><strong>No encontramos coincidencias</strong>Prueba con otro término o limpia los filtros.</div>`;
}
function sync(){state.filters={search:el.search.value,zone:el.zone.value,status:el.status.value,sort:el.sort.value};render()}
function clear(){el.search.value='';el.zone.value='';el.status.value='';el.sort.value='space';sync();el.search.focus()}
async function load(){
  let payload=window.BICICLETEROS_DATA||null;
  if(location.protocol!=='file:'){try{const response=await fetch('./bicicleteros.json',{cache:'no-store'});if(!response.ok)throw new Error(`HTTP ${response.status}`);payload=await response.json()}catch(error){console.warn('Se usará el respaldo local.',error)}}
  if(!payload)throw new Error('No se encontraron los datos generados desde el Excel.');
  const rows=Array.isArray(payload)?payload:payload.registros;if(!Array.isArray(rows))throw new Error('El archivo de datos no contiene una lista válida.');
  const seen=new Set();state.data=rows.map(record).filter(item=>item.id&&!seen.has(item.id)&&seen.add(item.id));state.metadata=Array.isArray(payload)?{}:payload;
  setMetadata(state.metadata);setup();render();
}
el.search.addEventListener('input',sync);el.zone.addEventListener('change',sync);el.status.addEventListener('change',sync);el.sort.addEventListener('change',sync);el.clear.addEventListener('click',clear);
el.grid.addEventListener('click',event=>{const button=event.target.closest('.image-button');if(!button||button.disabled)return;const imagePath=safeImagePath(button.dataset.image);if(!imagePath)return;el.viewerImage.src=imagePath;el.viewerImage.alt=button.dataset.alt||'Imagen del bicicletero';el.viewerCaption.textContent=button.dataset.caption||'';el.viewer.showModal()});
el.grid.addEventListener('error',event=>{if(!event.target.matches('img.bike-photo'))return;const button=event.target.closest('.image-button');event.target.remove();button.disabled=true;button.removeAttribute('data-image');const fallback=button.querySelector('.fallback');if(fallback)fallback.hidden=false},true);
el.viewerClose.addEventListener('click',()=>el.viewer.close());
el.viewer.addEventListener('click',event=>{if(event.target===el.viewer)el.viewer.close()});
el.viewer.addEventListener('close',()=>{el.viewerImage.removeAttribute('src');el.viewerImage.alt='';el.viewerCaption.textContent=''});
load().catch(error=>{console.error(error);el.grid.setAttribute('aria-busy','false');el.grid.innerHTML='';el.summary.textContent='No fue posible cargar el listado.';el.error.hidden=false;el.error.textContent=`${error.message} Ejecuta convertir-xlsx-a-json.ps1 y vuelve a abrir la página.`});

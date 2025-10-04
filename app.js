
function safeImg(el, src, fallback){
  el.loading='lazy'; el.decoding='async';
  el.src=src;
  el.onerror=()=>{ if(el.dataset.fallback!=='1'){ el.dataset.fallback='1'; el.src=fallback; } };
}


const $ = s => document.querySelector(s)
const $$ = s => Array.from(document.querySelectorAll(s))

const db = { units: [], items: [] }
const state = {
  roster: { name:"", faction:"", pointsLimit:0, modelsLimit:0, units:[], leaderTaken:false, uniqueUnits:new Set(), uniqueItems:new Set() },
  modal: null,
  pickerMode: null,
  pickerForUnitId: null,
  filters: new Set()
}


// === dynamic image mapping (to avoid 404 and support mixed extensions) ===
let ITEMS_MAP={}, UNITS_MAP={};
async function loadImgMaps(){
  try{
    [UNITS_MAP, ITEMS_MAP] = await Promise.all([
      fetch('images/units_map.json').then(r=>r.json()).catch(()=>({})),
      fetch('images/items_map.json').then(r=>r.json()).catch(()=>({}))
    ]);
  }catch(e){ UNITS_MAP={}; ITEMS_MAP={}; }
}

async function loadDB(){
  await loadImgMaps(); const [u,i] = await Promise.all([fetch('db/units.json').then(r=>r.json()), fetch('db/items.json').then(r=>r.json())])
  db.units = u.map(x=>({ ...x, img:(UNITS_MAP[x.id]||`images/units/${x.id}.png`) }))
  db.items = i.map(x=>({ ...x, img:(ITEMS_MAP[x.id]||`images/items/${x.id}.png`) }))
  fillFactionSelect()
  restoreFromStorage()
  renderRoster()
}
function fillFactionSelect(){
  const all = new Set()
  db.units.forEach(u=>u.factions.forEach(f=>all.add(f)))
  const select = $('#factionSelect')
  select.innerHTML = `<option value="">Без ограничений</option>` + Array.from(all).sort().map(f=>`<option value="${f}">${f}</option>`).join('')
  select.addEventListener('change', ()=>{
    state.roster.faction = select.value
    renderRoster()
  })
}
function openModal(title){
  state.modal = $('#modalRoot'); $('#modalTitle').textContent=title; state.modal.classList.remove('hidden'); document.body.classList.add('modal-open')
}
function closeModal(){ if(state.modal){ state.modal.classList.add('hidden'); document.body.classList.remove('modal-open'); $('#pickerList').innerHTML=''; $('#filters').innerHTML=''; state.filters.clear(); } }

function renderRoster(){
  $('#listName').value = state.roster.name
  $('#factionSelect').value = state.roster.faction||""
  $('#pointsLimit').value = state.roster.pointsLimit||""
  $('#modelsLimit').value = state.roster.modelsLimit||""
  const host = $('#roster'); host.innerHTML = ''
  state.roster.units.forEach(u=>{
    const tpl = document.querySelector('#unitCardTmpl').content.cloneNode(true)
    const el=tpl.querySelector('.unit'); el.dataset.uid = u.uid
    const img=tpl.querySelector('.unit-img'); safeImg(img, u.img, 'images/missing-unit.png')
    const name=tpl.querySelector('.name'); const meta=tpl.querySelector('.meta')
    name.textContent = u.name
    const uniq = u.unique ? `<span class="badge">UNIQUE</span>`:""
    const fr = (u.factions||[]).join(', ')
    meta.innerHTML = `${u.cost} caps · ${fr}${uniq}`
    const slots=tpl.querySelector('.slots')
    u.cards.forEach(c=>{
      const chip=renderItemChip(u,c); slots.appendChild(chip)
    })
    tpl.querySelector('.subtotalPoints').textContent = unitPoints(u)
    tpl.querySelector('.itemsCount').textContent = u.cards.length
    tpl.querySelector('[data-act="addItem"]').addEventListener('click',()=>openItemPicker(u.uid))
    tpl.querySelector('[data-act="dup"]').addEventListener('click',()=>duplicateUnit(u.uid))
    tpl.querySelector('[data-act="remove"]').addEventListener('click',()=>removeUnit(u.uid))
    host.appendChild(tpl)
  })
  $('#spent').textContent = calcRosterPoints(); const lim=Number(state.roster.pointsLimit||0); const spent=calcRosterPoints(); $('#spent').parentElement.style.color = (lim>0 && spent>lim)?'#ff7b7b':''
  $('#unitCount').textContent = state.roster.units.length
  persistToStorage()
}
function renderItemChip(u,c){
  const chip = document.querySelector('#itemChipTmpl').content.cloneNode(true)
  chip.querySelector('.icon').src=c.img
  chip.querySelector('.label').textContent=c.name
  chip.querySelector('.price').textContent = `${c.cost} caps`
  chip.querySelector('.remove').addEventListener('click',()=>removeItem(u.uid,c.id))
  return chip
}

function unitPoints(u){ return (u.cost||0) + u.cards.reduce((s,x)=>s + (x.cost||0) + (x.mod? (x.mod.cost||0):0),0) }

function calcRosterPoints(){
  let total = 0
  for(const u of state.roster.units){ total += unitPoints(u) }
  return total
}

function addUnitPick(){
  state.pickerMode='unit'
  openModal('Выбор персонажа')
  const faction = state.roster.faction
  const list = faction ? db.units.filter(x=>x.factions.includes(faction)) : db.units
  addFilters(['Все','Уникальные'])
  renderPickerCards(list.map(u=>({id:u.id,title:u.name, subtitle:`${u.cost} caps · ${(u.factions||[]).join(', ')}`, img:u.img, tag: u.unique?'unique':''})), id=>{
    const u = db.units.find(x=>x.id===id)
    if(!u) return
    if(u.unique){
      if(state.roster.units.some(x=>x.id===u.id)) return alert('Этот уникальный персонаж уже добавлен')
    }
    if(state.roster.modelsLimit>0 && state.roster.units.length+1>state.roster.modelsLimit) return alert('Превышен лимит моделей')
    const uid = `${u.id}-${Math.random().toString(36).slice(2,7)}`
    state.roster.units.push({ uid, id:u.id, name:u.name, factions:u.factions, cost:u.cost, unique:u.unique, prereq:u.prereq, img:u.img, cards:[] })
    renderRoster(); closeModal()
  })
}

function openItemPicker(uid){
  state.pickerMode='item'
  state.pickerForUnitId=uid
  const unit = state.roster.units.find(x=>x.uid===uid)
  if(!unit) return
  openModal(`Добавление карт: ${unit.name}`)
  const k = ['Armor','Power Armor','Weapon','Melee','Pistol','Rifle','Heavy Weapon','Grenade','Mines','Clothes','Gear','Chem','Alcohol','Food','Perks','Leader','Mod','Upgrades','Wasteland Items','Advanced Items','High Tech Items','Usable Items']
  addFilters(k)
  const cards = db.items
  renderPickerCards(cards.map(x=>{
    const type = x.is_mod?'mod': (x.cats.Leader?'leader': (x.cats.Perks?'perk':''))
    return {id:x.id,title:x.name, subtitle:infoLine(x), img:x.img, tag:type}
  }), id=>addItemToUnit(uid,id))
}

function infoLine(x){
  const t=[]
  const w=x.weapon
  if(w.Melee) t.push('Melee')
  if(w.Pistol) t.push('Pistol')
  if(w.Rifle) t.push('Rifle')
  if(w['Heavy Weapon']) t.push('Heavy')
  if(w.Grenade) t.push('Grenade')
  if(w.Mines) t.push('Mines')
  if(x.cats.Armor) t.push('Armor')
  if(x.cats['Power Armor']) t.push('Power Armor')
  if(x.cats.Clothes) t.push('Clothes')
  if(x.cats.Gear) t.push('Gear')
  if(x.cats.Perks) t.push('Perk')
  if(x.cats.Leader) t.push('Leader')
  if(x.is_mod) t.push('Mod')
  const uniq=x.unique? ' · UNIQUE':''
  return `${x.cost} caps · ${t.join(' / ')}${uniq}`
}

function addFilters(arr){
  const host=$('#filters'); host.innerHTML=''
  arr.forEach(n=>{
    const el=document.createElement('button'); el.className='filter'; el.textContent=n; el.dataset.key=n
    if(state.filters.has(n)) el.classList.add('active')
    el.onclick=()=>{ if(state.filters.has(n)) state.filters.delete(n); else{state.filters.clear(); state.filters.add(n)}; applyFilter() }
    host.appendChild(el)
  })
}

function applyFilter(){
  const key = Array.from(state.filters)[0]
  $$('.grid .card').forEach(c=>{
    if(!key || key==='Все'){ c.style.display='' ; return }
    const tag=c.dataset.tag||''
    const title=c.querySelector('.title').textContent.toLowerCase()
    if(key==='Уникальные'){ c.style.display = tag.includes('unique')?'':'none'; return }
    const k=key.toLowerCase()
    c.style.display = title.includes(k) || tag.includes(k)?'':'none'
  })
}

function renderPickerCards(data,onPick){
  const list=$('#pickerList'); list.innerHTML=''
  data.forEach(x=>{
    const card=document.createElement('div'); card.className='card'; card.dataset.id=x.id; card.dataset.tag=x.tag||''
    card.innerHTML = `<img class="thumb" src="${x.img}"><div><div class="title">${x.title}</div><div class="meta">${x.subtitle}</div></div><button class="btn take">Выбрать</button>`
    card.querySelector('.take').onclick=()=>onPick(x.id)
    list.appendChild(card)
  })
  applyFilter()
}

function duplicateUnit(uid){
  const u = state.roster.units.find(x=>x.uid===uid); if(!u) return
  if(u.unique) return alert('Нельзя дублировать уникального персонажа')
  if(state.roster.modelsLimit>0 && state.roster.units.length+1>state.roster.modelsLimit) return alert('Превышен лимит моделей')
  const copy = JSON.parse(JSON.stringify(u)); copy.uid = `${u.id}-${Math.random().toString(36).slice(2,7)}`
  state.roster.units.push(copy); renderRoster()
}

function removeUnit(uid){
  state.roster.units = state.roster.units.filter(x=>x.uid!==uid); renderRoster()
}

function removeItem(uid,itemId){
  const u = state.roster.units.find(x=>x.uid===uid); if(!u) return
  const idx = u.cards.findIndex(x=>x.id===itemId); if(idx>=0){
    const item=u.cards[idx]
    if(item.cats && item.cats.Leader) state.roster.leaderTaken=false
    u.cards.splice(idx,1); renderRoster()
  }
}

function addItemToUnit(uid,itemId){
  const unit = state.roster.units.find(x=>x.uid===uid); if(!unit) return
  const item = db.items.find(x=>x.id===itemId); if(!item) return
  if(item.unique){
    let count = 0
    state.roster.units.forEach(u=>u.cards.forEach(c=>{ if(c.id===item.id) count++ }))
    if(count>0) return alert('Этот уникальный предмет уже есть в расписке')
  }
  if(state.roster.faction && item.faction_limits && Number.isFinite(item.faction_limits[state.roster.faction])){
    const limit=item.faction_limits[state.roster.faction]
    let used=0; state.roster.units.forEach(u=>u.cards.forEach(c=>{ if(c.id===item.id) used++ }))
    if(used+1>limit) return alert(`Лимит по фракции: ${limit} шт.`)
  }
  const need=['Melee','Pistol','Rifle','Heavy Weapon','Grenade','Power Armor','Upgrades']
  for(const flag of need){
    const requires = (item.weapon && item.weapon[flag]) || (item.cats && item.cats[flag])
    if(requires && !(unit.prereq && unit.prereq[flag])) return alert('Персонаж не может использовать этот тип снаряжения')
  }
  if(item.cats && item.cats.Perks){
    const hasPerk = unit.cards.some(c=>c.cats && c.cats.Perks)
    if(hasPerk) return alert('Перку можно взять только 1 раз на персонажа')
  }
  if(item.cats && item.cats.Leader){
    if(state.roster.leaderTaken) return alert('Карта лидера может быть только одна на расписку')
    state.roster.leaderTaken = true
  }
  if(item.is_mod){
    const base = (item.mod_for||'').toLowerCase()
    const host = unit.cards.find(c=>{
      if(c.mod) return false
      if(base==='power armor') return c.cats && c.cats['Power Armor']
      if(['melee','pistol','rifle','heavy weapon','grenade'].includes(base)) return c.weapon && c.weapon[capitalize(base)]
      if(base==='armor') return c.cats && c.cats.Armor
      return false
    })
    if(!host) return alert('Нет подходящей карты для этого мода')
    host.mod = item
  } else {
    unit.cards.push(item)
  }
  renderRoster(); closeModal()
}
function capitalize(s){ return s.charAt(0).toUpperCase()+s.slice(1) }

function persistToStorage(){
  const safe = { ...state.roster, units: state.roster.units.map(u=>({ ...u, cards:u.cards })) }
  localStorage.setItem('roster', JSON.stringify(safe))
}
function restoreFromStorage(){
  try{
    const raw = localStorage.getItem('roster'); if(!raw) return
    const data = JSON.parse(raw)
    state.roster.name = data.name||""
    state.roster.faction = data.faction||""
    state.roster.pointsLimit = data.pointsLimit||0
    state.roster.modelsLimit = data.modelsLimit||0
    state.roster.leaderTaken = data.leaderTaken||false
    state.roster.units = (data.units||[]).map(u=>{
      const ref = db.units.find(x=>x.id===u.id)
      return { uid:u.uid||`${u.id}-${Math.random().toString(36).slice(2,7)}`, id: ref?ref.id:u.id, name: ref?ref.name:u.name, factions: ref?ref.factions:u.factions, cost: ref?ref.cost:u.cost, unique: ref?ref.unique:u.unique, prereq: ref?ref.prereq:u.prereq, img: ref?ref.img:u.img, cards:(u.cards||[]).map(c=> db.items.find(x=>x.id===c.id) || c) }
    })
  }catch(e){}
}

$('#addUnitBtn').addEventListener('click', addUnitPick)
$('#modalClose').addEventListener('click', closeModal)
$('#clearBtn').addEventListener('click', ()=>{ if(confirm('Очистить текущий лист?')){ state.roster={ name:"", faction:"", pointsLimit:0, modelsLimit:0, units:[], leaderTaken:false, uniqueUnits:new Set(), uniqueItems:new Set() }; renderRoster() }})
$('#saveBtn').addEventListener('click', ()=>{
  const blob = new Blob([JSON.stringify(state.roster)], {type:'application/json'})
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download = (state.roster.name||'roster')+'.json'; a.click()
})
$('#loadBtn').addEventListener('click', ()=>$('#loadInput').click())
$('#loadInput').addEventListener('change', e=>{
  const file=e.target.files[0]; if(!file) return
  const fr=new FileReader(); fr.onload=()=>{ try{ const data=JSON.parse(fr.result); localStorage.setItem('roster', JSON.stringify(data)); restoreFromStorage(); renderRoster() }catch(e){ alert('Неверный файл') } }; fr.readAsText(file)
})
$('#listName').addEventListener('input', e=>{ state.roster.name=e.target.value; persistToStorage() })
$('#pointsLimit').addEventListener('change', e=>{ state.roster.pointsLimit = Number(e.target.value||0); persistToStorage() })
$('#modelsLimit').addEventListener('change', e=>{ state.roster.modelsLimit = Number(e.target.value||0); persistToStorage() })

window.addEventListener('keydown', e=>{ if(e.key==='Escape') closeModal() })

loadDB()


// === Build printable sheet with card images ===
// === Build printable rows: unit at left, items/perks at right ===
function buildPrintSheet(){
  const host = document.getElementById('printSheet');
  if (!host) return;
  host.innerHTML = '';

  (state.roster?.units || []).forEach(u => {
    const row = document.createElement('section');
    row.className = 'print-row';

    const unitBox = document.createElement('div');
    unitBox.className = 'print-unit';
    const uImg = new Image();
    uImg.decoding='sync'; uImg.loading='eager'; uImg.src=u.img;
    unitBox.appendChild(uImg);
    row.appendChild(unitBox);

    const grid = document.createElement('div');
    grid.className = 'mini-grid';
    const cards = [ ...(u.cards||[]), ...(u.items||[]), ...(u.perks||[]) ];
    cards.forEach(c=>{
      const cell=document.createElement('div');
      cell.className='print-mini';
      const img=new Image();
      img.decoding='sync'; img.loading='eager'; img.src=c.img;
      cell.appendChild(img);
      grid.appendChild(cell);
    });

    row.appendChild(grid);
    host.appendChild(row);
  });
}


function clearPrintSheet(){
  const host = document.getElementById('printSheet');
  if (host) host.innerHTML = '';
}

document.getElementById('printBtn').addEventListener('click', ()=>{
  buildPrintSheet();
  setTimeout(()=>window.print(), 50);
});
window.addEventListener('afterprint', ()=>{
  const host=document.getElementById('printSheet'); if (host) host.innerHTML='';
});


// === Quick zoom for item/perk thumbs ===
(function(){
  const zoom = document.createElement('div');
  zoom.id='zoomPreview';
  zoom.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.75);display:none;align-items:center;justify-content:center;z-index:9999';
  const pic = new Image();
  pic.style.maxWidth='92vw'; pic.style.maxHeight='92vh'; pic.style.border='8px solid #000'; pic.style.boxShadow='0 10px 30px rgba(0,0,0,.6)';
  zoom.appendChild(pic);
  document.body.appendChild(zoom);
  zoom.addEventListener('click', ()=> zoom.style.display='none');
  document.addEventListener('click', (e)=>{
    if(e.target && e.target.classList && e.target.classList.contains('thumb')){
      pic.src = e.target.src;
      zoom.style.display='flex';
    }
  }, true);
})();

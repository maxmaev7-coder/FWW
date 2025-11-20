
function safeImg(el, src, fallback){
  el.loading='lazy'; el.decoding='async';
  el.src=src;
  el.onerror=()=>{ if(el.dataset.fallback!=='1'){ el.dataset.fallback='1'; el.src=fallback; } };
}

function safeFileName(s) {
  return (s || 'отряд')
    .replace(/[\\\/:*?"<>|]+/g, '_')
    .trim()
    .slice(0, 64);
}

function waitForImageLoad(img, timeoutMs=1500){
  if(!img) return Promise.resolve();
  if(img.complete && img.naturalWidth>0) return Promise.resolve();
  return new Promise(resolve=>{
    let settled=false;
    const cleanup=()=>{
      img.removeEventListener('load', onLoad);
      img.removeEventListener('error', onError);
    };
    const resolveOnce=()=>{
      if(settled) return;
      settled=true;
      cleanup();
      resolve();
    };
    const onLoad=()=>resolveOnce();
    const onError=()=>{
      if(img.dataset && img.dataset.fallback==='1') return;
      resolveOnce();
    };
    img.addEventListener('load', onLoad);
    img.addEventListener('error', onError);
    if(timeoutMs>0){
      setTimeout(resolveOnce, timeoutMs);
    }
  });
}

async function waitForImages(selector = '.card__img', timeout = 15000) {
  const imgs = Array.from(document.querySelectorAll(selector));
  const waitOne = (img) => new Promise(resolve => {
    if (img.complete) return resolve();
    const done = () => { img.onload = img.onerror = null; resolve(); };
    img.onload = done;
    img.onerror = done;
    setTimeout(done, timeout);
  });
  await Promise.all(imgs.map(waitOne));
}

function ensurePortraitImage(img, opts = {}) {
  if (!img) return;

  const apply = () => {
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    if (!w || !h) return;

    const isLandscape = w >= h;
    img.classList.toggle('img--landscape', isLandscape);
    img.classList.toggle('img--portrait', !isLandscape);

    img.removeEventListener('load', apply);
  };

  img.addEventListener('load', apply);
  if (img.complete) apply();
}

function flagCardOrientation(img, cardEl) {
  if (!img || !cardEl) return;

  const apply = () => {
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    if (!w || !h) return;

    const forcePortrait = cardEl.classList.contains('card--power') || cardEl.dataset.cardType === 'power';
    const isLandscape = forcePortrait ? false : w >= h;

    cardEl.classList.toggle('is-landscape', isLandscape);
    cardEl.classList.toggle('is-portrait', !isLandscape);
    cardEl.classList.toggle('is-landscape-card', isLandscape);
    cardEl.classList.toggle('is-portrait-card', !isLandscape);

    img.removeEventListener('load', apply);
  };

  img.addEventListener('load', apply);
  if (img.complete) apply();
}


function openImagePreview(src){
  if(typeof window!=='undefined' && typeof window.__showImagePreview==='function'){
    window.__showImagePreview(src)
  }
}


const $ = s => document.querySelector(s)
const $$ = s => Array.from(document.querySelectorAll(s))

const db = { units: [], items: [], itemMap: new Map(), itemNameMap: new Map(), itemsById: {}, itemsByName: {} }

function createDefaultItemFilter(){
  return { group:null, weapon:null, flags:{ stripes:false, mods:false, chem:false } }
}

function resolveStoredPdfSize(){
  try{
    const saved = localStorage.getItem('pdfCardSize')
    if(saved==='small' || saved==='large') return saved
  }catch(e){}
  return 'large'
}

const state = {
  roster: { name:"", faction:"", pointsLimit:0, modelsLimit:0, units:[], leaderTaken:false },
  modal: null,
  pickerMode: null,
  pickerForUnitId: null,
  unitFilter: 'Все',
  itemFilter: createDefaultItemFilter(),
  availableItems: [],
  modTarget: null,
  pdfCardSize: resolveStoredPdfSize(),
  dragging: null
}

const WEAPON_KEYS = ['Melee','Pistol','Rifle','Heavy Weapon','Grenade','Mines']
const ACCESS_KEYS = ['Upgrades','Wasteland Items','Advanced Items','High Tech Items','Usable Items','Robots Items','Automatron Items','Creature Items','Dog Items','Super Mutant Items','Standart Item','Faction Items']
const CATEGORY_KEYS = ['Chem','Alcohol','Food','Armor','Clothes','Gear','Mod','Perks','Leader','Power Armor','Upgrades','Wasteland Items','Advanced Items','High Tech Items','Usable Items','Robots Items','Automatron Items','Creature Items','Dog Items','Super Mutant Items','Standart Item','Faction Items']
const TAG_LABELS = {
  Melee:'Ближний бой',
  Pistol:'Пистолет',
  Rifle:'Винтовка',
  'Heavy Weapon':'Тяжёлое оружие',
  Grenade:'Граната',
  Mines:'Мины',
  Armor:'Броня',
  'Power Armor':'Силовая броня',
  Clothes:'Одежда',
  Gear:'Снаряжение',
  Chem:'Химия',
  Alcohol:'Алкоголь',
  Food:'Еда',
  Perk:'Перк',
  Leader:'Лидер',
  Mod:'Мод',
  Upgrades:'Улучшения',
  'Wasteland Items':'Пустошь',
  'Advanced Items':'Продв. предметы',
  'High Tech Items':'Хайтек',
  'Usable Items':'Расходники',
  'Robots Items':'Для роботов',
  'Automatron Items':'Автоматрон',
  'Creature Items':'Для существ',
  'Dog Items':'Для псов',
  'Super Mutant Items':'Для супер мутантов',
  'Standart Item':'Стандартные',
  'Faction Items':'Фракционные'
}

const ITEM_GROUPS = [
  { key:'Weapons', label:'Оружие', weapons:WEAPON_KEYS },
  { key:'Armor', label:'Броня' },
  { key:'Power Armor', label:'Силовая броня' },
  { key:'Clothes', label:'Одежда' },
  { key:'Gear', label:'Снаряжение' },
  { key:'Chem', label:'Химия' },
  { key:'Alcohol', label:'Алкоголь' },
  { key:'Food', label:'Еда' },
  { key:'Perks', label:'Перки' },
  { key:'Leader', label:'Лидер' },
  { key:'Upgrades', label:'Улучшения' },
  { key:'Wasteland Items', label:'Пустошь' },
  { key:'Advanced Items', label:'Продв. предметы' },
  { key:'High Tech Items', label:'Хайтек' },
  { key:'Usable Items', label:'Расходники' },
  { key:'Robots Items', label:'Для роботов' },
  { key:'Automatron Items', label:'Автоматрон' },
  { key:'Creature Items', label:'Для существ' },
  { key:'Dog Items', label:'Для псов' },
  { key:'Super Mutant Items', label:'Для супер мутантов' },
  { key:'Standart Item', label:'Стандартные' },
  { key:'Faction Items', label:'Фракционные' }
]

function normalizeNameKey(name){ return typeof name==='string'? name.trim().toLowerCase():'' }

function normalizeLookupKey(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[’'`]/g, '')
    .replace(/\b(perk|card|weapon|outfit|strike|claws?)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function buildNameMap(items) {
  const m = new Map()
  for (const x of items || []) {
    const name = String(x.name || '')
    const keys = [name.toLowerCase(), normalizeLookupKey(name)]
    keys.forEach(k => { if (k) m.set(k, x.id) })

    if (Array.isArray(x.aliases)) {
      x.aliases.forEach(a => {
        const k = normalizeLookupKey(a)
        if (k) m.set(k, x.id)
      })
    }
  }
  return m
}

function resolveItemReference(db, raw) {
  if (!raw) return null
  const s = String(raw).trim()

  if (db.itemsById && db.itemsById[s]) return db.itemsById[s]

  const lower = s.toLowerCase()
  if (db.itemsByName && db.itemsByName[lower]) {
    return db.itemsById[db.itemsByName[lower]]
  }

  if (!db._nameMap) db._nameMap = buildNameMap(db.items || [])
  const id = db._nameMap.get(normalizeLookupKey(s))
  return id ? db.itemsById[id] : null
}

function normalizeEquippedEntries(source){
  const result=[]
  const visit=value=>{
    if(value===null || value===undefined) return
    if(Array.isArray(value)){ value.forEach(visit); return }
    if(typeof value==='number') return visit(String(value))
    if(typeof value==='string'){
      const trimmed=value.trim()
      if(trimmed) result.push(trimmed)
      return
    }
    if(typeof value==='object'){
      const idKeys=['itemId','id','code','key','uid','cardId']
      const nameKeys=['name','item','label','title','card','cardName']
      let id=null
      let name=null
      idKeys.forEach(k=>{ if(!id && typeof value[k]==='string'){ const v=value[k].trim(); if(v) id=v } })
      nameKeys.forEach(k=>{ if(!name && typeof value[k]==='string'){ const v=value[k].trim(); if(v) name=v } })
      if(!name){
        Object.values(value).forEach(val=>{
          if(!name && typeof val==='string'){
            const trimmed=val.trim()
            if(trimmed) name=trimmed
          }
        })
      }
      if(id || name){
        const entry={}
        if(id) entry.id=id
        if(name) entry.name=name
        result.push(entry)
      }
      return
    }
  }
  visit(source)
  return result
}

function itemHasWeapon(item, weapon){ return !!(item.weapon && item.weapon[weapon]) }

function itemMatchesGroup(item, groupKey, weaponKey=null){
  if(groupKey==='Weapons'){
    if(weaponKey){ return itemHasWeapon(item, weaponKey) }
    return WEAPON_KEYS.some(k=>itemHasWeapon(item,k))
  }
  const cats = item.cats||{}
  switch(groupKey){
    case 'Armor': return !!cats.Armor
    case 'Power Armor': return !!cats['Power Armor']
    case 'Clothes': return !!cats.Clothes
    case 'Gear': return !!cats.Gear
    case 'Chem': return !!cats.Chem
    case 'Alcohol': return !!cats.Alcohol
    case 'Food': return !!cats.Food
    case 'Perks': return !!cats.Perks
    case 'Leader': return !!cats.Leader
    case 'Upgrades': return !!cats.Upgrades
    case 'Wasteland Items': return !!cats['Wasteland Items']
    case 'Advanced Items': return !!cats['Advanced Items']
    case 'High Tech Items': return !!cats['High Tech Items']
    case 'Usable Items': return !!cats['Usable Items']
    case 'Robots Items': return !!cats['Robots Items']
    case 'Automatron Items': return !!cats['Automatron Items']
    case 'Creature Items': return !!cats['Creature Items']
    case 'Dog Items': return !!cats['Dog Items']
    case 'Super Mutant Items': return !!cats['Super Mutant Items']
    case 'Standart Item': return !!cats['Standart Item']
    case 'Faction Items': return !!cats['Faction Items']
    default: return false
  }
}

function itemHasSpecialBars(item){
  if(!item) return false
  const cats=item.cats||{}
  return !!(cats['Power Armor'] || cats.Chem || cats.Alcohol)
}

function deriveItemGroups(item){
  const groups = new Set()
  ITEM_GROUPS.forEach(group=>{ if(itemMatchesGroup(item, group.key)) groups.add(group.key) })
  return groups
}

function resolveModType(item){
  if(item.cats && item.cats['Power Armor']) return 'Power Armor'
  if(item.cats && item.cats.Armor) return 'Armor'
  if(itemHasWeapon(item,'Melee')) return 'Melee'
  if(itemHasWeapon(item,'Pistol')) return 'Pistol'
  if(itemHasWeapon(item,'Rifle')) return 'Rifle'
  if(itemHasWeapon(item,'Heavy Weapon')) return 'Heavy Weapon'
  if(itemHasWeapon(item,'Grenade')) return 'Grenade'
  if(itemHasWeapon(item,'Mines')) return 'Mines'
  if(item.cats && item.cats['Robots Items']) return 'Robot'
  if(item.cats && (item.cats['Creature Items'] || item.cats['Dog Items'] || item.cats['Super Mutant Items'])) return 'Animal'
  return null
}

function isPowerArmorCard(card) {
  const t = String(card.category || card.type || '').toLowerCase()
  const n = String(card.name || '').toLowerCase()
  return t.includes('power armor') || n.includes('power armor')
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
  db.units = u.map(normalizeUnit)
  db.items = i.map(normalizeItem)
  db.itemsById = {}
  db.items.forEach(item=>{ db.itemsById[item.id]=item })
  db.itemMap = new Map(db.items.map(x=>[x.id,x]))
  db.itemNameMap = new Map(db.items.map(x=>[normalizeNameKey(x.name), x.id]).filter(([key])=>key))
  db.itemsByName = {}
  db.items.forEach(item=>{ const key=normalizeNameKey(item.name); if(key) db.itemsByName[key]=item.id })
  fillFactionSelect()
  restoreFromStorage()
  renderRoster()
}
function normalizeUnit(raw){
  const unit = { ...raw }
  unit.img = UNITS_MAP[unit.id] || `images/units/${unit.id}.png`
  const prereq = { ...(unit.prereq||{}) }
  WEAPON_KEYS.forEach(k=>{ prereq[k] = Boolean(prereq[k]) })
  if(prereq.Upgrades===undefined) prereq.Upgrades = Boolean(prereq.Upgrades)
  unit.prereq = prereq
  const access = { ...(unit.access||{}) }
  ACCESS_KEYS.forEach(k=>{ access[k] = Boolean(access[k]) })
  unit.access = access
  unit.equipped = normalizeEquippedEntries(unit.equipped)
  return unit
}
function normalizeItem(raw){
  const item = { ...raw }
  item.img = ITEMS_MAP[item.id] || `images/items/${item.id}.png`
  item.name = (item.name||'').trim()
  const weapon = {}
  WEAPON_KEYS.forEach(k=>{ weapon[k] = Boolean(raw.weapon && raw.weapon[k]) })
  item.weapon = weapon
  const cats = {}
  CATEGORY_KEYS.forEach(k=>{ cats[k] = Boolean(raw.cats && raw.cats[k]) })
  item.cats = cats
  item.factions = Array.isArray(raw.factions)? raw.factions.slice():[]
  item.groups = deriveItemGroups(item)
  item.modType = resolveModType(item)
  return item
}
function getItem(id){ if(!id) return null; return db.itemsById[id] || db.itemMap.get(id) || null }
function getItemIdByName(name){
  const key=normalizeNameKey(name)
  if(!key) return undefined
  return db.itemsByName[key] || db.itemNameMap.get(key)
}
function createCardEntry(itemId, locked=false){ return { itemId, modId:null, locked:!!locked } }
function getUnitByUid(uid){ return state.roster.units.find(x=>x.uid===uid) }
function getUnitFaction(unit){ return unit.faction || state.roster.faction || unit.factions?.[0] || '' }
function unitHasPowerArmor(unit){
  return unit.cards.some(card=>{
    const item=getItem(card.itemId)
    return item && item.cats['Power Armor']
  })
}
function unitHasCategory(unit, key){
  return unit.cards.some(card=>{
    const item=getItem(card.itemId)
    if(!item) return false
    if(key==='Armor') return !!item.cats.Armor
    if(key==='Clothes') return !!item.cats.Clothes
    return !!item.cats[key]
  })
}
function unitHasPerk(unit){
  return unit.cards.some(card=>{ const item=getItem(card.itemId); return item && item.cats.Perks })
}
function unitHasLeader(unit){
  return unit.cards.some(card=>{ const item=getItem(card.itemId); return item && item.cats.Leader })
}
function rosterItemCount(itemId){
  let total=0
  state.roster.units.forEach(u=>{
    u.cards.forEach(card=>{ if(card.itemId===itemId) total+=1 })
    u.cards.forEach(card=>{ if(card.modId===itemId) total+=1 })
  })
  return total
}
function recomputeLeaderFlag(){
  state.roster.leaderTaken = state.roster.units.some(u=>u.cards.some(card=>{
    const base=getItem(card.itemId)
    return base && base.cats && base.cats.Leader
  }))
}
function fillFactionSelect(){
  const all = new Set()
  db.units.forEach(u=>u.factions.forEach(f=>all.add(f)))
  const select = $('#factionSelect')
  select.innerHTML = ''
  const defaultOption = document.createElement('option')
  defaultOption.value = ''
  defaultOption.textContent = 'Без ограничений'
  select.appendChild(defaultOption)
  Array.from(all).sort().forEach(faction=>{
    const option = document.createElement('option')
    option.value = faction
    option.textContent = faction
    select.appendChild(option)
  })
  select.addEventListener('change', ()=>{
    state.roster.faction = select.value
    renderRoster()
  })
}
function openModal(title){
  state.modal = $('#modalRoot'); $('#modalTitle').textContent=title; state.modal.classList.remove('hidden'); document.body.classList.add('modal-open')
}
function closeModal(){
  if(state.modal){
    state.modal.classList.add('hidden')
    document.body.classList.remove('modal-open')
    $('#pickerList').innerHTML=''
    $('#filters').innerHTML=''
    state.availableItems=[]
    state.itemFilter=createDefaultItemFilter()
    state.unitFilter='Все'
    state.modTarget=null
  }
}

function renderRoster(){
  $('#listName').value = state.roster.name
  $('#factionSelect').value = state.roster.faction||""
  $('#pointsLimit').value = state.roster.pointsLimit||""
  $('#modelsLimit').value = state.roster.modelsLimit||""
  $('#factionSelect').disabled = state.roster.units.length>0
  const host = $('#roster'); host.innerHTML = ''
  state.roster.units.forEach(unit=>{
    host.appendChild(buildRosterUnit(unit))
  })
  const spent = calcRosterPoints()
  $('#spent').textContent = spent
  const lim=Number(state.roster.pointsLimit||0)
  $('#spent').parentElement.style.color = (lim>0 && spent>lim)?'#ff7b7b':''
  $('#unitCount').textContent = state.roster.units.length
  persistToStorage()
}

function buildRosterUnit(unit){
  const tpl=document.querySelector('#rosterUnitTemplate').content.cloneNode(true)
  const root=tpl.querySelector('.roster-unit')
  root.dataset.uid=unit.uid
  const img=tpl.querySelector('.roster-unit__image')
  safeImg(img, unit.img, 'images/missing-unit.png')
  ensurePortraitImage(img, { preferPortrait:true })
  const nameEl=tpl.querySelector('.roster-unit__name')
  const costEl=tpl.querySelector('.roster-unit__cost')
  nameEl.textContent=unit.name
  costEl.textContent=`${unit.cost} очков`
  if(unit.unique){
    const sep=document.createTextNode(' · ')
    const badge=document.createElement('span')
    badge.className='badge'
    badge.textContent='УНИКАЛЬНО'
    costEl.appendChild(sep)
    costEl.appendChild(badge)
  }
  tpl.querySelector('[data-act="addItem"]').addEventListener('click',()=>openItemPicker(unit.uid))
  tpl.querySelector('[data-act="dup"]').addEventListener('click',()=>duplicateUnit(unit.uid))
  tpl.querySelector('[data-act="remove"]').addEventListener('click',()=>removeUnit(unit.uid))
  const grid = tpl.querySelector('.roster-unit__grid')
  const unitCard = createRosterUnitCard(unit)
  grid.appendChild(unitCard)

  // Отрисовываем карты ровно в том порядке, в котором они лежат в unit.cards
  unit.cards.forEach((cardData, index) => {
    const item = getItem(cardData.itemId)
    // Определяем, является ли карта силовой броней — чтобы передать флаг isPower
    const isPower = !!(item && item.cats && item.cats['Power Armor'])
    const cardEl = createRosterItemCard(unit, cardData, index, item, isPower)
    if (cardEl) grid.appendChild(cardEl)
  })

  grid.addEventListener('dragover', e => handleGridDragOver(e, unit.uid))
  grid.addEventListener('drop', e => handleGridDrop(e, unit.uid))
  tpl.querySelector('.subtotalPoints').textContent = unitPoints(unit)
  tpl.querySelector('.itemsCount').textContent = unitItemCount(unit)
  return root
}

function deriveRosterCardOrder(unit){
  const entries=[]
  unit.cards.forEach((card,index)=>{
    const item=getItem(card.itemId)
    if(item) entries.push({ card,index,item })
  })
  let power=null
  const others=[]
  entries.forEach(entry=>{
    if(entry.item.cats && entry.item.cats['Power Armor'] && !power){
      power=entry
    }else{
      others.push(entry)
    }
  })
  return { power, others }
}

function createRosterCardShell(type,{ includeMods=false }={}){
  const card=document.createElement('article')
  card.className='roster-card'
  if(type) card.classList.add(`roster-card--${type}`)
  switch(type){
    case 'unit':
      card.classList.add('card--unit');
      card.dataset.cardType='unit'
      break
    case 'power':
      card.classList.add('card--power');
      card.dataset.cardType='power'
      break
    case 'perk':
      card.classList.add('card--perk');
      card.dataset.cardType='perk'
      break
    case 'mod':
      card.classList.add('card--mod');
      card.dataset.cardType='mod'
      break
    default:
      card.classList.add('card--item');
      card.dataset.cardType='item'
      break
  }
  const thumb=document.createElement('div')
  thumb.classList.add('roster-card__image-thumb','card__thumb')
  const img=document.createElement('img')
  img.className='roster-card__image thumb card__img'
  thumb.appendChild(img)
  card.appendChild(thumb)
  const body=document.createElement('div')
  body.className='roster-card__body'
  body.classList.add('card__body')
  card.appendChild(body)
  const title=document.createElement('div')
  title.className='roster-card__title'
  body.appendChild(title)
  const meta=document.createElement('div')
  meta.className='roster-card__meta'
  body.appendChild(meta)
  const badges=document.createElement('div')
  badges.className='roster-card__badges'
  body.appendChild(badges)
  const actions=document.createElement('div')
  actions.className='roster-card__actions'
  actions.classList.add('card__actions')
  card.appendChild(actions)
  let mods=null
  if(includeMods){
    mods=document.createElement('div')
    mods.className='roster-card__mods'
    card.appendChild(mods)
  }
  return { card,img,title,meta,badges,actions,mods }
}

function createBadge(text){
  const span=document.createElement('span')
  span.className='roster-card__badge'
  span.textContent=text
  return span
}

function createRosterUnitCard(unit){
  const { card,img,title,meta,badges,actions } = createRosterCardShell('unit')
  safeImg(img, unit.img, 'images/missing-unit.png')
  ensurePortraitImage(img, { preferPortrait:true })
  flagCardOrientation(img, card)
  title.textContent = unit.name
  meta.textContent = `${unit.cost} очков`
  if(unit.unique) badges.appendChild(createBadge('УНИКАЛЬНО'))
  if(!actions.children.length) actions.remove()
  return card
}

function createRosterItemCard(unit, cardData, index, item, isPower){
  if(!item) return null
  const cardType=isPower?'power':(item.cats?.Perks ? 'perk' : 'item')
  const { card,img,title,meta,badges,actions,mods } = createRosterCardShell(cardType,{ includeMods:true })
  card.classList.add('roster-card--item')
  card.dataset.unitUid = unit.uid
  card.dataset.cardIndex = String(index)
  safeImg(img, item.img, 'images/missing-item.png')
  ensurePortraitImage(img, { preferPortrait: itemHasSpecialBars(item) })
  flagCardOrientation(img, card)
  title.textContent = item.name
  meta.textContent = infoLine(item)
  if(item.unique) badges.appendChild(createBadge('УНИКАЛЬНО'))
  const duplicates = unit.cards.filter(c=>c.itemId===item.id).length
  if(duplicates>1) badges.appendChild(createBadge(`x${duplicates}`))
  if(cardData.locked) badges.appendChild(createBadge('ЗАБЛОКИРОВАНО'))
  if(itemHasSpecialBars(item)) badges.appendChild(createBadge('S.P.E.C.I.A.L.'))
  if(canAddMod(unit, cardData, item)){
    const modBtn=document.createElement('button')
    modBtn.className='btn tiny'
    modBtn.textContent = cardData.modId ? 'Изменить мод' : 'Добавить мод'
    modBtn.addEventListener('click', e=>{ e.stopPropagation(); openModPicker(unit.uid,index) })
    actions.appendChild(modBtn)
  }
  const removeBtn=document.createElement('button')
  removeBtn.className='btn tiny danger'
  removeBtn.textContent='Удалить'
  if(cardData.locked){
    removeBtn.disabled=true
    removeBtn.title='Встроенная карта'
  }else{
    removeBtn.addEventListener('click', e=>{ e.stopPropagation(); removeItem(unit.uid,index) })
  }
  actions.appendChild(removeBtn)
  if(!actions.children.length) actions.classList.add('hidden')
  if(cardData.modId){
    const modItem=getItem(cardData.modId)
    if(modItem && mods){
      mods.appendChild(buildModCard(unit, index, modItem))
    }
  }else if(mods && canAddMod(unit, cardData, item)){
    const empty=document.createElement('div')
    empty.className='roster-card__empty-mod'
    empty.textContent='Модификации не выбраны'
    mods.appendChild(empty)
  }
  if(mods && !mods.children.length){
    mods.remove()
  }
  if(!isPower){
    card.draggable=true
    card.addEventListener('dragstart', handleCardDragStart)
    card.addEventListener('dragenter', handleCardDragEnter)
    card.addEventListener('dragleave', handleCardDragLeave)
    card.addEventListener('dragover', handleCardDragOver)
    card.addEventListener('drop', handleCardDrop)
    card.addEventListener('dragend', handleCardDragEnd)
    const handle=document.createElement('div')
    handle.className='roster-card__drag-handle'
    handle.textContent='⠿'
    card.appendChild(handle)
  }
  return card
}

function buildModCard(unit, cardIndex, modItem){
  const wrap=document.createElement('div')
  wrap.className='roster-card__mod-card'
  wrap.classList.add('mod-card','card--mod')
  wrap.dataset.cardType='mod'
  const content=document.createElement('div')
  content.className='mod-card__content'

  const media=document.createElement('div')
  media.classList.add('mod-card__media')
  const img=document.createElement('img')
  img.className='roster-card__mod-image card__img'
  safeImg(img, modItem.img, 'images/missing-item.png')
  ensurePortraitImage(img, { preferPortrait: itemHasSpecialBars(modItem) })
  flagCardOrientation(img, wrap)
  media.appendChild(img)
  content.appendChild(media)

  const body=document.createElement('div')
  body.classList.add('card__body','mod-card__body')
  const title=document.createElement('div')
  title.className='roster-card__mod-title'
  title.textContent=modItem.name
  body.appendChild(title)
  const meta=document.createElement('div')
  meta.className='roster-card__mod-meta'
  meta.textContent=infoLine(modItem)
  body.appendChild(meta)
  content.appendChild(body)
  wrap.appendChild(content)

  const actions=document.createElement('div')
  actions.className='mod-actions mod-card__actions'
  actions.classList.add('card__actions')
  const change=document.createElement('button')
  change.className='btn'
  change.textContent='Сменить мод'
  change.addEventListener('click', e=>{ e.stopPropagation(); openModPicker(unit.uid, cardIndex) })
  actions.appendChild(change)
  const remove=document.createElement('button')
  remove.className='btn danger'
  remove.textContent='Удалить'
  remove.addEventListener('click', e=>{ e.stopPropagation(); removeMod(unit.uid, cardIndex) })
  actions.appendChild(remove)
  wrap.appendChild(actions)
  return wrap
}

function handleCardDragStart(e){
  const card=e.currentTarget
  if(e.target && e.target.closest('button')){ e.preventDefault(); return }
  const unitUid=card.dataset.unitUid
  const cardIndex=Number(card.dataset.cardIndex)
  state.dragging={ unitUid, cardIndex }
  if(e.dataTransfer){
    e.dataTransfer.effectAllowed='move'
    try{ e.dataTransfer.setData('text/plain','drag') }catch(err){}
  }
  card.classList.add('roster-card--drag')
}

function handleCardDragEnter(e){
  const card=e.currentTarget
  if(!state.dragging) return
  if(card.dataset.unitUid!==state.dragging.unitUid) return
  const targetIndex=Number(card.dataset.cardIndex)
  if(targetIndex===state.dragging.cardIndex) return
  card.classList.add('roster-card--drop')
}

function handleCardDragLeave(e){
  e.currentTarget.classList.remove('roster-card--drop')
}

function handleCardDragOver(e){
  const card=e.currentTarget
  if(!state.dragging) return
  if(card.dataset.unitUid!==state.dragging.unitUid) return
  e.preventDefault()
  if(e.dataTransfer) e.dataTransfer.dropEffect='move'
}

function handleCardDrop(e){
  const card=e.currentTarget
  if(!state.dragging) return
  const unitUid=card.dataset.unitUid
  const targetIndex=Number(card.dataset.cardIndex)
  if(state.dragging.unitUid!==unitUid) return
  if(targetIndex===state.dragging.cardIndex) return
  e.preventDefault()
  card.classList.remove('roster-card--drop')
  reorderUnitCard(unitUid, state.dragging.cardIndex, targetIndex)
}

function handleCardDragEnd(e){
  e.currentTarget.classList.remove('roster-card--drag')
  clearDropHighlights()
  state.dragging=null
}

function handleGridDragOver(e, unitUid){
  if(!state.dragging || state.dragging.unitUid!==unitUid) return
  if(e.target && e.target.closest('.roster-card')) return
  e.preventDefault()
  if(e.dataTransfer) e.dataTransfer.dropEffect='move'
}

function handleGridDrop(e, unitUid){
  if(!state.dragging || state.dragging.unitUid!==unitUid) return
  if(e.target && e.target.closest('.roster-card')) return
  e.preventDefault()
  reorderUnitCard(unitUid, state.dragging.cardIndex, null)
}

function clearDropHighlights(){
  $$('.roster-card--drop').forEach(el=>el.classList.remove('roster-card--drop'))
}

function reorderUnitCard(unitUid, fromIndex, toIndex){
  const unit=getUnitByUid(unitUid)
  if(!unit) return
  const cards=unit.cards
  if(fromIndex<0 || fromIndex>=cards.length) return
  const [entry]=cards.splice(fromIndex,1)
  if(toIndex===null || toIndex>=cards.length){
    cards.push(entry)
  }else{
    let insertIndex=toIndex
    if(fromIndex<toIndex) insertIndex-=1
    if(insertIndex<0) insertIndex=0
    cards.splice(insertIndex,0,entry)
  }
  state.dragging=null
  renderRoster()
}

function unitPoints(u){
  let total = u.cost||0
  u.cards.forEach(card=>{
    const base=getItem(card.itemId)
    if(base) total += base.cost||0
    if(card.modId){
      const mod=getItem(card.modId)
      if(mod) total += mod.cost||0
    }
  })
  return total
}
function unitItemCount(u){
  let count=0
  u.cards.forEach(card=>{
    count+=1
    if(card.modId) count+=1
  })
  return count
}

function calcRosterPoints(){
  let total = 0
  for(const u of state.roster.units){ total += unitPoints(u) }
  return total
}

function addUnitPick(){
  state.pickerMode='unit'
  state.unitFilter='Все'
  openModal('Выбор персонажа')
  renderUnitFilters()
  renderUnitPicker()
}
function getUnitsForPicker(){
  const faction = state.roster.faction
  let list = faction ? db.units.filter(x=>x.factions.includes(faction)) : db.units
  if(state.unitFilter==='Уникальные') list = list.filter(x=>x.unique)
  return list
}
function renderUnitFilters(){
  const host=$('#filters'); host.innerHTML=''
  ;['Все','Уникальные'].forEach(label=>{
    const btn=document.createElement('button'); btn.className='filter'; btn.textContent=label
    if(state.unitFilter===label) btn.classList.add('active')
    btn.onclick=()=>{ state.unitFilter=label; renderUnitFilters(); renderUnitPicker() }
    host.appendChild(btn)
  })
}
function renderUnitPicker(){
  const list=$('#pickerList'); list.innerHTML=''; list.classList.add('picker-units'); list.classList.remove('picker-items','picker-mods')
  const units = getUnitsForPicker().slice().sort((a,b)=>{
    if(a.cost!==b.cost) return a.cost-b.cost
    return a.name.localeCompare(b.name,'ru')
  })
  units.forEach(u=>{
    const card=document.createElement('div'); card.className='card card-unit'; card.dataset.id=u.id
    card.classList.add('card--picker','card--unit')
    card.dataset.cardType='unit'
    if(u.unique) card.dataset.tag='unique'
    const thumb=document.createElement('div')
    thumb.classList.add('card__thumb')
    const img=document.createElement('img'); img.className='thumb thumb-large card__img'; safeImg(img, u.img, 'images/missing-unit.png'); ensurePortraitImage(img, { preferPortrait:true }); flagCardOrientation(img, card)
    thumb.appendChild(img)
    card.appendChild(thumb)
    const body=document.createElement('div'); body.className='card-body'; body.classList.add('card__body')
    const title=document.createElement('div'); title.className='title'; title.textContent=u.name
    const meta=document.createElement('div'); meta.className='meta'
    meta.textContent = `${u.cost} очков`
    if(u.unique){
      const sep=document.createTextNode(' · ')
      const badge=document.createElement('span')
      badge.className='badge'
      badge.textContent='УНИКАЛЬНО'
      meta.appendChild(sep)
      meta.appendChild(badge)
    }
    const actions=document.createElement('div'); actions.className='actions'; actions.classList.add('card__actions')
    const activate=()=>pickUnit(u.id)
    const add=document.createElement('button'); add.className='btn tiny'; add.textContent='Добавить'
    add.addEventListener('click', e=>{ e.stopPropagation(); activate() })
    actions.appendChild(add)
    body.appendChild(title); body.appendChild(meta)
    card.appendChild(body); card.appendChild(actions)
    card.addEventListener('click', e=>{ if(e.target.closest('button')) return; activate() })
    card.tabIndex=0
    card.addEventListener('keydown', e=>{ if(e.key==='Enter' || e.key===' '){ e.preventDefault(); activate() } })
    list.appendChild(card)
  })
}
function pickUnit(id){
  const u = db.units.find(x=>x.id===id)
  if(!u) return
  if(u.unique && state.roster.units.some(x=>x.id===u.id)) return alert('Этот уникальный персонаж уже добавлен')
  if(state.roster.modelsLimit>0 && state.roster.units.length+1>state.roster.modelsLimit) return alert('Превышен лимит моделей')
  const uid = `${u.id}-${Math.random().toString(36).slice(2,7)}`
  const faction = state.roster.faction || (u.factions?.length===1 ? u.factions[0] : null)
  const unit = { uid, id:u.id, name:u.name, factions:u.factions, cost:u.cost, unique:u.unique, prereq:u.prereq, access:u.access, img:u.img, cards:[], faction };
  const equippedEntries = Array.isArray(u.equipped) ? u.equipped : normalizeEquippedEntries(u.equipped)
  equippedEntries.forEach(ref=>{
    const item = resolveItemReference(db, ref)
    if(item){
      unit.cards.push(createCardEntry(item.id,true))
    }
  })
  state.roster.units.push(unit)
  recomputeLeaderFlag()
  renderRoster(); closeModal()
}

function openItemPicker(uid){
  const unit = getUnitByUid(uid)
  if(!unit) return
  state.pickerMode='item'
  state.pickerForUnitId=uid
  state.itemFilter=createDefaultItemFilter()
  openModal(`Добавление карт: ${unit.name}`)
  state.availableItems = computeAvailableItems(unit)
  state.availableItems.sort((a,b)=>{
    if(a.cost!==b.cost) return a.cost-b.cost
    return a.name.localeCompare(b.name,'ru')
  })
  const defaultGroup = determineDefaultGroup()
  if(defaultGroup) state.itemFilter.group = defaultGroup
  renderItemFilters(unit)
  renderItemPicker(unit)
}
function computeAvailableItems(unit){
  const faction = getUnitFaction(unit)
  return db.items.filter(item=>{
    if(item.is_mod) return false
    if(item.name){
      const low=item.name.toLowerCase()
      if(unitHasPowerArmor(unit) && (low==='camouflage' || low==='climbing spikes')) return false
    }
    if(item.cats.Armor && unitHasCategory(unit,'Armor')) return false
    if(item.cats.Clothes && unitHasCategory(unit,'Clothes')) return false
    if(item.cats.Perks && unitHasPerk(unit)) return false
    if(item.cats.Leader){
      if(unitHasLeader(unit)) return false
      if(state.roster.leaderTaken) return false
    }
    if(item.unique && rosterItemCount(item.id)>0) return false
    if(item.faction_limits && faction && item.faction_limits[faction]){
      if(rosterItemCount(item.id) >= item.faction_limits[faction]) return false
    }
    if(!isItemAllowedForUnit(unit,item,faction)) return false
    return true
  })
}
function isItemAllowedForUnit(unit,item,faction){
  if(item.factions.length){
    if(faction){
      if(!item.factions.includes(faction)) return false
    }else if(!item.factions.some(f=>unit.factions?.includes(f))) return false
  }
  for(const key of WEAPON_KEYS){
    if(item.weapon[key]){
      if(key==='Mines'){
        if(!(unit.prereq['Mines'] || unit.prereq['Grenade'])) return false
      } else if(!unit.prereq[key]) return false
    }
  }
  if(item.cats['Power Armor'] && !unit.prereq['Power Armor']) return false
  if(item.cats.Upgrades && !unit.prereq.Upgrades) return false
  for(const key of ACCESS_KEYS){
    if(item.cats[key] && !unit.access[key]) return false
  }
  if((unit.factions||[]).includes('Super Mutants') || faction==='Super Mutants'){
    if((item.cats.Armor || item.cats.Clothes) && !item.cats['Super Mutant Items']) return false
  }
  return true
}
function determineDefaultGroup(){
  if(!state.availableItems.length) return null
  if(state.availableItems.some(item=>itemMatchesGroup(item,'Weapons'))) return 'Weapons'
  const group = ITEM_GROUPS.find(g=>state.availableItems.some(item=>itemMatchesGroup(item,g.key)))
  return group?group.key:null
}

function itemMatchesActiveFlags(item){
  const flags=state.itemFilter.flags||{}
  if(flags.mods && !item.is_mod) return false
  if(flags.stripes && !itemHasSpecialBars(item)) return false
  if(flags.chem && !(item.cats?.Chem || item.cats?.Alcohol)) return false
  return true
}

function getCatalogItems(unit){
  if(state.itemFilter.flags.mods){
    const faction=getUnitFaction(unit)
    return db.items.filter(item=>{
      if(!item.is_mod) return false
      return isItemAllowedForUnit(unit,item,faction)
    })
  }
  return state.availableItems
}
function renderItemFilters(unit){
  const host=$('#filters'); host.innerHTML=''
  const filtersRow=document.createElement('div'); filtersRow.className='filter-row'
  const source=getCatalogItems(unit)
  const availableGroups = ITEM_GROUPS.filter(group=>source.some(item=>itemMatchesGroup(item, group.key)))
  const makeBtn=(label,value)=>{
    const btn=document.createElement('button'); btn.className='filter'; btn.textContent=label
    const active = state.itemFilter.group===value || (value===null && !state.itemFilter.group)
    if(active) btn.classList.add('active')
    btn.onclick=()=>{ state.itemFilter.group=value; if(value!=='Weapons') state.itemFilter.weapon=null; renderItemFilters(unit); renderItemPicker(unit) }
    return btn
  }
  filtersRow.appendChild(makeBtn('Все', null))
  availableGroups.forEach(group=>{ filtersRow.appendChild(makeBtn(group.label, group.key)) })
  host.appendChild(filtersRow)
  if(state.itemFilter.group==='Weapons'){
    const sub=document.createElement('div'); sub.className='filter-row sub'
    const availableWeapons = WEAPON_KEYS.filter(key=>source.some(item=>itemMatchesGroup(item,'Weapons', key)))
    if(availableWeapons.length && !availableWeapons.includes(state.itemFilter.weapon)) state.itemFilter.weapon = availableWeapons[0]
    availableWeapons.forEach(key=>{
      const btn=document.createElement('button'); btn.className='filter'; btn.textContent=key
      if(state.itemFilter.weapon===key) btn.classList.add('active')
      btn.onclick=()=>{ state.itemFilter.weapon=key; renderItemFilters(unit); renderItemPicker(unit) }
      sub.appendChild(btn)
    })
    host.appendChild(sub)
  }
  const togglesRow=document.createElement('div'); togglesRow.className='filter-row sub'
  const toggles=[
    { key:'stripes', label:'С полосками' },
    { key:'mods', label:'Мод-карты' },
    { key:'chem', label:'Химия / алкоголь' }
  ]
  toggles.forEach(toggle=>{
    const btn=document.createElement('button')
    btn.className='filter-toggle'
    btn.dataset.active = state.itemFilter.flags[toggle.key] ? 'true':'false'
    btn.textContent=toggle.label
    btn.onclick=()=>{
      state.itemFilter.flags[toggle.key] = !state.itemFilter.flags[toggle.key]
      renderItemFilters(unit)
      renderItemPicker(unit)
    }
    togglesRow.appendChild(btn)
  })
  host.appendChild(togglesRow)
}
function renderItemPicker(unit){
  const list=$('#pickerList'); list.innerHTML=''; list.classList.add('picker-items'); list.classList.remove('picker-units','picker-mods')
  const group=state.itemFilter.group
  const weaponFilter = group==='Weapons'?state.itemFilter.weapon:null
  const source = getCatalogItems(unit)
  const usingModCatalog = !!state.itemFilter.flags.mods
  const items = source.filter(item=>{
    if(!itemMatchesActiveFlags(item)) return false
    if(!group) return true
    if(group==='Weapons'){
      if(weaponFilter) return itemMatchesGroup(item,'Weapons', weaponFilter)
      return itemMatchesGroup(item,'Weapons')
    }
    return itemMatchesGroup(item, group)
  })
  if(!items.length){
    const empty=document.createElement('div'); empty.className='empty'; empty.textContent='Нет подходящих карт'
    list.appendChild(empty)
    return
  }
  items.sort((a,b)=>{ if(a.cost!==b.cost) return a.cost-b.cost; return a.name.localeCompare(b.name,'ru') })
  items.forEach(item=>{
    const card=document.createElement('div'); card.className='card card-item'; card.dataset.id=item.id
    card.classList.add('card--picker')
    const type = item.is_mod ? 'mod' : (item.cats?.Perks ? 'perk' : (item.cats?.['Power Armor'] ? 'power' : 'item'))
    card.classList.add(`card--${type}`)
    card.dataset.cardType=type
    if(item.unique) card.dataset.tag='unique'
    const thumb=document.createElement('div')
    thumb.classList.add('card__thumb')
    const img=document.createElement('img'); img.className='thumb thumb-item card__img'; safeImg(img, item.img, 'images/missing-item.png'); ensurePortraitImage(img, { preferPortrait: itemHasSpecialBars(item) }); flagCardOrientation(img, card)
    thumb.appendChild(img)
    card.appendChild(thumb)
    const body=document.createElement('div'); body.className='card-body'; body.classList.add('card__body')
    const title=document.createElement('div'); title.className='title'; title.textContent=item.name
    const meta=document.createElement('div'); meta.className='meta'; meta.textContent=infoLine(item)
    body.appendChild(title); body.appendChild(meta)
    const actions=document.createElement('div'); actions.className='actions'; actions.classList.add('card__actions')
    card.appendChild(body)
    if(!usingModCatalog){
      const activate=()=>addItemToUnit(unit.uid,item.id)
      const add=document.createElement('button'); add.className='btn tiny'; add.textContent='Добавить'
      add.addEventListener('click', e=>{ e.stopPropagation(); activate() })
      actions.appendChild(add)
      card.addEventListener('click', e=>{ if(e.target.closest('button')) return; activate() })
      card.tabIndex=0
      card.addEventListener('keydown', e=>{ if(e.key==='Enter' || e.key===' '){ e.preventDefault(); activate() } })
    }else{
      const hint=document.createElement('div')
      hint.className='meta'
      hint.textContent='Добавьте через «+ мод» у предмета'
      body.appendChild(hint)
      const info=document.createElement('span')
      info.className='actions__hint'
      info.textContent='Только через «+ мод» у карты'
      actions.appendChild(info)
    }
    if(actions.children.length) card.appendChild(actions)
    list.appendChild(card)
  })
}

function canAddMod(unit, card, base){
  if(!base || !base.modType) return false
  return db.items.some(mod=>mod.is_mod && (!mod.mod_targets.length || mod.mod_targets.includes(base.modType)))
}
function openModPicker(uid,index){
  const unit=getUnitByUid(uid)
  if(!unit) return
  const card=unit.cards[index]
  if(!card) return
  const base=getItem(card.itemId)
  if(!base || !base.modType) return
  state.pickerMode='mod'
  state.modTarget={ unitId:uid, cardIndex:index }
  openModal(`Модификации: ${base.name}`)
  $('#filters').innerHTML=''
  const mods=availableModsForCard(unit, card, base)
  renderModPicker(mods)
}
function availableModsForCard(unit, card, base){
  const faction=getUnitFaction(unit)
  return db.items.filter(item=>{
    if(!item.is_mod) return false
    if(item.mod_targets.length && !item.mod_targets.includes(base.modType)) return false
    if(item.unique && card.modId!==item.id && rosterItemCount(item.id)>0) return false
    if(item.factions.length){
      if(faction){ if(!item.factions.includes(faction)) return false }
      else if(!item.factions.some(f=>unit.factions?.includes(f))) return false
    }
    if(!isItemAllowedForUnit(unit,item,faction)) return false
    return true
  })
}
function renderModPicker(mods){
  const list=$('#pickerList'); list.innerHTML=''; list.classList.add('picker-mods'); list.classList.remove('picker-units','picker-items')
  if(!mods.length){
    const empty=document.createElement('div'); empty.className='empty'; empty.textContent='Нет доступных модификаций'
    list.appendChild(empty)
    return
  }
  mods.sort((a,b)=>{
    if(a.cost!==b.cost) return a.cost-b.cost
    return a.name.localeCompare(b.name,'ru')
  })
  mods.forEach(mod=>{
    const card=document.createElement('div'); card.className='card card-item'; card.dataset.id=mod.id
    card.classList.add('card--picker','card--mod')
    card.dataset.cardType='mod'
    if(mod.unique) card.dataset.tag='unique'
    const thumb=document.createElement('div')
    thumb.classList.add('card__thumb')
    const img=document.createElement('img'); img.className='thumb thumb-item card__img'; safeImg(img, mod.img, 'images/missing-item.png'); ensurePortraitImage(img, { preferPortrait: itemHasSpecialBars(mod) }); flagCardOrientation(img, card)
    thumb.appendChild(img)
    card.appendChild(thumb)
    const body=document.createElement('div'); body.className='card-body'; body.classList.add('card__body')
    const title=document.createElement('div'); title.className='title'; title.textContent=mod.name
    const meta=document.createElement('div'); meta.className='meta'; meta.textContent = infoLine(mod)
    body.appendChild(title); body.appendChild(meta)
    const actions=document.createElement('div'); actions.className='actions'; actions.classList.add('card__actions')
    const add=document.createElement('button'); add.className='btn tiny'; add.textContent='Добавить'
    add.addEventListener('click', e=>{ e.stopPropagation(); applyModToUnit(mod.id) })
    actions.appendChild(add)
    card.appendChild(body)
    card.appendChild(actions)
    card.addEventListener('click', e=>{ if(e.target.closest('button')) return; applyModToUnit(mod.id) })
    list.appendChild(card)
  })
}

function applyModToUnit(modId){
  const target=state.modTarget
  if(!target) return
  const unit=getUnitByUid(target.unitId)
  if(!unit) return
  const card=unit.cards[target.cardIndex]
  if(!card) return
  const mod=getItem(modId)
  if(!mod) return
  card.modId=mod.id
  closeModal()
  renderRoster()
}
function removeMod(uid,index){
  const unit=getUnitByUid(uid)
  if(!unit) return
  const card=unit.cards[index]
  if(!card) return
  card.modId=null
  renderRoster()
}

function tagLabel(key){
  return TAG_LABELS[key] || key
}

function infoLine(x){
  const tags=[]
  WEAPON_KEYS.forEach(k=>{ if(x.weapon[k]) tags.push(tagLabel(k)) })
  if(x.cats.Armor) tags.push(tagLabel('Armor'))
  if(x.cats['Power Armor']) tags.push(tagLabel('Power Armor'))
  if(x.cats.Clothes) tags.push(tagLabel('Clothes'))
  if(x.cats.Gear) tags.push(tagLabel('Gear'))
  if(x.cats.Chem) tags.push(tagLabel('Chem'))
  if(x.cats.Alcohol) tags.push(tagLabel('Alcohol'))
  if(x.cats.Food) tags.push(tagLabel('Food'))
  ACCESS_KEYS.forEach(k=>{ const label=tagLabel(k); if(x.cats[k] && !tags.includes(label)) tags.push(label) })
  const perkLabel = tagLabel('Perk')
  const leaderLabel = tagLabel('Leader')
  if(x.cats.Perks && !tags.includes(perkLabel)) tags.push(perkLabel)
  if(x.cats.Leader && !tags.includes(leaderLabel)) tags.push(leaderLabel)
  if(x.is_mod) tags.push(tagLabel('Mod'))
  const uniq = x.unique ? '\u00a0·\u00a0УНИКАЛЬНО' : ''
  const descriptor = tags.length ? tags.join(' / ') : '—'
  return `${x.cost}\u00a0крышек\u00a0\u2013\u00a0${descriptor}${uniq}`
}

function duplicateUnit(uid){
  const u = getUnitByUid(uid); if(!u) return
  if(u.unique) return alert('Нельзя дублировать уникального персонажа')
  if(state.roster.modelsLimit>0 && state.roster.units.length+1>state.roster.modelsLimit) return alert('Превышен лимит моделей')
  const copy = JSON.parse(JSON.stringify(u)); copy.uid = `${u.id}-${Math.random().toString(36).slice(2,7)}`
  state.roster.units.push(copy); recomputeLeaderFlag(); renderRoster()
}

function removeUnit(uid){
  state.roster.units = state.roster.units.filter(x=>x.uid!==uid); recomputeLeaderFlag(); renderRoster()
}

function removeItem(uid,index){
  const unit = getUnitByUid(uid); if(!unit) return
  const card = unit.cards[index]; if(!card || card.locked) return
  unit.cards.splice(index,1)
  recomputeLeaderFlag()
  renderRoster()
}

function addItemToUnit(uid,itemId){
  const unit = getUnitByUid(uid); if(!unit) return
  const item = getItem(itemId); if(!item || item.is_mod) return
  const available = computeAvailableItems(unit)
  if(!available.some(x=>x.id===item.id)) return alert('Эта карта недоступна для выбранного персонажа')
  unit.cards.push(createCardEntry(item.id,false))
  recomputeLeaderFlag()
  renderRoster(); closeModal()
}
function serializeRoster(){
  return {
    name: state.roster.name,
    faction: state.roster.faction,
    pointsLimit: state.roster.pointsLimit,
    modelsLimit: state.roster.modelsLimit,
    units: state.roster.units.map(u=>({
      uid: u.uid,
      id: u.id,
      faction: u.faction||null,
      cards: u.cards.map(card=>({ itemId: card.itemId, modId: card.modId||null, locked: !!card.locked }))
    }))
  }
}
function persistToStorage(){
  localStorage.setItem('roster', JSON.stringify(serializeRoster()))
}
function restoreFromStorage(){
  try{
    const raw = localStorage.getItem('roster'); if(!raw) return
    const data = JSON.parse(raw)
    state.roster.name = data.name||""
    state.roster.faction = data.faction||""
    state.roster.pointsLimit = data.pointsLimit||0
    state.roster.modelsLimit = data.modelsLimit||0
    state.roster.units = (data.units||[]).map(saved=>{
      const ref = db.units.find(x=>x.id===saved.id)
      const uid = saved.uid || `${saved.id}-${Math.random().toString(36).slice(2,7)}`
      const base = ref ? { ...ref } : { id:saved.id, name:saved.id, factions:[], cost:0, unique:false, prereq:{}, access:{}, img:'images/missing-unit.png' }
      return {
        uid,
        id: base.id,
        name: base.name,
        factions: base.factions||[],
        cost: base.cost||0,
        unique: base.unique||false,
        prereq: base.prereq||{},
        access: base.access||{},
        img: base.img,
        cards: (saved.cards||[]).map(card=>{
          if(card && typeof card==='object' && ('itemId' in card)){
            return { itemId: card.itemId, modId: card.modId||null, locked: !!card.locked }
          }
          if(card && typeof card==='object' && card.id){
            const modId = card.mod && card.mod.id ? card.mod.id : null
            return { itemId: card.id, modId, locked: !!card.locked }
          }
          if(typeof card==='string'){
            return { itemId: card, modId:null, locked:false }
          }
          return { itemId: card?.itemId||'', modId: card?.modId||null, locked:false }
        }).filter(c=>c.itemId),
        faction: saved.faction || null
      }
    })
    recomputeLeaderFlag()
  }catch(e){}
}

$('#addUnitBtn').addEventListener('click', addUnitPick)
$('#modalClose').addEventListener('click', closeModal)
$('#clearBtn').addEventListener('click', ()=>{ if(confirm('Очистить текущий лист?')){ state.roster={ name:"", faction:"", pointsLimit:0, modelsLimit:0, units:[], leaderTaken:false }; persistToStorage(); renderRoster() }})
$('#saveBtn').addEventListener('click', ()=>{
  const blob = new Blob([JSON.stringify(serializeRoster())], {type:'application/json'})
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download = safeFileName(state.roster.name)+'.json'; a.click()
})
$('#loadBtn').addEventListener('click', ()=>$('#loadInput').click())
$('#loadInput').addEventListener('change', e=>{
  const file=e.target.files[0]; if(!file) return
  const fr=new FileReader(); fr.onload=()=>{ try{ const data=JSON.parse(fr.result); localStorage.setItem('roster', JSON.stringify(data)); restoreFromStorage(); renderRoster() }catch(e){ alert('Неверный файл') } }; fr.readAsText(file)
})
$('#listName').addEventListener('input', e=>{ state.roster.name=e.target.value; persistToStorage() })
$('#pointsLimit').addEventListener('change', e=>{ state.roster.pointsLimit = Number(e.target.value||0); persistToStorage() })
$('#modelsLimit').addEventListener('change', e=>{ state.roster.modelsLimit = Number(e.target.value||0); persistToStorage() })
const pdfSelect=$('#pdfSizeSelect')
if(pdfSelect){
  pdfSelect.value=state.pdfCardSize
  pdfSelect.addEventListener('change', e=>{
    const val=e.target.value==='small'?'small':'large'
    state.pdfCardSize=val
    try{ localStorage.setItem('pdfCardSize', val) }catch(err){}
  })
}

window.addEventListener('keydown', e=>{ if(e.key==='Escape') closeModal() })

loadDB()


// === Build printable sheet with card images ===
async function buildPrintSheet(){
  const host = document.getElementById('printSheet')
  if(!host) return
  host.innerHTML=''
  const variant = state.pdfCardSize==='small' ? 'small' : 'large'
  const perPage = variant==='small' ? 20 : 8
  let sheet=null
  let grid=null
  let count=0
  const units=state.roster?.units||[]
  const loadPromises=[]
  units.forEach(unit=>{
    const entries = buildPrintCardsForUnit(unit)
    entries.forEach(entry=>{
      if(!entry) return
      if(count % perPage === 0){
        sheet=document.createElement('section')
        sheet.className=`sheet sheet--${variant}`
        grid=document.createElement('div')
        grid.className='pdf-grid'
        sheet.appendChild(grid)
        host.appendChild(sheet)
      }
      const cell=document.createElement('article')
      cell.className='pdf-card'
      const img=new Image()
      img.className='pdf-card__image'
      const imgLoaded=waitForImageLoad(img)
      loadPromises.push(imgLoaded)
      safeImg(img, entry.img, entry.fallback)
      ensurePortraitImage(img, { preferPortrait:true })
      flagCardOrientation(img, cell)
      img.decoding='sync'
      img.loading='eager'
      cell.appendChild(img)
      if(entry.mods && entry.mods.length){
        const modsWrap=document.createElement('div')
        modsWrap.className='pdf-card__mod'
        entry.mods.forEach(modEntry=>{
          const modImg=new Image()
          modImg.className='pdf-card__mod-image'
          const modLoaded=waitForImageLoad(modImg)
          loadPromises.push(modLoaded)
          safeImg(modImg, modEntry.img, modEntry.fallback)
          ensurePortraitImage(modImg, { preferPortrait:true })
          modImg.decoding='sync'
          modImg.loading='eager'
          modsWrap.appendChild(modImg)
        })
        cell.appendChild(modsWrap)
      }
      grid.appendChild(cell)
      count+=1
    })
  })
  await Promise.all(loadPromises)

  try{
    const imgs = host.querySelectorAll('.pdf-card__image, .pdf-card__mod-image')
    await Promise.all(Array.from(imgs).map(img=>
      (img.decode ? img.decode().catch(()=>{}) : Promise.resolve())
    ))
  }catch(err){}
}

function buildPrintCardsForUnit(unit){
  const result=[]
  if(!unit) return result
  result.push({ img:unit.img, fallback:'images/missing-unit.png', mods:[] })
  const cards=(unit.cards||[]).map((card,index)=>{
    const item=getItem(card.itemId)
    if(!item) return null
    return { card,item,index }
  }).filter(Boolean)
  let power=null
  const others=[]
  cards.forEach(entry=>{
    if(entry.item.cats && entry.item.cats['Power Armor'] && !power){
      power=entry
    }else{
      others.push(entry)
    }
  })
  if(power) result.push(createPrintEntryFromCard(power))
  others.forEach(entry=>{ result.push(createPrintEntryFromCard(entry)) })
  return result
}

function createPrintEntryFromCard(entry){
  const mods=[]
  if(entry.card.modId){
    const modItem=getItem(entry.card.modId)
    if(modItem){
      mods.push({ img:modItem.img, fallback:'images/missing-item.png' })
    }
  }
  return { img:entry.item.img, fallback:'images/missing-item.png', mods }
}


function clearPrintSheet(){
  const host = document.getElementById('printSheet');
  if (host) host.innerHTML = '';
}

async function printCards() {
  await buildPrintSheet();
  await waitForImages('.pdf-card__image, .pdf-card__mod-image, .card__img', 15000);
  window.print();
}

document.getElementById('printBtn').addEventListener('click', printCards);
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
  const hide=()=>{ zoom.style.display='none' }
  const show=src=>{
    if(!src) return
    pic.src=src
    zoom.style.display='flex'
  }
  window.__showImagePreview = show
  zoom.addEventListener('click', hide)
  document.addEventListener('click', (e)=>{
    if(e.target && e.target.classList && e.target.classList.contains('thumb')){
      show(e.target.src)
    }
  }, true);
})();

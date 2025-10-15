
function safeImg(el, src, fallback){
  el.loading='lazy'; el.decoding='async';
  el.src=src;
  el.onerror=()=>{ if(el.dataset.fallback!=='1'){ el.dataset.fallback='1'; el.src=fallback; } };
}


const $ = s => document.querySelector(s)
const $$ = s => Array.from(document.querySelectorAll(s))

const db = { units: [], items: [], itemMap: new Map(), itemNameMap: new Map() }
const state = {
  roster: { name:"", faction:"", pointsLimit:0, modelsLimit:0, units:[], leaderTaken:false },
  modal: null,
  pickerMode: null,
  pickerForUnitId: null,
  unitFilter: 'Все',
  itemFilter: { group:null, weapon:null },
  availableItems: [],
  modTarget: null
}

const WEAPON_KEYS = ['Melee','Pistol','Rifle','Heavy Weapon','Grenade','Mines']
const ACCESS_KEYS = ['Upgrades','Wasteland Items','Advanced Items','High Tech Items','Usable Items','Robots Items','Automatron Items','Creature Items','Dog Items','Super Mutant Items','Standart Item','Faction Items']
const CATEGORY_KEYS = ['Chem','Alcohol','Food','Armor','Clothes','Gear','Mod','Perks','Leader','Power Armor','Upgrades','Wasteland Items','Advanced Items','High Tech Items','Usable Items','Robots Items','Automatron Items','Creature Items','Dog Items','Super Mutant Items','Standart Item','Faction Items']

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

function resolveItemReference(ref){
  if(ref===null || ref===undefined) return null
  if(typeof ref==='number') return resolveItemReference(String(ref))
  if(typeof ref==='string'){
    const trimmed=ref.trim()
    if(!trimmed) return null
    const direct=getItem(trimmed)
    if(direct) return direct.id
    const alias=getItemIdByName(trimmed)
    return alias||null
  }
  if(typeof ref==='object'){
    const idKeys=['itemId','id','code','key','uid','cardId']
    for(const key of idKeys){
      if(typeof ref[key]==='string'){
        const resolved=resolveItemReference(ref[key])
        if(resolved) return resolved
      }
    }
    const nameKeys=['name','item','label','title','card','cardName']
    for(const key of nameKeys){
      if(typeof ref[key]==='string'){
        const resolved=resolveItemReference(ref[key])
        if(resolved) return resolved
      }
    }
    for(const val of Object.values(ref)){
      if(typeof val==='string'){
        const resolved=resolveItemReference(val)
        if(resolved) return resolved
      }
    }
  }
  return null
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
  db.itemMap = new Map(db.items.map(x=>[x.id,x]))
  db.itemNameMap = new Map(db.items.map(x=>[normalizeNameKey(x.name), x.id]).filter(([key])=>key))
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
function getItem(id){ return db.itemMap.get(id) }
function getItemIdByName(name){
  const key=normalizeNameKey(name)
  if(!key) return undefined
  return db.itemNameMap.get(key)
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
  select.innerHTML = `<option value="">Без ограничений</option>` + Array.from(all).sort().map(f=>`<option value="${f}">${f}</option>`).join('')
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
    state.itemFilter={ group:null, weapon:null }
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
  state.roster.units.forEach(u=>{
    const tpl = document.querySelector('#unitCardTmpl').content.cloneNode(true)
    const el=tpl.querySelector('.unit'); el.dataset.uid = u.uid
    const img=tpl.querySelector('.unit-img'); safeImg(img, u.img, 'images/missing-unit.png')
    const name=tpl.querySelector('.name'); const meta=tpl.querySelector('.meta')
    name.textContent = u.name
    const uniq = u.unique ? `<span class="badge">UNIQUE</span>`:""
    meta.innerHTML = `${u.cost} caps${uniq}`
    const slots=tpl.querySelector('.slots')
    u.cards.forEach((card,idx)=>{
      const chip=renderItemChip(u,card,idx); if(chip) slots.appendChild(chip)
    })
    tpl.querySelector('.subtotalPoints').textContent = unitPoints(u)
    tpl.querySelector('.itemsCount').textContent = unitItemCount(u)
    tpl.querySelector('[data-act="addItem"]').addEventListener('click',()=>openItemPicker(u.uid))
    tpl.querySelector('[data-act="dup"]').addEventListener('click',()=>duplicateUnit(u.uid))
    tpl.querySelector('[data-act="remove"]').addEventListener('click',()=>removeUnit(u.uid))
    host.appendChild(tpl)
  })
  const spent = calcRosterPoints()
  $('#spent').textContent = spent
  const lim=Number(state.roster.pointsLimit||0)
  $('#spent').parentElement.style.color = (lim>0 && spent>lim)?'#ff7b7b':''
  $('#unitCount').textContent = state.roster.units.length
  persistToStorage()
}
function renderItemChip(unit,card,index){
  const base = getItem(card.itemId)
  if(!base) return null
  const tpl = document.querySelector('#itemChipTmpl').content.cloneNode(true)
  const root = tpl.querySelector('.item-chip')
  const icon = tpl.querySelector('.icon')
  safeImg(icon, base.img, 'images/missing-item.png')
  tpl.querySelector('.label').textContent = base.name
  tpl.querySelector('.price').textContent = `${base.cost} caps`
  const removeBtn = tpl.querySelector('[data-act="remove"]')
  if(card.locked){
    removeBtn.disabled = true
    removeBtn.title = 'Встроенная карта'
  }else{
    removeBtn.onclick=()=>removeItem(unit.uid,index)
  }
  const modBtn = tpl.querySelector('[data-act="addMod"]')
  const modWrap = tpl.querySelector('.mod-info')
  if(canAddMod(unit, card, base)){
    modBtn.onclick=()=>openModPicker(unit.uid,index)
  }else{
    modBtn.classList.add('hidden')
  }
  if(card.modId){
    const modItem=getItem(card.modId)
    if(modItem){
      modWrap.classList.remove('hidden')
      modWrap.querySelector('.mod-label').textContent = modItem.name
      modWrap.querySelector('.mod-price').textContent = `${modItem.cost} caps`
      const removeModBtn = modWrap.querySelector('[data-act="removeMod"]')
      removeModBtn.onclick=()=>removeMod(unit.uid,index)
      modBtn.textContent='Изменить мод'
    }
  }else{
    modWrap.classList.add('hidden')
  }
  return root
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
    if(u.unique) card.dataset.tag='unique'
    const img=document.createElement('img'); img.className='thumb thumb-large'; safeImg(img, u.img, 'images/missing-unit.png')
    const body=document.createElement('div'); body.className='card-body'
    const title=document.createElement('div'); title.className='title'; title.textContent=u.name
    const meta=document.createElement('div'); meta.className='meta'; meta.innerHTML = `${u.cost} caps${u.unique?' · <span class="badge">UNIQUE</span>':''}`
    const take=document.createElement('button'); take.className='btn take'; take.textContent='Выбрать'; take.onclick=()=>pickUnit(u.id)
    body.appendChild(title); body.appendChild(meta)
    card.appendChild(img); card.appendChild(body); card.appendChild(take)
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
    const itemId = resolveItemReference(ref)
    if(itemId){
      unit.cards.push(createCardEntry(itemId,true))
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
  state.itemFilter={ group:null, weapon:null }
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
function renderItemFilters(unit){
  const host=$('#filters'); host.innerHTML=''
  const filtersRow=document.createElement('div'); filtersRow.className='filter-row'
  const availableGroups = ITEM_GROUPS.filter(group=>state.availableItems.some(item=>itemMatchesGroup(item, group.key)))
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
    const availableWeapons = WEAPON_KEYS.filter(key=>state.availableItems.some(item=>itemMatchesGroup(item,'Weapons', key)))
    if(availableWeapons.length && !availableWeapons.includes(state.itemFilter.weapon)) state.itemFilter.weapon = availableWeapons[0]
    availableWeapons.forEach(key=>{
      const btn=document.createElement('button'); btn.className='filter'; btn.textContent=key
      if(state.itemFilter.weapon===key) btn.classList.add('active')
      btn.onclick=()=>{ state.itemFilter.weapon=key; renderItemFilters(unit); renderItemPicker(unit) }
      sub.appendChild(btn)
    })
    host.appendChild(sub)
  }
}
function renderItemPicker(unit){
  const list=$('#pickerList'); list.innerHTML=''; list.classList.add('picker-items'); list.classList.remove('picker-units','picker-mods')
  const group=state.itemFilter.group
  const weaponFilter = group==='Weapons'?state.itemFilter.weapon:null
  const items = state.availableItems.filter(item=>{
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
  items.forEach(item=>{
    const card=document.createElement('div'); card.className='card card-item'; card.dataset.id=item.id
    if(item.unique) card.dataset.tag='unique'
    const img=document.createElement('img'); img.className='thumb thumb-item'; safeImg(img, item.img, 'images/missing-item.png')
    const body=document.createElement('div'); body.className='card-body'
    const title=document.createElement('div'); title.className='title'; title.textContent=item.name
    const meta=document.createElement('div'); meta.className='meta'; meta.textContent=infoLine(item)
    const take=document.createElement('button'); take.className='btn take'; take.textContent='Добавить'; take.onclick=()=>addItemToUnit(unit.uid,item.id)
    body.appendChild(title); body.appendChild(meta)
    card.appendChild(img); card.appendChild(body); card.appendChild(take)
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
    if(mod.unique) card.dataset.tag='unique'
    const img=document.createElement('img'); img.className='thumb thumb-item'; safeImg(img, mod.img, 'images/missing-item.png')
    const body=document.createElement('div'); body.className='card-body'
    const title=document.createElement('div'); title.className='title'; title.textContent=mod.name
    const meta=document.createElement('div'); meta.className='meta'; meta.textContent = infoLine(mod)
    const take=document.createElement('button'); take.className='btn take'; take.textContent='Добавить'; take.onclick=()=>applyModToUnit(mod.id)
    body.appendChild(title); body.appendChild(meta)
    card.appendChild(img); card.appendChild(body); card.appendChild(take)
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

function infoLine(x){
  const tags=[]
  WEAPON_KEYS.forEach(k=>{ if(x.weapon[k]) tags.push(k) })
  if(x.cats.Armor) tags.push('Armor')
  if(x.cats['Power Armor']) tags.push('Power Armor')
  if(x.cats.Clothes) tags.push('Clothes')
  if(x.cats.Gear) tags.push('Gear')
  if(x.cats.Chem) tags.push('Chem')
  if(x.cats.Alcohol) tags.push('Alcohol')
  if(x.cats.Food) tags.push('Food')
  ACCESS_KEYS.forEach(k=>{ if(x.cats[k] && !tags.includes(k)) tags.push(k) })
  if(x.cats.Perks && !tags.includes('Perk')) tags.push('Perk')
  if(x.cats.Leader && !tags.includes('Leader')) tags.push('Leader')
  if(x.is_mod) tags.push('Mod')
  const uniq=x.unique? ' · UNIQUE':''
  const descriptor = tags.length ? tags.join(' / ') : '—'
  return `${x.cost} caps · ${descriptor}${uniq}`
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
    const cards = [];
    (u.cards||[]).forEach(card=>{
      const base=getItem(card.itemId)
      if(base) cards.push(base)
      if(card.modId){
        const mod=getItem(card.modId)
        if(mod) cards.push(mod)
      }
    })
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

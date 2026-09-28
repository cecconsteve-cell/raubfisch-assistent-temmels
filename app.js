const CATALOG_URL = './data/catalog.json';
const ADDITIONS_URL = './data/additions.json';
const STORAGE_KEY = 'raubfisch-temmels-stock-v2';
const LEGACY_STORAGE_KEY = 'raubfisch-temmels-stock-v1';
const ORDERS_KEY = 'raubfisch-temmels-orders-v1';
const $ = (selector) => document.querySelector(selector);
const split = (value) => String(value || '').toLocaleLowerCase('de').split('|').map(x => x.trim());
const safe = (value) => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const shopLink = (url) => { try { const parsed = new URL(url); return parsed.protocol === 'https:' && ['www.camo-tackle.de','fish.shimano.com','www.rapala.eu'].includes(parsed.hostname) ? parsed.href : ''; } catch { return ''; } };

let catalog;
let stock = {};
let orders = {};
let mailCandidates = [];
try {
  const savedStock = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  if (savedStock && !Array.isArray(savedStock)) stock = savedStock;
  else for (const id of JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY) || '[]')) stock[id] = 1;
} catch { stock = {}; }
try { orders = JSON.parse(localStorage.getItem(ORDERS_KEY) || '{}') || {}; } catch { orders = {}; }

const countFor = id => Math.max(0, Number(stock[id]) || 0);
const owns = id => countFor(id) > 0;
function saveStock() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(stock)); } catch { /* private browsing may block persistence */ }
}
function saveOrders() {
  try { localStorage.setItem(ORDERS_KEY, JSON.stringify(orders)); } catch { /* private browsing may block persistence */ }
}

function productFor(combo) {
  if (combo.productId) return catalog.products.find(product => product.ID === combo.productId);
  const name = combo['Köder'].replace(/\s[\d.]+$/, '').toLocaleLowerCase('de');
  return catalog.products.find(product =>
    product.Typ === 'Köder' && product.Produkt.toLocaleLowerCase('de') === name &&
    product.Farbe === combo.Farbe && split(product.Fischart).includes(combo.Fischart.toLocaleLowerCase('de'))
  );
}

function weightFor(combo, flow) {
  if (['Topwater','Jigspinner'].includes(combo['Rig-Art'])) return combo['Gewicht/Zubehör'];
  const key = `${combo.Fischart}/${combo['Rig-Art']}`;
  const choices = {
    'Barsch/Jig':['5 g','7 g','10 g'], 'Barsch/Free Rig':['5 g','7 g','9 g'],
    'Barsch/Ned Rig':['2,8 g','3,5 g','4,6 g'],
    'Barsch/Texas':['5,25 g','7 g','10,5 g'], 'Barsch/Carolina':['5,25 g','7 g','10,5 g'],
    'Barsch/Dropshot':['7 g','10,5 g','14 g'],
    'Zander/Jig':['7 g','10 g','14 g'], 'Zander/Free Rig':['9 g','11 g','14 g'],
    'Zander/Ned Rig':['4,6 g','5,6 g','7 g'],
    'Zander/Texas':['10,5 g','14 g','17,5 g'], 'Zander/Carolina':['7 g','10,5 g','14 g'],
    'Zander/Dropshot':['10,5 g','14 g','17,5 g'],
    'Hecht/Screw Jig':['5 g','10 g','20 g'], 'Hecht/Jig':['10 g','15 g','25 g']
  }[key];
  return choices ? choices[{ruhig:0,normal:1,stark:2}[flow]] + (combo['Rig-Art'] === 'Carolina' ? ' + Glasperle' : '') : combo['Gewicht/Zubehör'];
}

function gearSpec(item, combo, flow) {
  if (['G16','G17','G18','G19','G20','G21','G22','G23'].includes(item.id)) {
    return `${weightFor(combo, flow)} · ${combo.Haken}`;
  }
  return item.spec;
}

function requirementsFor(combo, filters) {
  const fish = combo.Fischart, rig = combo['Rig-Art'];
  const ids = {
    Barsch:['G01','G02'], Zander:['G03','G04'], Hecht:['G05','G06'], Rapfen:['G07','G08']
  }[fish].slice();
  const add = (id, alternatives=[]) => ids.push({id, alternatives});
  if (fish === 'Barsch' || fish === 'Zander') {
    if (rig === 'Jig') { add(fish === 'Barsch' ? 'G19' : 'G20', [fish === 'Barsch' ? 'P010' : 'P009']); add(fish === 'Barsch' ? 'G09' : 'G10'); }
    if (rig === 'Free Rig') add('G16',['P008']);
    if (rig === 'Ned Rig') add('G23',['P017']);
    if (rig === 'Texas' || rig === 'Carolina') add('G17',['P007']);
    if (rig === 'Texas') add('G12',['P007']);
    if (rig === 'Carolina') { add(filters.flow === 'stark' && fish === 'Zander' ? 'G14' : 'G13',['P007']); add('G15',['P007']); }
    if (rig === 'Dropshot') add('G18');
  } else if (fish === 'Hecht') add(rig === 'Jig' ? 'G22' : 'G21',['P012']);
  else add(rig === 'Jigspinner' ? 'G11' : 'G10');
  const product = productFor(combo);
  return [product && {id:product.ID,name:product.Produkt + ' · ' + product.Farbe,spec:product['Größe'],url:product['CAMO-Link'],alternatives:[]}, ...ids.map(entry => {
    const id = typeof entry === 'string' ? entry : entry.id;
    const item = catalog.gear.find(gear => gear.id === id);
    return {...item, spec:gearSpec(item, combo, filters.flow), alternatives:typeof entry === 'string' ? [] : entry.alternatives};
  })].filter(Boolean);
}

function hasItem(item) { return owns(item.id) || item.alternatives.some(owns); }

function rank(combo, filters) {
  const waters = split(combo['Trübung']);
  const lights = split(combo['Wetter/Licht']);
  let score = Number(combo.Score);
  score += waters.includes(filters.water) ? 12 : -18;
  score += lights.includes(filters.light) ? 9 : -8;
  if (filters.passive && lights.includes('passiv')) score += 11;
  if (filters.passive && combo['Rig-Art'] === 'Dropshot') score += 3;
  if (filters.flow === 'stark' && combo['Rig-Art'] === 'Topwater') score -= 8;
  if (filters.flow === 'stark' && combo['Rig-Art'] === 'Jigspinner' && combo.ID === 'K014') score += 6;
  const product = productFor(combo);
  if (product && owns(product.ID)) score += 2;
  return score;
}

function renderRecommendations() {
  const filters = {fish: $('#fish').value, water: $('#water').value.toLocaleLowerCase('de'), light: $('#light').value.toLocaleLowerCase('de'), rig: $('#rig').value, flow: $('#flow').value, passive: $('#passive').checked};
  const all = catalog.combinations.filter(combo => combo.Fischart === filters.fish && (!filters.rig || combo['Rig-Art'] === filters.rig));
  const matched = all.filter(combo => split(combo['Trübung']).includes(filters.water));
  const candidates = matched.length ? matched : all;
  const top = candidates.map(combo => ({combo, rank: rank(combo, filters)})).sort((a,b) => b.rank-a.rank || a.combo.ID.localeCompare(b.combo.ID)).slice(0,3);
  $('#match-note').textContent = !all.length ? `Für ${filters.fish}${filters.rig ? ' mit ' + filters.rig : ''} sind noch keine bewerteten Kombinationen hinterlegt.` :
    !matched.length ? 'Für diese Wassertrübung liegt kein direkter Treffer vor. Hier sind die nächsten vorhandenen Kombinationen.' :
    `${matched.length} passende Kombination${matched.length === 1 ? '' : 'en'} · redaktionell nach Bedingungen sortiert`;
  $('#results').innerHTML = top.length ? top.map(({combo}, index) => {
    const product = productFor(combo);
    const requirements = requirementsFor(combo, filters);
    const missing = requirements.filter(item => !hasItem(item));
    const sources = (combo.sourceIds || []).map(id => catalog.sources.find(source => source.id === id)).filter(Boolean);
    return `<article class="card"><div class="rank">EMPFEHLUNG ${index+1}</div><div class="tag-row"><span class="tag">${safe(combo['Rig-Art'])}</span><span class="tag">${safe(combo.Fischart)}</span></div><h3>${safe(combo['Köder'])}<br>${safe(combo.Farbe)}</h3><dl class="detail"><dt>Größe</dt><dd>${safe(combo['Größe'])}</dd><dt>Haken</dt><dd>${safe(combo.Haken)}</dd><dt>Gewicht</dt><dd>${safe(weightFor(combo,filters.flow))}</dd></dl><p><strong>Führung:</strong> ${safe(combo['Führung'])}</p><div class="checklist"><h4>${missing.length ? `${missing.length} Teil${missing.length === 1 ? '' : 'e'} fehlen` : 'Montage vollständig im Bestand'}</h4><ul>${requirements.map(item => { const present = hasItem(item), url = shopLink(item.url); return `<li class="${present ? '' : 'missing'}">${present ? '✓' : '○'} ${safe(item.name)} · ${safe(item.spec)}${!present && url ? ` · <a href="${safe(url)}" target="_blank" rel="noopener noreferrer">Ansehen</a>` : ''}</li>`; }).join('')}</ul></div><div class="card-bottom"><span class="editorial">${safe(combo.status || 'Ausgangsdaten 27.09.2026')}</span>${sources.length ? ` · <a href="${safe(sources[0].url)}" target="_blank" rel="noopener noreferrer">Quelle</a>` : ''}</div></article>`;
  }).join('') : '<div class="empty">Für diese Auswahl liegt noch kein Vorschlag vor. Wähle eine andere Fischart oder ein anderes Rig.</div>';
}

function renderProducts() {
  $('#products').innerHTML = catalog.products.map(product => {
    const price = catalog.prices.find(item => item['Produkt-ID'] === product.ID);
    const link = shopLink(product['CAMO-Link']);
    return `<article class="product"><div><h3>${safe(product.Produkt)} · ${safe(product.Farbe)}</h3><p>${safe(product.Fischart)} · ${safe(product['Rig-Art']).replaceAll('|', ', ')} · ${safe(product['Größe'])}</p>${price ? `<span class="price">${Number(price.Preis).toLocaleString('de-DE',{style:'currency',currency:'EUR'})} · Stand ${safe(price['Geprüft am'])}</span>` : ''}${link ? `<div><a class="product-link" href="${safe(link)}" target="_blank" rel="noopener noreferrer">Produkt ansehen</a></div>` : ''}</div>${stockControls(product.ID, product.Produkt)}</article>`;
  }).join('');
  $('#gear').innerHTML = catalog.gear.map(item => `<article class="product"><div><h3>${safe(item.name)}</h3><p>${safe(item.type)} · ${safe(item.fish).replaceAll('|', ', ')}</p><span class="stock-meta">${safe(item.spec)}</span><a class="product-link" href="${safe(shopLink(item.url))}" target="_blank" rel="noopener noreferrer">Material ansehen</a></div>${stockControls(item.id, item.name)}</article>`).join('');
}

function stockControls(id, name) {
  const count = countFor(id);
  return `<div class="stock-controls" aria-label="Bestand ${safe(name)}"><button type="button" data-stock-action="remove" data-id="${safe(id)}" aria-label="Einen entfernen" ${count ? '' : 'disabled'}>−</button><output aria-label="${count} vorhanden">${count}</output><button type="button" data-stock-action="add" data-id="${safe(id)}" aria-label="Einen hinzufügen">+</button></div>`;
}

function inventoryItems() {
  return [
    ...catalog.products.map(item => ({
      id:item.ID,
      name:`${item.Produkt} · ${item.Farbe} · ${item['Größe']}`,
      primary:item.Produkt,
      secondary:item.Farbe === 'gemischt' ? '' : item.Farbe,
      variant:String(item['Größe']).match(/[\d.,]+/)?.[0] || ''
    })),
    ...catalog.gear.map(item => ({
      id:item.id,
      name:`${item.name} · ${item.spec}`,
      primary:item.name,
      secondary:'',
      variant:(String(item.spec).match(/Gr\.\s*([\d/.-]+)/i)?.[1] || ''),
      gear:true
    }))
  ];
}

function itemName(id) {
  return inventoryItems().find(item => item.id === id)?.name || id;
}

function renderOrders() {
  const entries = Object.entries(orders).filter(([, order]) => Number(order.quantity) > 0);
  $('#orders').innerHTML = entries.length ? `<h4>Offene Online-Bestellungen</h4>${entries.map(([id, order]) => `<article class="order"><div><strong>${safe(itemName(id))}</strong><span>${safe(order.quantity)} Stück · bestellt am ${safe(order.orderedAt)}</span></div><div class="order-buttons"><button type="button" data-cancel-id="${safe(id)}">Stornieren</button><button type="button" data-deliver-id="${safe(id)}" class="deliver">Als geliefert markieren</button></div></article>`).join('')}` : '<p class="empty-orders">Keine offenen Online-Bestellungen.</p>';
}

function addOrder(id, quantity) {
  const current = orders[id] || {quantity:0, orderedAt:new Date().toLocaleDateString('de-DE')};
  orders[id] = {...current, quantity:Number(current.quantity) + quantity};
}

function normalizeMailText(value) {
  return String(value || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/ß/g, 'ss').toLocaleLowerCase('de').replace(/[^a-z0-9]+/g, ' ').trim();
}

function decodeMailSource(source) {
  let text = String(source || '').replace(/=\r?\n/g, '');
  text = text.replace(/(?:=[0-9A-F]{2})+/gi, sequence => {
    try {
      const bytes = sequence.match(/[0-9A-F]{2}/gi).map(value => Number.parseInt(value, 16));
      return new TextDecoder().decode(new Uint8Array(bytes));
    } catch { return sequence; }
  });
  const base64Parts = [...text.matchAll(/Content-Transfer-Encoding:\s*base64[^\r\n]*\r?\n(?:[^\r\n]*\r?\n)*?\r?\n([A-Za-z0-9+/=\r\n]+?)(?=\r?\n--|$)/gi)];
  for (const match of base64Parts) {
    try {
      const binary = atob(match[1].replace(/\s/g, ''));
      const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
      text += `\n${new TextDecoder().decode(bytes)}`;
    } catch { /* unsupported MIME part stays available as raw text */ }
  }
  return text.replace(/<br\s*\/?\s*>/gi, '\n').replace(/<[^>]+>/g, ' ');
}

function quantityFromLine(line) {
  const match = line.match(/(?:menge|anzahl)\s*:?\s*(\d{1,2})/i) || line.match(/\b(\d{1,2})\s*(?:x|×|stk\.?|stueck|stück)\b/i) || line.match(/\b(?:x|×)\s*(\d{1,2})\b/i);
  return Math.max(1, Math.min(99, Number(match?.[1]) || 1));
}

function extractMailCandidates(source) {
  const decoded = decodeMailSource(source);
  const lines = decoded.split(/\r?\n/).map(raw => ({raw, text:normalizeMailText(raw)})).filter(line => line.text);
  const items = inventoryItems().map(item => ({...item, primaryKey:normalizeMailText(item.primary), secondaryKey:normalizeMailText(item.secondary)}));
  const found = new Map();
  for (const item of items) {
    const line = lines.find(candidate => candidate.text.includes(item.primaryKey) && (!item.secondaryKey || candidate.text.includes(item.secondaryKey)));
    if (!line) continue;
    const group = items.filter(candidate => candidate.primaryKey === item.primaryKey && candidate.secondaryKey === item.secondaryKey);
    const suffix = line.text.slice(line.text.indexOf(item.primaryKey) + item.primaryKey.length);
    const variantKey = normalizeMailText(item.gear && item.variant ? `Gr ${item.variant}` : item.variant);
    const exactVariants = group.filter(candidate => {
      const key = normalizeMailText(candidate.gear && candidate.variant ? `Gr ${candidate.variant}` : candidate.variant);
      return key && suffix.includes(key);
    });
    const exact = group.length === 1 || (variantKey && exactVariants.length === 1 && exactVariants[0].id === item.id);
    if (!exact && exactVariants.length) continue;
    found.set(item.id, {id:item.id, name:item.name, quantity:quantityFromLine(line.raw), checked:exact, ambiguous:!exact});
  }
  return [...found.values()];
}

function renderMailMatches() {
  $('#mail-matches').innerHTML = mailCandidates.map(candidate => `<article class="mail-match"><input type="checkbox" data-mail-check="${safe(candidate.id)}" ${candidate.checked ? 'checked' : ''} aria-label="${safe(candidate.name)} auswählen"><div><strong>${safe(candidate.name)}</strong>${candidate.ambiguous ? '<em>Variante bitte prüfen</em>' : ''}</div><label>Menge<input type="number" min="1" max="99" value="${safe(candidate.quantity)}" data-mail-quantity="${safe(candidate.id)}"></label></article>`).join('');
  $('#import-mail').disabled = !mailCandidates.some(candidate => candidate.checked);
}

function analyzeMail() {
  mailCandidates = extractMailCandidates($('#mail-text').value);
  renderMailMatches();
  const selected = mailCandidates.filter(candidate => candidate.checked).length;
  $('#mail-status').textContent = mailCandidates.length ? `${mailCandidates.length} möglicher Artikel erkannt · ${selected} eindeutig ausgewählt.` : 'Keine Artikel aus dem Katalog erkannt. Prüfe Produktname, Farbe und Größe im Mailtext.';
}

async function init() {
  try {
    const [response, additionsResponse] = await Promise.all([fetch(CATALOG_URL,{cache:'no-store'}), fetch(ADDITIONS_URL,{cache:'no-store'})]);
    if (!response.ok || !additionsResponse.ok) throw new Error('Katalog nicht erreichbar');
    const original = await response.json(), additions = await additionsResponse.json();
    catalog = {...original, sources:additions.sources, gear:additions.gear, products:[...original.products,...additions.products], combinations:[...original.combinations,...additions.combinations]};
    $('#data-status').textContent = `Geprüft ${additions.reviewedAt.split('-').reverse().join('.')}`;
    $('#sources').innerHTML = `Quellen der neuen Vorschläge: ${additions.sources.map(source => `<a href="${safe(shopLink(source.url))}" target="_blank" rel="noopener noreferrer">${safe(source.title)}</a>`).join(' · ')}`;
    $('#order-item').innerHTML = inventoryItems().map(item => `<option value="${safe(item.id)}">${safe(item.name)}</option>`).join('');
    renderRecommendations(); renderProducts(); renderOrders();
    $('#filters').addEventListener('change', renderRecommendations);
    const changeStock = event => {
      const button = event.target.closest('button[data-stock-action]');
      if (!button) return;
      const id = button.dataset.id;
      stock[id] = Math.max(0, countFor(id) + (button.dataset.stockAction === 'add' ? 1 : -1));
      if (!stock[id]) delete stock[id];
      saveStock();
      renderProducts(); renderRecommendations();
    };
    $('#products').addEventListener('click', changeStock);
    $('#gear').addEventListener('click', changeStock);
    $('#order-form').addEventListener('submit', event => {
      event.preventDefault();
      const id = $('#order-item').value;
      const quantity = Math.max(1, Math.min(99, Number.parseInt($('#order-quantity').value, 10) || 1));
      if (event.submitter?.value === 'ordered') {
        addOrder(id, quantity);
        saveOrders(); renderOrders();
        $('#order-status').textContent = `${quantity} × ${itemName(id)} als bestellt gespeichert.`;
      } else {
        stock[id] = countFor(id) + quantity;
        saveStock(); renderProducts(); renderRecommendations();
        $('#order-status').textContent = `${quantity} × ${itemName(id)} zum Bestand hinzugefügt.`;
      }
      $('#order-quantity').value = '1';
    });
    $('#orders').addEventListener('click', event => {
      const deliver = event.target.closest('button[data-deliver-id]');
      const cancel = event.target.closest('button[data-cancel-id]');
      if (!deliver && !cancel) return;
      const id = (deliver || cancel).dataset[deliver ? 'deliverId' : 'cancelId'];
      const quantity = Number(orders[id]?.quantity) || 0;
      if (deliver && quantity) {
        stock[id] = countFor(id) + quantity;
        saveStock();
        $('#order-status').textContent = `${quantity} × ${itemName(id)} geliefert und in den Bestand übernommen.`;
      } else if (cancel) {
        $('#order-status').textContent = `Bestellung für ${itemName(id)} entfernt.`;
      }
      delete orders[id]; saveOrders();
      renderOrders(); renderProducts(); renderRecommendations();
    });
    $('#analyze-mail').addEventListener('click', analyzeMail);
    $('#mail-file').addEventListener('change', async event => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        $('#mail-text').value = await file.text();
        analyzeMail();
      } catch {
        $('#mail-status').textContent = 'Die E-Mail-Datei konnte nicht gelesen werden.';
      }
    });
    $('#mail-matches').addEventListener('change', event => {
      const check = event.target.closest('input[data-mail-check]');
      const quantity = event.target.closest('input[data-mail-quantity]');
      if (check) {
        const candidate = mailCandidates.find(item => item.id === check.dataset.mailCheck);
        if (candidate) candidate.checked = check.checked;
      }
      if (quantity) {
        const candidate = mailCandidates.find(item => item.id === quantity.dataset.mailQuantity);
        if (candidate) candidate.quantity = Math.max(1, Math.min(99, Number.parseInt(quantity.value, 10) || 1));
      }
      $('#import-mail').disabled = !mailCandidates.some(candidate => candidate.checked);
    });
    $('#import-mail').addEventListener('click', () => {
      const selected = mailCandidates.filter(candidate => candidate.checked);
      if (!selected.length) return;
      for (const candidate of selected) addOrder(candidate.id, candidate.quantity);
      saveOrders(); renderOrders();
      $('#mail-status').textContent = `${selected.length} Artikel aus der E-Mail als offene Bestellung übernommen.`;
      mailCandidates = []; renderMailMatches();
    });
  } catch {
    $('#match-note').textContent = 'Die Daten konnten nicht geladen werden. Öffne die App einmal mit Internet und versuche es erneut.';
    $('#results').innerHTML = '';
  }
}

if ('serviceWorker' in navigator) {
  let refreshed = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshed) { refreshed = true; window.location.reload(); }
  });
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js', {updateViaCache:'none'}).then(registration => registration.update()).catch(() => {}));
}
init();


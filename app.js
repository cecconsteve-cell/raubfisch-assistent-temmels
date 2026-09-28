const CATALOG_URL = './data/catalog.json';
const ADDITIONS_URL = './data/additions.json';
const STORAGE_KEY = 'raubfisch-temmels-stock-v1';
const $ = (selector) => document.querySelector(selector);
const split = (value) => String(value || '').toLocaleLowerCase('de').split('|').map(x => x.trim());
const safe = (value) => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const shopLink = (url) => { try { const parsed = new URL(url); return parsed.protocol === 'https:' && ['www.camo-tackle.de','fish.shimano.com','www.rapala.eu'].includes(parsed.hostname) ? parsed.href : ''; } catch { return ''; } };

let catalog;
let owned = new Set();
try { owned = new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')); } catch { owned = new Set(); }

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
    'Barsch/Texas':['5,25 g','7 g','10,5 g'], 'Barsch/Carolina':['5,25 g','7 g','10,5 g'],
    'Barsch/Dropshot':['7 g','10,5 g','14 g'],
    'Zander/Jig':['7 g','10 g','14 g'], 'Zander/Free Rig':['9 g','11 g','14 g'],
    'Zander/Texas':['10,5 g','14 g','17,5 g'], 'Zander/Carolina':['7 g','10,5 g','14 g'],
    'Zander/Dropshot':['10,5 g','14 g','17,5 g'],
    'Hecht/Screw Jig':['5 g','10 g','20 g'], 'Hecht/Jig':['10 g','15 g','25 g']
  }[key];
  return choices ? choices[{ruhig:0,normal:1,stark:2}[flow]] + (combo['Rig-Art'] === 'Carolina' ? ' + Glasperle' : '') : combo['Gewicht/Zubehör'];
}

function gearSpec(item, combo, flow) {
  if (['G16','G17','G18','G19','G20','G21','G22'].includes(item.id)) {
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

function hasItem(item) { return owned.has(item.id) || item.alternatives.some(id => owned.has(id)); }

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
  if (product && owned.has(product.ID)) score += 2;
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
    return `<article class="product"><div><h3>${safe(product.Produkt)} · ${safe(product.Farbe)}</h3><p>${safe(product.Fischart)} · ${safe(product['Rig-Art']).replaceAll('|', ', ')} · ${safe(product['Größe'])}</p>${price ? `<span class="price">${Number(price.Preis).toLocaleString('de-DE',{style:'currency',currency:'EUR'})} · Stand ${safe(price['Geprüft am'])}</span>` : ''}${link ? `<div><a class="product-link" href="${safe(link)}" target="_blank" rel="noopener noreferrer">Produkt ansehen</a></div>` : ''}</div><button type="button" data-id="${safe(product.ID)}" class="${owned.has(product.ID) ? 'owned' : ''}" aria-pressed="${owned.has(product.ID)}">${owned.has(product.ID) ? 'Vorhanden' : 'Hinzufügen'}</button></article>`;
  }).join('');
  $('#gear').innerHTML = catalog.gear.map(item => `<article class="product"><div><h3>${safe(item.name)}</h3><p>${safe(item.type)} · ${safe(item.fish).replaceAll('|', ', ')}</p><span class="stock-meta">${safe(item.spec)}</span><a class="product-link" href="${safe(shopLink(item.url))}" target="_blank" rel="noopener noreferrer">Material ansehen</a></div><button type="button" data-id="${safe(item.id)}" class="${owned.has(item.id) ? 'owned' : ''}" aria-pressed="${owned.has(item.id)}">${owned.has(item.id) ? 'Vorhanden' : 'Hinzufügen'}</button></article>`).join('');
}

async function init() {
  try {
    const [response, additionsResponse] = await Promise.all([fetch(CATALOG_URL,{cache:'no-store'}), fetch(ADDITIONS_URL,{cache:'no-store'})]);
    if (!response.ok || !additionsResponse.ok) throw new Error('Katalog nicht erreichbar');
    const original = await response.json(), additions = await additionsResponse.json();
    catalog = {...original, sources:additions.sources, gear:additions.gear, products:[...original.products,...additions.products], combinations:[...original.combinations,...additions.combinations]};
    $('#data-status').textContent = `Geprüft ${additions.reviewedAt.split('-').reverse().join('.')}`;
    $('#sources').innerHTML = `Quellen der neuen Vorschläge: ${additions.sources.map(source => `<a href="${safe(shopLink(source.url))}" target="_blank" rel="noopener noreferrer">${safe(source.title)}</a>`).join(' · ')}`;
    renderRecommendations(); renderProducts();
    $('#filters').addEventListener('change', renderRecommendations);
    const toggleStock = event => {
      const button = event.target.closest('button[data-id]');
      if (!button) return;
      if (owned.has(button.dataset.id)) owned.delete(button.dataset.id); else owned.add(button.dataset.id);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...owned])); } catch { /* private browsing may block persistence */ }
      renderProducts(); renderRecommendations();
    };
    $('#products').addEventListener('click', toggleStock);
    $('#gear').addEventListener('click', toggleStock);
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

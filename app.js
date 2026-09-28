const CATALOG_URL = './data/catalog.json';
const STORAGE_KEY = 'raubfisch-temmels-stock-v1';
const $ = (selector) => document.querySelector(selector);
const split = (value) => String(value || '').toLocaleLowerCase('de').split('|').map(x => x.trim());
const safe = (value) => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const shopLink = (url) => /^https:\/\/www\.camo-tackle\.de\//.test(String(url || '')) ? url : '';

let catalog;
let owned = new Set();
try { owned = new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')); } catch { owned = new Set(); }

function productFor(combo) {
  const name = combo['Köder'].replace(/\s[\d.]+$/, '').toLocaleLowerCase('de');
  return catalog.products.find(product =>
    product.Typ === 'Köder' && product.Produkt.toLocaleLowerCase('de') === name &&
    product.Farbe === combo.Farbe && split(product.Fischart).includes(combo.Fischart.toLocaleLowerCase('de'))
  );
}

function rank(combo, filters) {
  const waters = split(combo['Trübung']);
  const lights = split(combo['Wetter/Licht']);
  let score = Number(combo.Score);
  score += waters.includes(filters.water) ? 12 : -18;
  score += lights.includes(filters.light) ? 9 : -8;
  if (filters.passive && lights.includes('passiv')) score += 11;
  if (filters.passive && combo['Rig-Art'] === 'Dropshot') score += 3;
  const product = productFor(combo);
  if (product && owned.has(product.ID)) score += 2;
  return score;
}

function renderRecommendations() {
  const filters = {fish: $('#fish').value, water: $('#water').value.toLocaleLowerCase('de'), light: $('#light').value.toLocaleLowerCase('de'), rig: $('#rig').value, passive: $('#passive').checked};
  const all = catalog.combinations.filter(combo => combo.Fischart === filters.fish && (!filters.rig || combo['Rig-Art'] === filters.rig));
  const matched = all.filter(combo => split(combo['Trübung']).includes(filters.water));
  const candidates = matched.length ? matched : all;
  const top = candidates.map(combo => ({combo, rank: rank(combo, filters)})).sort((a,b) => b.rank-a.rank || a.combo.ID.localeCompare(b.combo.ID)).slice(0,3);
  $('#match-note').textContent = !all.length ? `Für ${filters.fish}${filters.rig ? ' mit ' + filters.rig : ''} sind noch keine bewerteten Kombinationen hinterlegt.` :
    !matched.length ? 'Für diese Wassertrübung liegt kein direkter Treffer vor. Hier sind die nächsten vorhandenen Kombinationen.' :
    `${matched.length} passende Kombination${matched.length === 1 ? '' : 'en'} in der Datenbasis · nach Eignung sortiert`;
  $('#results').innerHTML = top.length ? top.map(({combo}, index) => {
    const product = productFor(combo);
    const inBox = product && owned.has(product.ID);
    const link = product && shopLink(product['CAMO-Link']);
    return `<article class="card"><div class="rank">EMPFEHLUNG ${index+1}</div><div class="tag-row"><span class="tag">${safe(combo['Rig-Art'])}</span><span class="tag">${safe(combo.Fischart)}</span></div><h3>${safe(combo['Köder'])}<br>${safe(combo.Farbe)}</h3><dl class="detail"><dt>Größe</dt><dd>${safe(combo['Größe'])}</dd><dt>Haken</dt><dd>${safe(combo.Haken)}</dd><dt>Gewicht</dt><dd>${safe(combo['Gewicht/Zubehör'])}</dd></dl><p><strong>Führung:</strong> ${safe(combo['Führung'])}</p><div class="card-bottom">${product ? (inBox ? '✓ Köder in deinem Bestand' : 'Köder noch nicht markiert') : 'Köder nicht im Produktkatalog'}${link ? ` · <a href="${safe(link)}" target="_blank" rel="noopener noreferrer">Bei CAMO ansehen</a>` : ''}</div></article>`;
  }).join('') : '<div class="empty">Die Datenbasis hat hierfür noch keinen konkreten Vorschlag. Wähle Barsch oder Zander beziehungsweise ein anderes Rig.</div>';
}

function renderProducts() {
  $('#products').innerHTML = catalog.products.map(product => {
    const price = catalog.prices.find(item => item['Produkt-ID'] === product.ID);
    const link = shopLink(product['CAMO-Link']);
    return `<article class="product"><div><h3>${safe(product.Produkt)} · ${safe(product.Farbe)}</h3><p>${safe(product.Fischart)} · ${safe(product['Rig-Art'])} · ${safe(product['Größe'])}</p>${price ? `<span class="price">${Number(price.Preis).toLocaleString('de-DE',{style:'currency',currency:'EUR'})} · Stand ${safe(price['Geprüft am'])}</span>` : ''}${link ? `<div><a class="product-link" href="${safe(link)}" target="_blank" rel="noopener noreferrer">Produkt bei CAMO ansehen</a></div>` : ''}</div><button type="button" data-id="${safe(product.ID)}" class="${owned.has(product.ID) ? 'owned' : ''}" aria-pressed="${owned.has(product.ID)}">${owned.has(product.ID) ? 'Vorhanden' : 'Hinzufügen'}</button></article>`;
  }).join('');
}

async function init() {
  try {
    const response = await fetch(CATALOG_URL);
    if (!response.ok) throw new Error('Katalog nicht erreichbar');
    catalog = await response.json();
    $('#data-status').textContent = 'Datenstand 27.09.2026';
    renderRecommendations(); renderProducts();
    $('#filters').addEventListener('change', renderRecommendations);
    $('#products').addEventListener('click', event => {
      const button = event.target.closest('button[data-id]');
      if (!button) return;
      if (owned.has(button.dataset.id)) owned.delete(button.dataset.id); else owned.add(button.dataset.id);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...owned])); } catch { /* private browsing may block persistence */ }
      renderProducts(); renderRecommendations();
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

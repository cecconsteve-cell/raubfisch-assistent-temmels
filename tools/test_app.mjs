import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const catalog = JSON.parse(fs.readFileSync(new URL('data/catalog.json', root), 'utf8'));
const additions = JSON.parse(fs.readFileSync(new URL('data/additions.json', root), 'utf8'));
const elements = Object.fromEntries(['#fish','#water','#light','#rig','#flow','#passive','#data-status','#match-note','#results','#products','#gear','#sources','#filters'].map(key => [key, {value:'', checked:false, innerHTML:'', textContent:'', addEventListener(name, fn){this[name]=fn;}}]));
Object.assign(elements['#fish'], {value:'Zander'});
Object.assign(elements['#water'], {value:'klar'});
Object.assign(elements['#light'], {value:'bewölkt'});
Object.assign(elements['#flow'], {value:'normal'});
const saved = new Map();
const context = {
  document:{querySelector: selector => elements[selector]},
  localStorage:{getItem:key=>saved.get(key),setItem:(key,value)=>saved.set(key,value)},
  fetch:async(url)=>({ok:true,json:async()=>url.includes('additions') ? additions : catalog}), URL,
  navigator:{}, window:{addEventListener(){}}, console,
};
vm.runInNewContext(fs.readFileSync(new URL('app.js',root),'utf8'),context);
await new Promise(resolve=>setImmediate(resolve));
assert.match(elements['#results'].innerHTML,/Easy Shiner 4/);
assert.match(elements['#match-note'].textContent,/passende Kombination/);
elements['#fish'].value='Hecht'; elements['#filters'].change();
assert.match(elements['#results'].innerHTML,/Stahlvorfach/);
assert.match(elements['#results'].innerHTML,/fehlen/);
elements['#fish'].value='Rapfen'; elements['#filters'].change();
assert.match(elements['#results'].innerHTML,/In The Bait Bass/);
elements['#flow'].value='stark'; elements['#water'].value='trüb'; elements['#filters'].change();
assert.match(elements['#results'].innerHTML,/18 g Eigengewicht/);
elements['#fish'].value='Barsch'; elements['#water'].value='trüb'; elements['#filters'].change();
assert.match(elements['#results'].innerHTML,/Motoroil\/Pink/);
elements['#products'].click({target:{closest:()=>({dataset:{id:'P006'}})}});
assert.deepEqual(JSON.parse(saved.get('raubfisch-temmels-stock-v1')),['P006']);
assert.match(elements['#results'].innerHTML,/✓ FAT Swing Impact/);
for (const fish of ['Barsch','Zander','Hecht','Rapfen']) {
  elements['#fish'].value=fish; elements['#rig'].value=''; elements['#filters'].change();
  assert.match(elements['#results'].innerHTML,/EMPFEHLUNG 1/);
  assert.doesNotMatch(elements['#results'].innerHTML,/undefined/);
}
elements['#fish'].value='Hecht'; elements['#filters'].change();
elements['#gear'].click({target:{closest:()=>({dataset:{id:'G06'}})}});
assert.match(elements['#results'].innerHTML,/✓ Flexonit Stahlvorfach/);
assert.doesNotMatch(elements['#results'].innerHTML,/○ Flexonit Stahlvorfach/);
assert.equal(new Set(additions.gear.map(item=>item.id)).size, additions.gear.length);
assert.ok(fs.readFileSync(new URL('sw.js',root),'utf8').includes('./data/additions.json'));
console.log('Vier Fischarten, Strömung, Montage-Kleinteile und Bestand: OK');

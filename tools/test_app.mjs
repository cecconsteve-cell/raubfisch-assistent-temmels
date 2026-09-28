import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const catalog = JSON.parse(fs.readFileSync(new URL('data/catalog.json', root), 'utf8'));
const elements = Object.fromEntries(['#fish','#water','#light','#rig','#passive','#data-status','#match-note','#results','#products','#filters'].map(key => [key, {value:'', checked:false, innerHTML:'', textContent:'', addEventListener(name, fn){this[name]=fn;}}]));
Object.assign(elements['#fish'], {value:'Zander'});
Object.assign(elements['#water'], {value:'klar'});
Object.assign(elements['#light'], {value:'bewölkt'});
const saved = new Map();
const context = {
  document:{querySelector: selector => elements[selector]},
  localStorage:{getItem:key=>saved.get(key),setItem:(key,value)=>saved.set(key,value)},
  fetch:async()=>({ok:true,json:async()=>catalog}),
  navigator:{}, window:{addEventListener(){}}, console,
};
vm.runInNewContext(fs.readFileSync(new URL('app.js',root),'utf8'),context);
await new Promise(resolve=>setImmediate(resolve));
assert.match(elements['#results'].innerHTML,/Easy Shiner 4/);
assert.match(elements['#match-note'].textContent,/passende Kombination/);
elements['#fish'].value='Hecht'; elements['#filters'].change();
assert.match(elements['#match-note'].textContent,/keine bewerteten/);
elements['#fish'].value='Barsch'; elements['#water'].value='trüb'; elements['#filters'].change();
assert.match(elements['#results'].innerHTML,/Motoroil\/Pink/);
elements['#products'].click({target:{closest:()=>({dataset:{id:'P006'}})}});
assert.deepEqual(JSON.parse(saved.get('raubfisch-temmels-stock-v1')),['P006']);
assert.match(elements['#results'].innerHTML,/Köder in deinem Bestand/);
console.log('Filter, fehlende Fischart und lokaler Bestand: OK');

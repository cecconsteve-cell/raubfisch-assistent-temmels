import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const catalog = JSON.parse(fs.readFileSync(new URL('data/catalog.json', root), 'utf8'));
const additions = JSON.parse(fs.readFileSync(new URL('data/additions.json', root), 'utf8'));
const elements = Object.fromEntries(['#fish','#water','#light','#rig','#flow','#passive','#data-status','#match-note','#results','#products','#gear','#sources','#filters','#order-form','#order-item','#order-quantity','#order-status','#orders','#mail-text','#mail-file','#analyze-mail','#mail-status','#mail-matches','#import-mail'].map(key => [key, {value:'', checked:false, disabled:false, innerHTML:'', textContent:'', addEventListener(name, fn){this[name]=fn;}}]));
Object.assign(elements['#fish'], {value:'Zander'});
Object.assign(elements['#water'], {value:'klar'});
Object.assign(elements['#light'], {value:'bewölkt'});
Object.assign(elements['#flow'], {value:'normal'});
Object.assign(elements['#order-quantity'], {value:'1'});
const saved = new Map();
const context = {
  document:{querySelector: selector => elements[selector]},
  localStorage:{getItem:key=>saved.get(key),setItem:(key,value)=>saved.set(key,value)},
  fetch:async(url)=>({ok:true,json:async()=>url.includes('additions') ? additions : catalog}), URL,
  navigator:{}, window:{addEventListener(){}}, console, TextDecoder, Uint8Array, atob,
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
elements['#rig'].value='Ned Rig'; elements['#water'].value='klar'; elements['#light'].value='früh'; elements['#filters'].change();
assert.match(elements['#results'].innerHTML,/TRD TubeZ/);
assert.match(elements['#results'].innerHTML,/CAMO Ned Jigs/);
elements['#fish'].value='Zander'; elements['#water'].value='trüb'; elements['#light'].value='Nacht'; elements['#filters'].change();
assert.match(elements['#results'].innerHTML,/Big TRD/);
elements['#fish'].value='Barsch'; elements['#rig'].value=''; elements['#water'].value='trüb'; elements['#light'].value='bewölkt'; elements['#filters'].change();
elements['#products'].click({target:{closest:()=>({dataset:{id:'P006',stockAction:'add'}})}});
assert.deepEqual(JSON.parse(saved.get('raubfisch-temmels-stock-v2')),{P006:1});
assert.match(elements['#results'].innerHTML,/✓ FAT Swing Impact/);
elements['#order-item'].value='P006'; elements['#order-quantity'].value='2';
elements['#order-form'].submit({preventDefault(){},submitter:{value:'purchased'}});
assert.deepEqual(JSON.parse(saved.get('raubfisch-temmels-stock-v2')),{P006:3});
elements['#order-item'].value='G06'; elements['#order-quantity'].value='2';
elements['#order-form'].submit({preventDefault(){},submitter:{value:'ordered'}});
assert.equal(JSON.parse(saved.get('raubfisch-temmels-orders-v1')).G06.quantity,2);
assert.match(elements['#orders'].innerHTML,/Als geliefert markieren/);
elements['#orders'].click({target:{closest:selector=>selector.includes('deliver') ? {dataset:{deliverId:'G06'}} : null}});
assert.equal(JSON.parse(saved.get('raubfisch-temmels-stock-v2')).G06,2);
assert.deepEqual(JSON.parse(saved.get('raubfisch-temmels-orders-v1')),{});
elements['#mail-text'].value='Versandankündigung\n2 x Big TRD Fire Craw 4 / 10,5 cm\n1 x Flexonit Stahlvorfach mit Snap Gr. 1';
elements['#analyze-mail'].click();
assert.match(elements['#mail-matches'].innerHTML,/Big TRD/);
assert.match(elements['#mail-matches'].innerHTML,/Flexonit Stahlvorfach/);
assert.equal(elements['#import-mail'].disabled,false);
elements['#import-mail'].click();
assert.equal(JSON.parse(saved.get('raubfisch-temmels-orders-v1')).P018.quantity,2);
assert.equal(JSON.parse(saved.get('raubfisch-temmels-orders-v1')).G06.quantity,1);
const ambiguous = context.extractMailCandidates('1 x Easy Shiner Tasty Motoroil');
assert.equal(ambiguous.filter(item=>item.ambiguous).length,2);
assert.equal(ambiguous.some(item=>item.checked),false);
for (const fish of ['Barsch','Zander','Hecht','Rapfen']) {
  elements['#fish'].value=fish; elements['#rig'].value=''; elements['#filters'].change();
  assert.match(elements['#results'].innerHTML,/EMPFEHLUNG 1/);
  assert.doesNotMatch(elements['#results'].innerHTML,/undefined/);
}
elements['#fish'].value='Hecht'; elements['#filters'].change();
elements['#gear'].click({target:{closest:()=>({dataset:{id:'G06',stockAction:'add'}})}});
assert.match(elements['#results'].innerHTML,/✓ Flexonit Stahlvorfach/);
assert.doesNotMatch(elements['#results'].innerHTML,/○ Flexonit Stahlvorfach/);
assert.equal(new Set(additions.gear.map(item=>item.id)).size, additions.gear.length);
assert.ok(fs.readFileSync(new URL('sw.js',root),'utf8').includes('./data/additions.json'));
console.log('Vier Fischarten, Strömung, Montage-Kleinteile und Bestand: OK');


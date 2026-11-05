import test from 'node:test';import assert from 'node:assert/strict';import {validScore,schedule,standings} from './engine.js';
test('platné skóre vrátane predĺžení',()=>{for(const [a,b,t] of [[11,5,11],[5,11,11],[11,9,11],[12,10,11],[17,15,11],[21,19,21],[27,25,21]])assert.ok(validScore(a,b,t));});
test('neplatné skóre',()=>{for(const [a,b,t] of [[12,5,11],[11,10,11],[10,8,11],[17,14,11],[22,5,21],[-1,11,11],[11.5,4,11],[null,11,11],[11,11,11],[23,19,21]])assert.equal(validScore(a,b,t),false);});
test('každý s každým a prestávky pri každom prekrytí',()=>{for(const n of [2,3,4,5,10,15,32])for(const r of [1,2,3]){const p=Array.from({length:n},(_,i)=>({id:String(i)}));const ms=schedule(p,r);assert.equal(ms.length,n*(n-1)/2*r);const counts=new Map();ms.forEach((m,i)=>{assert.notEqual(m.a,m.b);const k=[m.a,m.b].sort().join('-');counts.set(k,(counts.get(k)||0)+1);if(i){const prev=ms[i-1];const overlap=[m.a,m.b].some(x=>x===prev.a||x===prev.b);assert.equal(m.breakBefore,overlap);}});for(const v of counts.values())assert.equal(v,r);}});
test('výhry, potom súčet bodov; delené miesto',()=>{const g={players:[{id:'a',lastName:'A'},{id:'b',lastName:'B'},{id:'c',lastName:'C'}],matches:[{a:'a',b:'b',score:[11,4]},{a:'a',b:'c',score:[6,11]},{a:'b',b:'c',score:[11,4]}]};const s=standings(g);assert.deepEqual(s.map(p=>[p.id,p.wins,p.points,p.rank]),[['a',1,17,1],['b',1,15,2],['c',1,15,2]]);});
test('10 hráčov nikdy nehrá dva zápasy za sebou',()=>{
 for(let run=0;run<30;run++)for(const rounds of [1,2,3]){
  const matches=schedule(Array.from({length:10},(_,i)=>({id:String(i)})),rounds);
  assert.ok(matches.every(m=>!m.breakBefore));
 }
});

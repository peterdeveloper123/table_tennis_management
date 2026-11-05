import { test } from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {once} from 'node:events';
test('API: autentifikácia, turnaj, validácia, SSE, vyhodnotenie, trvalé uloženie',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'pingpong-test-'));let child;
 const port=34000+Math.floor(Math.random()*10000),base=`http://127.0.0.1:${port}`;
 async function start(){child=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:String(port),HOST:'127.0.0.1',ADMIN_TOKEN:'test-key',DATA_DIR:dir},stdio:['ignore','pipe','pipe']});await once(child.stdout,'data');}
 async function stop(){const done=once(child,'exit');child.kill();await done;}
 const headers={'Content-Type':'application/json',Authorization:'Bearer test-key'};
 let state;
 async function act(data,expected=200){const r=await fetch(base+'/api/action',{method:'POST',headers,body:JSON.stringify({...data,revision:state.revision})});const d=await r.json();assert.equal(r.status,expected,JSON.stringify(d));if(r.ok)state=d;return d;}
 try{
 await start();assert.equal((await fetch(base+'/api/state?admin=1')).status,401);
 state=await(await fetch(base+'/api/state?admin=1',{headers})).json();
 for(const page of ['/management','/preview','/app.js','/style.css'])assert.equal((await fetch(base+page)).status,200);
 const photo=await fetch(base+'/images/racket.jpg');assert.equal(photo.status,200);assert.equal(photo.headers.get('content-type'),'image/jpeg');assert.equal(Buffer.from(await photo.arrayBuffer()).readUInt16BE(0),0xffd8);
 await act({action:'create',name:'Deti'});const gid=state.groups[0].id;
 for(let i=0;i<4;i++)await act({action:'player',groupId:gid,firstName:'Hráč',lastName:String(i),paid:false});
 const playerId=state.groups[0].players[0].id;
 assert.equal(state.groups[0].players[0].paid,false);
 await act({action:'pay',groupId:gid,playerId});assert.equal(state.groups[0].players[0].paid,true);
 await act({action:'pay',groupId:gid,playerId});assert.equal(state.groups[0].players[0].paid,true);
 await act({action:'pay',groupId:gid,playerId:'missing'},404);
 assert.equal(state.groups[0].capacity,10);assert.equal(state.groups[0].target,11);assert.equal(state.groups[0].rounds,2);
 await act({action:'draw',groupId:gid,target:11,rounds:2},400);
 await act({action:'settings',groupId:gid,target:11,rounds:2,capacity:4});
 await act({action:'player',groupId:gid,firstName:'Navyše',lastName:'Hráč',paid:false},400);
 await act({action:'settings',groupId:gid,target:11,rounds:2,capacity:3},400);
 await act({action:'settings',groupId:gid,target:11,rounds:2,capacity:4.5},400);
 await act({action:'draw',groupId:gid,target:11,rounds:2},400);
 for(const p of state.groups[0].players)await act({action:'pay',groupId:gid,playerId:p.id});
 await act({action:'draw',groupId:gid,target:11,rounds:2});assert.equal(state.groups[0].matches.length,12);
 await act({action:'player',groupId:gid,firstName:'Neskorý',lastName:'Hráč',paid:false},400);
 const m=state.groups[0].matches[0];assert.equal((await act({action:'score',groupId:gid,matchId:m.id,score:[12,5]},400)).error,'Neplatné skóre!!!');
 await act({action:'evaluate',groupId:gid},400);
 const stream=await fetch(base+'/events');const reader=stream.body.getReader();assert.match(new TextDecoder().decode((await reader.read()).value),/data:/);
 await act({action:'score',groupId:gid,matchId:m.id,score:[17,15]});assert.match(new TextDecoder().decode((await reader.read()).value),/17,15/);await reader.cancel();
 for(const match of state.groups[0].matches)await act({action:'score',groupId:gid,matchId:match.id,score:[11,4]});
 await act({action:'evaluate',groupId:gid});assert.equal(state.groups[0].standings.length,4);
 const pub=await(await fetch(base+'/api/state')).json();assert.equal(pub.groups[0].standings.length,4);assert.ok(!('paid' in pub.groups[0].players[0]));assert.ok(!('paid' in pub.groups[0].standings[0]),'public standings must not leak fees');
 await act({action:'score',groupId:gid,matchId:m.id,score:null},400);
 await act({action:'score',groupId:gid,matchId:m.id,score:[11,5]},400);assert.equal(state.groups[0].status,'evaluated');
 await stop();await start();const saved=await(await fetch(base+'/api/state?admin=1',{headers})).json();assert.equal(saved.revision,state.revision);assert.equal(saved.groups[0].matches.length,12);assert.equal(saved.groups[0].capacity,4);
 await act({action:'deleteResults',groupId:gid});
 assert.equal(state.groups[0].status,'closed');assert.equal(state.groups[0].standings.length,0);
 assert.equal(state.groups[0].matches.length,12);assert.deepEqual(state.groups[0].matches[0].score,[11,4]);
 await act({action:'score',groupId:gid,matchId:m.id,score:[11,5]});
 await act({action:'deleteResults',groupId:gid},400);
 await act({action:'evaluate',groupId:gid});assert.equal(state.groups[0].status,'evaluated');
 await act({action:'deleteDraw',groupId:gid});
 assert.equal(state.groups[0].status,'open');assert.equal(state.groups[0].matches.length,0);assert.equal(state.groups[0].standings.length,0);
 assert.equal(state.groups[0].players.length,4);assert.ok(state.groups[0].players.every(p=>p.paid));
 await act({action:'deleteDraw',groupId:gid},400);
 await act({action:'settings',groupId:gid,target:21,rounds:1,capacity:4});
 await act({action:'remove',groupId:gid,playerId});assert.equal(state.groups[0].players.length,3);
 await act({action:'player',groupId:gid,firstName:'Nový',lastName:'Hráč',paid:true});
 await act({action:'draw',groupId:gid,target:21,rounds:1});assert.equal(state.groups[0].matches.length,6);
 await act({action:'deleteGroup',groupId:gid});assert.equal(state.groups.length,0);
 assert.equal((await(await fetch(base+'/api/state')).json()).groups.length,0);
 await act({action:'deleteGroup',groupId:gid},404);
 await stop();await start();assert.equal((await(await fetch(base+'/api/state')).json()).groups.length,0);

 }finally{if(child&&child.exitCode===null)await stop();await rm(dir,{recursive:true,force:true});}
});

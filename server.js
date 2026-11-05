import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {id,validScore,schedule,standings} from './engine.js';
const root=path.dirname(fileURLToPath(import.meta.url));const dir=path.resolve(process.env.DATA_DIR||path.join(root,'data'));fs.mkdirSync(dir,{recursive:true});const db=path.join(dir,'tournament.json');
let state=fs.existsSync(db)?JSON.parse(fs.readFileSync(db,'utf8')):{revision:0,groups:[]};
for(const g of state.groups)g.capacity??=Math.max(16,g.players.length);
const clients=new Set();
function adminSnapshot(){return {...state,groups:state.groups.map(g=>({...g,standings:g.status==='evaluated'?standings(g):[]}))};}
function snapshot(){return {...state,groups:state.groups.map(g=>({...g,players:g.players.map(({paid,...p})=>p),standings:g.status==='evaluated'?standings(g).map(({paid,...p})=>p):[]}))};}
function send(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
function fail(message,status=400){throw Object.assign(new Error(message),{status});}
function name(value){if(typeof value!=='string'||!value.trim()||value.trim().length>80)fail('Meno musí mať 1 až 80 znakov.');return value.trim();}
const token=process.env.ADMIN_TOKEN||'';
const server=http.createServer(async(req,res)=>{
 try{
 const url=new URL(req.url,'http://localhost');
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');
 if(req.method==='GET'&&url.pathname==='/events'){
  res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive'});res.write(`data: ${JSON.stringify(snapshot())}\n\n`);clients.add(res);const timer=setInterval(()=>res.write(': heartbeat\n\n'),15000);req.on('close',()=>{clients.delete(res);clearInterval(timer);});return;
 }
 if(req.method==='GET'&&url.pathname==='/api/state'){const admin=url.searchParams.get('admin')==='1';if(admin&&token&&req.headers.authorization!==`Bearer ${token}`)fail('Nesprávny administrátorský kľúč.',401);return send(res,200,admin?adminSnapshot():snapshot());}
 if(req.method==='POST'&&url.pathname==='/api/action'){
  if(token&&req.headers.authorization!==`Bearer ${token}`)fail('Nesprávny administrátorský kľúč.',401);
  if(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`&&req.headers.origin!==`https://${req.headers.host}`)fail('Nepovolený pôvod požiadavky.',403);
  let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>65536)fail('Príliš veľká požiadavka.',413);}const body=JSON.parse(raw);
  if(body.revision!==state.revision)fail('Údaje zmenil iný administrátor. Obnovte stav a skúste znova.',409);
  const next=structuredClone(state);const g=next.groups.find(x=>x.id===body.groupId);
  if(body.action==='create')next.groups.push({id:id(),name:name(body.name),players:[],matches:[],status:'open',target:11,rounds:2,capacity:10});
  else{
   if(!g)fail('Skupina neexistuje.',404);
   if(['player','remove','draw','settings'].includes(body.action)&&g.status!=='open')fail('Skupina je uzavretá.');
   switch(body.action){
    case 'deleteGroup':next.groups=next.groups.filter(x=>x.id!==g.id);break;
    case 'deleteDraw':
     if(g.status==='open')fail('Skupina nemá losovanie.');
     g.matches=[];g.status='open';break;
    case 'deleteResults':
     if(g.status!=='evaluated')fail('Skupina ešte nie je vyhodnotená.');
     g.status='closed';break;
    case 'player':{
     if(typeof body.paid!=='boolean')fail('Neplatný stav štartovného.');
     const p={id:body.playerId||id(),firstName:name(body.firstName),lastName:name(body.lastName),paid:body.paid};
     if(body.playerId){const i=g.players.findIndex(x=>x.id===body.playerId);if(i<0)fail('Hráč neexistuje.');g.players[i]=p;}else{if(g.players.length>=g.capacity)fail('Kapacita skupiny je naplnená.');g.players.push(p);}break;
    }
    case 'pay':{
     const p=g.players.find(x=>x.id===body.playerId);if(!p)fail('Hráč neexistuje.',404);
     p.paid=true;break;
    }
    case 'settings':
     if(!Number.isInteger(body.capacity)||body.capacity<2||body.capacity>64)fail('Počet hráčov musí byť celé číslo od 2 do 64.');
     if(body.capacity<g.players.length)fail('Kapacita nemôže byť menšia než počet pridaných hráčov.');
     if(![11,21].includes(body.target)||!Number.isInteger(body.rounds)||body.rounds<1||body.rounds>10)fail('Vyberte 11/21 bodov a 1 až 10 kôl.');
     g.capacity=body.capacity;g.target=body.target;g.rounds=body.rounds;break;
    case 'remove':g.players=g.players.filter(x=>x.id!==body.playerId);break;
    case 'draw':if(g.players.length!==g.capacity)fail('Počet hráčov musí zodpovedať nastavenej kapacite skupiny.');if(g.players.some(p=>!p.paid))fail('Všetci hráči musia mať zaplatené štartovné.');if(g.players.length<2)fail('Pridajte aspoň dvoch hráčov.');if(![11,21].includes(body.target)||!Number.isInteger(body.rounds)||body.rounds<1||body.rounds>10)fail('Vyberte 11/21 bodov a 1 až 10 kôl.');g.target=body.target;g.rounds=body.rounds;g.matches=schedule(g.players,g.rounds);g.status='closed';break;
    case 'score':{
     if(g.status==='evaluated')fail('Vyhodnotená skupina je uzamknutá.');
     const m=g.matches.find(x=>x.id===body.matchId);if(!m)fail('Zápas neexistuje.');
     if(body.score!==null&&(!Array.isArray(body.score)||body.score.length!==2||!validScore(...body.score,g.target)))fail('Neplatné skóre!!!');
     m.score=body.score;g.status='closed';break;
    }
    case 'evaluate':if(!g.matches.length||g.matches.some(m=>!m.score))fail('Najskôr zapíšte všetky výsledky.');g.status='evaluated';break;
    default:fail('Neznáma operácia.');
   }
  }
  next.revision++;fs.writeFileSync(db+'.tmp',JSON.stringify(next,null,2));fs.renameSync(db+'.tmp',db);state=next;
  for(const c of clients)c.write(`data: ${JSON.stringify(snapshot())}\n\n`);return send(res,200,adminSnapshot());
 }
 if(req.method==='GET'&&url.pathname==='/images/racket.jpg'){
  res.writeHead(200,{'Content-Type':'image/jpeg','Cache-Control':'public, max-age=3600'});
  return res.end(fs.readFileSync(path.join(root,'images','racket.jpg')));
 }
 if(req.method==='GET'){
  const files={'/':'index.html','/management':'index.html','/preview':'index.html','/app.js':'app.js','/style.css':'style.css'};const file=files[url.pathname];if(file){res.writeHead(200,{'Content-Type':file.endsWith('.css')?'text/css; charset=utf-8':file.endsWith('.js')?'text/javascript; charset=utf-8':'text/html; charset=utf-8','Cache-Control':'no-cache'});return res.end(fs.readFileSync(path.join(root,'public',file)));}
 }
 send(res,404,{error:'Nenájdené'});
 }catch(e){send(res,e.status||400,{error:e.status?e.message:'Požiadavku sa nepodarilo spracovať.'});}
});
server.listen(Number(process.env.PORT)||3000,process.env.HOST||'127.0.0.1',()=>console.log(`Turnaj: http://localhost:${process.env.PORT||3000}/management\nNáhľad: /preview\n${token?'Administrácia chránená ADMIN_TOKEN.':'Lokálny režim bez hesla. Pred sprístupnením v sieti nastavte ADMIN_TOKEN.'}`));

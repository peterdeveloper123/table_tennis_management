import { randomInt, randomUUID } from 'node:crypto';
export const id = () => randomUUID();
export function validScore(a,b,target){
 if(!Number.isSafeInteger(a)||!Number.isSafeInteger(b)||a<0||b<0||a===b)return false;
 const hi=Math.max(a,b),lo=Math.min(a,b);
 return (hi===target&&lo<=target-2)||(hi>target&&hi-lo===2);
}
// Shuffle seeds, then greedily maximize the least-rested player's rest.
// An explicit break is inserted whenever no disjoint match remains.
export function schedule(players, rounds){
 const ids=players.map(p=>p.id);
 for(let i=ids.length-1;i>0;i--){const j=randomInt(i+1);[ids[i],ids[j]]=[ids[j],ids[i]];}
 const pending=[];
 for(let r=1;r<=rounds;r++)for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++)pending.push({id:id(),a:ids[i],b:ids[j],round:r,score:null});
 const result=[],last=new Map(ids.map(x=>[x,-1]));let prev=null;
 while(pending.length){
  let best=-1,value=-Infinity;
  for(let i=0;i<pending.length;i++){
   const m=pending[i];if(prev&&[m.a,m.b].some(x=>x===prev.a||x===prev.b))continue;
   const rest=Math.min(result.length-last.get(m.a),result.length-last.get(m.b));
   const v=rest*1000-last.get(m.a)-last.get(m.b);
   if(v>value){best=i;value=v;}
  }
  const breakBefore=best<0;if(breakBefore)best=0;
  const m=pending.splice(best,1)[0];m.breakBefore=breakBefore;
  last.set(m.a,result.length);last.set(m.b,result.length);result.push(m);prev=m;
 }
 // Repair avoidable overlaps by reversing a contiguous segment. Internal
 // neighbour relationships are preserved, while both changed boundaries
 // must be disjoint. Every repair strictly reduces the number of breaks.
 const overlap=(a,b)=>a&&b&&(a.a===b.a||a.a===b.b||a.b===b.a||a.b===b.b);
 for(let pass=0;pass<result.length;pass++){
  let repaired=false;
  for(let i=1;i<result.length&&!repaired;i++){
   if(!overlap(result[i-1],result[i]))continue;
   for(let j=0;j<=result.length;j++){
    const lo=Math.min(i,j),hi=Math.max(i,j);if(hi-lo<2)continue;
    if(!overlap(result[lo-1],result[hi-1])&&!overlap(result[lo],result[hi])){
     const part=result.slice(lo,hi).reverse();result.splice(lo,hi-lo,...part);repaired=true;break;
    }
   }
  }
  if(!repaired)break;
 }
 result.forEach((m,i)=>m.breakBefore=Boolean(i&&overlap(result[i-1],m)));
 return result;
}
export function standings(g){
 const rows=g.players.map(p=>({...p,wins:0,losses:0,points:0,against:0}));const by=new Map(rows.map(p=>[p.id,p]));
 for(const m of g.matches){if(!m.score)continue;const a=by.get(m.a),b=by.get(m.b),[x,y]=m.score;a.points+=x;a.against+=y;b.points+=y;b.against+=x;if(x>y){a.wins++;b.losses++;}else{b.wins++;a.losses++;}}
 rows.sort((a,b)=>b.wins-a.wins||b.points-a.points||a.lastName.localeCompare(b.lastName,'sk'));
 rows.forEach((p,i)=>p.rank=i&&p.wins===rows[i-1].wins&&p.points===rows[i-1].points?rows[i-1].rank:i+1);return rows;
}

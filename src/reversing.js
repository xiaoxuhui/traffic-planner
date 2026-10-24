(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;else root.TrafficReversing=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const GAP=0.44,CLEAR=0.3,REVERSE_SPEED=0.55,STOP=1-GAP;
 function corridor(c,target){
  const segments=[];for(let i=Math.floor(target);i<=c.i;i++)segments.push({a:c.path[i],b:c.path[i+1],lo:i===Math.floor(target)?target-i:0,hi:i===c.i?c.p:1});return segments;
 }
 function limit(s,a,b,car){
  let max=Infinity;
  const c=s.reverseCar;if(!c||c===car||!c.reversing)return max;
  for(const edge of c.reversing.edges){if(edge.a!==a||edge.b!==b)continue;if(car&&car.path[car.i]===a&&car.path[car.i+1]===b&&car.p>edge.hi+1e-8)continue;max=Math.min(max,edge.lo-GAP);}
  return max;
 }
 function request(s,force=false,id=null){
  if(s.reverseCar)return null;
  const candidates=s.cars.filter(c=>!c.done&&c.waiting&&s.time>=(c.nextReverseAt||0)&&s.time>=(c.holdUntil||0)&&(id===null||c.id===id)&&(force||c.stoppedFor>=3&&c.lock&&s.cars.some(o=>o!==c&&o.waiting&&o.path[o.i+1]===c.lock))).sort((a,b)=>Number(Boolean(b.lock))-Number(Boolean(a.lock))||a.id-b.id);
  for(const c of candidates){
   // Retreat out of the junction just entered, otherwise make a short gap.
   const current=c.i+c.p,target=c.lock===c.path[c.i]&&c.i>0?c.i-1+STOP:c.i+(c.p>0.7?STOP:Math.max(s.junctions.has(c.path[c.i])?CLEAR:0,c.p-GAP));
   if(current-target<0.1)continue;
   const edges=corridor(c,target),nodes=[];for(let i=Math.ceil(target);i<=Math.floor(current);i++)if(s.junctions.has(c.path[i]))nodes.push(c.path[i]);
   if(c.lock&&!nodes.includes(c.lock))nodes.push(c.lock);
   if(nodes.some(n=>s.locks.has(n)&&s.locks.get(n)!==c.id))continue;
   // Check the whole swept lane, including incoming cars close to its rear.
   const occupied=s.cars.some(o=>o!==c&&!o.done&&edges.some(e=>
    o.path[o.i]===e.a&&o.path[o.i+1]===e.b&&o.p<=e.hi+1e-8&&o.p>e.lo-GAP+1e-8||
    e.lo<GAP&&o.path[o.i+1]===e.a&&o.path[o.i+2]===e.b&&o.p>1+e.lo-GAP+1e-8));
   if(occupied)continue;
   // Never back through a junction occupied by another departing movement.
   if(nodes.some(n=>s.cars.some(o=>o!==c&&!o.done&&(o.path[o.i]===n&&o.p<0.3||o.admitted&&o.path[o.i+1]===n))))continue;
   for(const n of nodes)s.locks.set(n,c.id);
   c.reversing={target,edges,nodes};c.admitted=false;c.clearing=null;c.stoppedFor=0;s.reverseCar=c;s.reversed++;return c;
  }
  return null;
 }
 function step(s,c,dt){
  const move=c.reversing;if(!move)return false;
  const position=Math.max(move.target,c.i+c.p-REVERSE_SPEED*dt);c.i=Math.floor(position);c.p=position-c.i;c.waiting=false;
  if(position<=move.target+1e-8){
   for(const n of move.nodes)if(s.locks.get(n)===c.id)s.locks.delete(n);
   c.lock=null;c.reversing=null;s.reverseCar=null;c.holdUntil=s.time+2;c.nextReverseAt=s.time+10;c.waiting=true;
  }
  return true;
 }
 return {request,step,limit,REVERSE_SPEED,GAP,CLEAR};
});

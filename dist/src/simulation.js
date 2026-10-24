(function(root,factory){const api=factory(typeof module==='object'?require('./core.js'):root.TrafficCore);if(typeof module==='object')module.exports=api;else root.TrafficSim=api;})(typeof globalThis!=='undefined'?globalThis:this,function(C){
 'use strict';
 const GAP=0.44,SPEED=1.15,JUNCTION_CLEAR=0.3;
 class Simulation{
  constructor(map,random=Math.random){this.map=map;this.random=random;this.graph=C.adjacency(map);this.paths=map.sources.map(s=>C.exitRoutes(map,s.node,this.graph));this.manual=map.sources.map(s=>(map.routes||[]).some(r=>r.nodes[0]===s.node));this.junctions=new Set(C.nodes(map).filter(n=>C.neighbors(map,n,false).length>=3&&!C.bridgeAt(map,n)));this.reset();}
  reset(){this.cars=[];this.time=0;this.arrived=0;this.totalTravel=0;this.nextId=1;this.destinations={};this.locks=new Map();this.clocks=this.map.sources.map((_,i)=>i*0.6);this.pending=this.map.sources.map(()=>null);this.replanAt=this.map.sources.map(()=>0);this.cycleCheckAt=0;this.accumulator=0;this.rerouted=0;this.loadsAt=-Infinity;this.routingLoads=new Map();}
  get average(){return this.arrived?this.totalTravel/this.arrived:0;}
  get waiting(){return this.cars.filter(c=>c.waiting).length;}
  get blockedSources(){return this.map.sources.filter((_,i)=>!this.paths[i].length);}
  trafficLoads(){
   if(this.time>=this.loadsAt+0.5){this.routingLoads=new Map();for(const c of this.cars){if(c.done)continue;const k=c.path[c.i]+'>'+c.path[c.i+1];this.routingLoads.set(k,(this.routingLoads.get(k)||0)+1+(c.waiting?3:0));}this.loadsAt=this.time;}
   return this.routingLoads;
  }
  signalWait(node,previous,time){
   const s=this.map.signals.find(s=>s.node===node);if(!s)return 0;
   const axis=C.xy(previous)[1]===C.xy(node)[1]?'ew':'ns';if(C.green(s,time,axis))return 0;
   const period=2*(s.cycle+1),phase=((time+s.offset)%period+period)%period,start=axis==='ew'?0:s.cycle+1;
   return (start-phase+period)%period;
  }
  edgeTime(a,b,time,loads){
   const moving=(1+0.75*(loads.get(a+'>'+b)||0))/SPEED;
   return moving+this.signalWait(b,a,time+moving);
  }
  pathTime(path,time,loads){let elapsed=0;for(let i=1;i<path.length;i++)elapsed+=this.edgeTime(path[i-1],path[i],time+elapsed,loads);return elapsed;}
  autoRoute(index,target){
   const loads=this.trafficLoads(),time=this.time;
   return C.weightedRoute(this.map,this.map.sources[index].node,target,(a,b,elapsed)=>this.edgeTime(a,b,time+elapsed,loads),this.graph);
  }
  replanCar(c){
   if(!this.map.sources[c.source]||this.manual[c.source]||c.admitted||c.p<0.35||c.p>0.7+1e-8||this.time<(c.nextPlanAt??0))return;
   const a=c.path[c.i],b=c.path[c.i+1],target=c.path.at(-1);if(b===target||(this.graph.get(b)||[]).length<2)return;
   const loads=this.trafficLoads();if(c.planNode===b&&c.planSnapshot===this.loadsAt)return;c.planNode=b;c.planSnapshot=this.loadsAt;
   const arrival=this.time+(1-c.p)/SPEED,time=arrival+this.signalWait(b,a,arrival),blocked=new Set(c.path.slice(0,c.i+1));
   const next=C.weightedRoute(this.map,b,target,(a,b,elapsed)=>this.edgeTime(a,b,time+elapsed,loads),this.graph,{previous:a,blocked});
   if(!next)return;
   const current=c.path.slice(c.i+1),oldTime=this.pathTime(current,time,loads),newTime=this.pathTime(next,time,loads);
   if(oldTime-newTime>Math.max(2,oldTime*0.15)){
    c.path=[...c.path.slice(0,c.i+1),...next];c.nextPlanAt=this.time+3;c.reroutes=(c.reroutes||0)+1;this.rerouted++;
   }
  }
  resolveQueueCycles(){
   const dependencies=new Map();
   for(const c of this.cars){
    if(!c.waiting||c.admitted||c.p<0.7-1e-8||c.path[c.i+2]===undefined)continue;
    const a=c.path[c.i],b=c.path[c.i+1],next=c.path[c.i+2],light=this.map.signals.find(s=>s.node===b),axis=C.xy(a)[1]===C.xy(b)[1]?'ew':'ns';
    if(light&&!C.green(light,this.time,axis)||this.locks.has(b)&&this.locks.get(b)!==c.id)continue;
    const occupied=this.cars.filter(o=>o!==c&&o.path[o.i]===b&&o.path[o.i+1]===next);
    if(occupied.length===1&&occupied[0].waiting&&!occupied[0].admitted&&occupied[0].p>=0.7-1e-8)dependencies.set(c,occupied[0]);
   }
   const examined=new Set();
   for(const start of dependencies.keys()){
    const chain=[],index=new Map();let cur=start;
    while(dependencies.has(cur)&&!index.has(cur)&&!examined.has(cur)){index.set(cur,chain.length);chain.push(cur);cur=dependencies.get(cur);}
    if(index.has(cur)){
     const cycle=chain.slice(index.get(cur)),nodes=cycle.map(c=>c.path[c.i+1]);
     // Distinct green, unlocked junctions and one car per outgoing segment give
     // the entire cycle enough room to move as a platoon without crossing.
     if(cycle.length>1&&new Set(nodes).size===cycle.length&&cycle.every(c=>!this.locks.has(c.path[c.i+1])||this.locks.get(c.path[c.i+1])===c.id))for(const c of cycle){const b=c.path[c.i+1];c.admitted=true;if(this.junctions.has(b)){this.locks.set(b,c.id);c.lock=b;}}
    }
    chain.forEach(c=>examined.add(c));
   }
  }
  advance(dt){this.accumulator+=Math.max(0,dt);while(this.accumulator>=1/30-1e-9){this.step(1/30);this.accumulator-=1/30;}}
  step(dt){
   this.time+=dt;
   this.trafficLoads();
   if(this.time>=this.cycleCheckAt){this.resolveQueueCycles();this.cycleCheckAt=this.time+0.5;}
   // Older cars move first, so queues follow leaders without overtaking.
   for(const c of this.cars){
    if(c.done)continue;
    this.replanCar(c);
    if(c.lock && c.path[c.i]===c.lock && c.p>=JUNCTION_CLEAR){this.locks.delete(c.lock);c.lock=null;}
    const a=c.path[c.i],b=c.path[c.i+1];let max=1;
    for(const o of this.cars)if(o!==c&&!o.done&&o.path[o.i]===a&&o.path[o.i+1]===b&&o.p>c.p)max=Math.min(max,o.p-GAP);
    let next=c.p+SPEED*dt;
    if(!c.admitted && next>=0.7){
     const light=this.map.signals.find(s=>s.node===b);const axis=C.xy(a)[1]===C.xy(b)[1]?'ew':'ns';
     const nextNode=c.path[c.i+2];
     // Do not enter unless there is enough space to leave and release this junction.
     const occupied=nextNode && this.cars.some(o=>o!==c&&!o.done&&o.path[o.i]===b&&o.path[o.i+1]===nextNode&&o.p<GAP+JUNCTION_CLEAR+SPEED*dt);
     const locked=this.junctions.has(b)&&this.locks.has(b)&&this.locks.get(b)!==c.id;
     const red=light&&!C.green(light,this.time,axis);
     if(red||occupied||locked)max=Math.min(max,0.7);
     else if(max>=0.7){c.admitted=true;if(this.junctions.has(b)){if(c.lock)this.locks.delete(c.lock);this.locks.set(b,c.id);c.lock=b;}}
    }
    next=Math.max(c.p,Math.min(next,max));c.waiting=next-c.p<SPEED*dt*0.25;c.p=next;
    if(c.p>=1){
     c.p-=1;c.i++;c.admitted=false;
     if(c.i>=c.path.length-1){c.done=true;this.arrived++;this.totalTravel+=this.time-c.born;const end=c.path.at(-1);this.destinations[end]=(this.destinations[end]||0)+1;if(c.lock)this.locks.delete(c.lock);}
    }
   }
   this.cars=this.cars.filter(c=>!c.done);
   for(let i=0;i<this.map.sources.length;i++){
    this.clocks[i]-=dt;const choices=this.paths[i];if(this.clocks[i]>0||!choices.length)continue;
    // Choose once per car, keeping its destination while it waits to spawn.
    if(!this.pending[i]){const exits=[...new Set(choices.map(p=>p.at(-1)))],end=exits[Math.floor(this.random()*exits.length)],routes=choices.filter(p=>p.at(-1)===end);this.pending[i]=routes.length===1?routes[0]:routes[Math.floor(this.random()*routes.length)];}
    if(!this.manual[i]&&this.time>=this.replanAt[i]){this.pending[i]=this.autoRoute(i,this.pending[i].at(-1))||this.pending[i];this.replanAt[i]=this.time+0.5;}
    const path=this.pending[i];
    if(this.cars.some(c=>c.path[c.i]===path[0]&&c.path[c.i+1]===path[1]&&c.p<GAP))continue;
    this.cars.push({id:this.nextId++,path,i:0,p:0,born:this.time,waiting:false,admitted:false,lock:null,source:i,nextPlanAt:this.time+1,reroutes:0});this.pending[i]=null;this.replanAt[i]=0;this.clocks[i]=60/this.map.demand;
   }
  }
 }
 return {Simulation,GAP,SPEED,JUNCTION_CLEAR};
});

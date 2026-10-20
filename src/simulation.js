(function(root,factory){const api=factory(typeof module==='object'?require('./core.js'):root.TrafficCore);if(typeof module==='object')module.exports=api;else root.TrafficSim=api;})(typeof globalThis!=='undefined'?globalThis:this,function(C){
 'use strict';
 const GAP=0.44,SPEED=1.15;
 class Simulation{
  constructor(map,random=Math.random){this.map=map;this.random=random;this.graph=C.adjacency(map);this.paths=map.sources.map(s=>C.exitRoutes(map,s.node,this.graph));this.junctions=new Set(C.nodes(map).filter(n=>C.neighbors(map,n,false).length>=3&&!C.bridgeAt(map,n)));this.reset();}
  reset(){this.cars=[];this.time=0;this.arrived=0;this.totalTravel=0;this.nextId=1;this.destinations={};this.locks=new Map();this.clocks=this.map.sources.map((_,i)=>i*0.6);this.pending=this.map.sources.map(()=>null);this.accumulator=0;}
  get average(){return this.arrived?this.totalTravel/this.arrived:0;}
  get waiting(){return this.cars.filter(c=>c.waiting).length;}
  get blockedSources(){return this.map.sources.filter((_,i)=>!this.paths[i].length);}
  advance(dt){this.accumulator+=Math.max(0,dt);while(this.accumulator>=1/30-1e-9){this.step(1/30);this.accumulator-=1/30;}}
  step(dt){
   this.time+=dt;
   // Older cars move first, so queues follow leaders without overtaking.
   for(const c of this.cars){
    if(c.done)continue;
    if(c.lock && c.path[c.i]===c.lock && c.p>=0.3){this.locks.delete(c.lock);c.lock=null;}
    const a=c.path[c.i],b=c.path[c.i+1];let max=1;
    for(const o of this.cars)if(o!==c&&!o.done&&o.path[o.i]===a&&o.path[o.i+1]===b&&o.p>c.p)max=Math.min(max,o.p-GAP);
    let next=c.p+SPEED*dt;
    if(!c.admitted && next>=0.7){
     const light=this.map.signals.find(s=>s.node===b);const axis=C.xy(a)[1]===C.xy(b)[1]?'ew':'ns';
     const nextNode=c.path[c.i+2];
     const occupied=nextNode && this.cars.some(o=>o!==c&&!o.done&&o.path[o.i]===b&&o.path[o.i+1]===nextNode&&o.p<GAP+0.03);
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
    this.clocks[i]-=dt;const choices=this.paths[i];if(this.clocks[i]>0||!choices.length||this.cars.length>=180)continue;
    // Choose once per car, keeping its destination while it waits to spawn.
    const path=this.pending[i]||(this.pending[i]=choices[Math.floor(this.random()*choices.length)]);
    if(this.cars.some(c=>c.path[c.i]===path[0]&&c.path[c.i+1]===path[1]&&c.p<GAP))continue;
    this.cars.push({id:this.nextId++,path,i:0,p:0,born:this.time,waiting:false,admitted:false,lock:null,source:i});this.pending[i]=null;this.clocks[i]=60/this.map.demand;
   }
  }
 }
 return {Simulation,GAP,SPEED};
});

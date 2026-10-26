(function(root,factory){const api=factory(typeof module==='object'?require('./core.js'):root.TrafficCore);if(typeof module==='object')module.exports=api;else root.TrafficMetro=api;})(typeof globalThis!=='undefined'?globalThis:this,function(C){
 'use strict';
 const SPEED=1.15,COACH_SPACING=0.4,COACH_LENGTH=0.34,GAP=0.44,CLEAR=0.3,DWELL=2;
 const halfLength=m=>((m.trainCars??6)-1)*COACH_SPACING/2+COACH_LENGTH/2;
 function stops(m,path){const half=halfLength(m),end=path.length-1;return path.flatMap((node,index)=>m.stations.includes(node)?[{node,index,position:Math.max(half,Math.min(end-half,index))}]:[]);}
 function analyse(m){
  const lines=[],issues=[],half=halfLength(m);
  for(const [index,r] of m.routes.entries()){
   const p=r.nodes;
   if(!m.stations.includes(p[0])||!m.stations.includes(p.at(-1))||p[0]===p.at(-1)||!C.canFollow(m,p)||!C.canFollow(m,[...p].reverse())){issues.push('线路 '+(index+1)+' 不能沿原路往返，请检查站台、方向和断线');continue;}
   if(p.length-1<half*2+0.1){issues.push('线路 '+(index+1)+' 太短，容不下 '+(m.trainCars??6)+' 节车厢');continue;}
   lines.push({index,nodes:[...p],stops:stops(m,p)});
  }
  return {lines,issues};
 }
 class MetroSimulation{
  constructor(map){this.map=map;const info=analyse(map);this.lines=info.lines;this.issues=info.issues;this.half=halfLength(map);this.junctions=new Set(C.nodes(map).filter(n=>C.neighbors(map,n,false).length>=3&&!C.bridgeAt(map,n)));this.reset();}
  reset(){
   this.time=0;this.accumulator=0;this.arrived=0;this.totalTravel=0;this.destinations={};this.locks=new Map();this.cars=[];this.trainCount=Math.floor(this.map.stations.length/3);this.nextId=this.trainCount+1;this.turnarounds=0;this.rerouted=0;this.releasedQueues=0;this.reversed=0;this.reverseCar=null;this.pending=this.map.sources.map(()=>null);this.pendingTrains=[];
   for(let i=0;i<this.trainCount;i++){
    const line=this.lines[i%this.lines.length];if(!line){this.pendingTrains.push({id:i+1,line:null});continue;}
    const ordinal=Math.floor(i/this.lines.length),count=Math.ceil((this.trainCount-i%this.lines.length)/this.lines.length),at=count===1?0:Math.round(ordinal*(line.stops.length-1)/(count-1)),direction=at===line.stops.length-1?-1:at===0?1:ordinal%2?-1:1;
    this.pendingTrains.push({id:i+1,line,at,direction});
   }
   this.dispatch();
  }
  get average(){return this.arrived?this.totalTravel/this.arrived:0;}
  get waiting(){return this.cars.filter(c=>c.waiting).length;}
  get blockedSources(){const used=new Set(this.lines.flatMap(l=>l.stops.map(s=>s.node)));return this.map.sources.filter(s=>!used.has(s.node));}
  requestReverse(){return null;}
  update(c){const length=c.path.length-1;c.i=Math.min(length-1,Math.max(0,Math.floor(c.s)));c.p=c.s-c.i;}
  parts(c){return Array.from({length:this.map.trainCars??6},(_,index)=>{const position=c.s+((this.map.trainCars??6)-1-2*index)*COACH_SPACING/2,i=Math.min(c.path.length-2,Math.max(0,Math.floor(position)));return {a:c.path[i],b:c.path[i+1],p:position-i,index};});}
  intervals(c,position=c.s){
   const out=[],lo=Math.max(0,position-this.half),hi=Math.min(c.path.length-1,position+this.half);
   for(let i=Math.floor(lo);i<Math.ceil(hi);i++)if(c.path[i+1])out.push({id:c.id,a:c.path[i],b:c.path[i+1],lo:Math.max(0,lo-i),hi:Math.min(1,hi-i)});return out;
  }
  occupancy(){return this.cars.flatMap(c=>this.intervals(c));}
  bodyFits(c){
   const low=c.s-this.half,high=c.s+this.half;
   return !this.occupancy().some(o=>o.id!==c.id&&c.path.some((a,j)=>a===o.a&&c.path[j+1]===o.b&&high+GAP>j+o.lo+1e-8&&j+o.hi+GAP>low+1e-8));
  }
  occupiedNodes(c,position=c.s){const result=[];for(let i=Math.max(0,Math.ceil(position-this.half-CLEAR));i<=Math.min(c.path.length-1,Math.floor(position+this.half+CLEAR));i++)if(this.junctions.has(c.path[i]))result.push(c.path[i]);return result;}
  reserve(c){const nodes=this.occupiedNodes(c);if(nodes.some(n=>this.locks.has(n)&&this.locks.get(n)!==c.id))return false;for(const n of nodes)this.locks.set(n,c.id);return true;}
  release(c){const held=new Set(this.occupiedNodes(c));for(const [node,id] of this.locks)if(id===c.id&&!held.has(node))this.locks.delete(node);}
  dispatch(){
   this.pendingTrains=this.pendingTrains.filter(d=>{
    if(!d.line)return true;const path=d.direction===1?[...d.line.nodes]:[...d.line.nodes].reverse(),station=d.line.stops[d.at].node,ss=stops(this.map,path),at=ss.findIndex(s=>s.node===station),c={id:d.id,line:d.line.index,source:d.line.index,path,direction:d.direction,s:ss[at].position,stops:ss,nextStop:at+1,station,born:this.time,dwellUntil:this.time+DWELL,departed:false,waiting:true,signals:new Set()};this.update(c);
    if(!this.bodyFits(c)||!this.reserve(c))return true;this.cars.push(c);return false;
   });
  }
  turn(c){
   const next={...c,path:[...c.path].reverse(),s:c.path.length-1-c.s,direction:-c.direction};next.stops=stops(this.map,next.path);next.nextStop=1;
   if(!this.bodyFits(next)||!this.reserve(next))return false;Object.assign(c,next);c.signals.clear();this.update(c);this.turnarounds++;return true;
  }
  advance(dt){this.accumulator+=Math.max(0,dt);while(this.accumulator>=1/30-1e-9){this.step(1/30);this.accumulator-=1/30;}}
  step(dt){
   this.time+=dt;this.dispatch();
   for(const c of this.cars){
    if(this.time<c.dwellUntil){c.waiting=true;continue;}
    if(c.nextStop>=c.stops.length&&!this.turn(c)){c.waiting=true;continue;}
    if(!c.departed){c.lastDeparture=this.time;c.departed=true;c.station=null;}
    let next=Math.min(c.s+SPEED*dt,c.stops[c.nextStop].position);
    const front=c.s+this.half;
    // Match occupied directed track segments, including other hand-drawn lines.
    for(const o of this.occupancy()){
     if(o.id===c.id)continue;
     for(let j=Math.max(0,Math.floor(front-GAP));j<Math.min(c.path.length-1,Math.ceil(next+this.half+GAP));j++)if(c.path[j]===o.a&&c.path[j+1]===o.b&&j+o.hi>=front-1e-8)next=Math.min(next,j+o.lo-GAP-this.half);
    }
    for(let j=Math.max(0,Math.ceil(front-CLEAR));j<=Math.min(c.path.length-1,Math.floor(next+this.half+CLEAR));j++){
     const node=c.path[j];if(this.junctions.has(node)&&this.locks.has(node)&&this.locks.get(node)!==c.id)next=Math.min(next,j-CLEAR-this.half);
     const light=this.map.signals.find(s=>s.node===node);
     if(light&&!c.signals.has(node)&&j>0){const axis=C.xy(c.path[j-1])[1]===C.xy(node)[1]?'ew':'ns';if(!C.green(light,this.time,axis))next=Math.min(next,j-CLEAR-this.half);else c.signals.add(node);}
    }
    next=Math.max(c.s,next);const before=c.s;c.s=next;
    if(!this.reserve(c))c.s=before;
    this.update(c);this.release(c);c.waiting=c.s-before<SPEED*dt*0.25;
    if(c.s>=c.stops[c.nextStop].position-1e-8){
     const station=c.stops[c.nextStop].node;c.station=station;c.nextStop++;c.dwellUntil=this.time+DWELL;c.departed=false;c.waiting=true;this.arrived++;this.totalTravel+=this.time-c.lastDeparture;this.destinations[station]=(this.destinations[station]||0)+1;
    }
   }
  }
 }
 return {MetroSimulation,analyse,halfLength,COACH_SPACING,COACH_LENGTH,SPEED,DWELL};
});

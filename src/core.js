(function(root,factory){ const api=factory(); if(typeof module==='object')module.exports=api; else root.TrafficCore=api; })(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const COLS=25, ROWS=17;
 const xy=id=>id.split(',').map(Number);
 const valid=id=>typeof id==='string' && /^(0|[1-9]\d*),(0|[1-9]\d*)$/.test(id) && xy(id)[0]<COLS && xy(id)[1]<ROWS;
 const key=(a,b)=>a<b?a+'|'+b:b+'|'+a;
 const empty=()=>({version:1,roads:[],sources:[],exits:[],signals:[],demand:18});
 function line(a,b){
  if(!valid(a)||!valid(b))throw Error('道路坐标超出地图');
  const [x,y]=xy(a),[tx,ty]=xy(b),out=[a]; let cx=x,cy=y;
  while(cx!==tx){cx+=Math.sign(tx-cx);out.push(cx+','+cy);}
  while(cy!==ty){cy+=Math.sign(ty-cy);out.push(cx+','+cy);}
  return out;
 }
 function setDirection(r,dir){if(!['both','forward','reverse'].includes(dir))throw Error('无效道路方向');r.dir=dir;}
 function draw(m,a,b,dir='both'){
  if(!['both','forward','reverse'].includes(dir))throw Error('无效道路方向');
  const points=line(a,b);
  for(let i=1;i<points.length;i++){
   let a=points[i-1],b=points[i],d=dir;
   if(a>b){[a,b]=[b,a];d=dir==='both'?'both':dir==='forward'?'reverse':'forward';}
   const old=m.roads.find(r=>key(r.a,r.b)===key(a,b));
   if(old)old.dir=d;else m.roads.push({a,b,dir:d});
  }
  return m;
 }
 function nodes(m){return [...new Set(m.roads.flatMap(r=>[r.a,r.b]))];}
 function neighbors(m,node,directed=true){
  const out=[];
  for(const r of m.roads){
   if(r.a===node && (!directed||r.dir!=='reverse'))out.push(r.b);
   if(r.b===node && (!directed||r.dir!=='forward'))out.push(r.a);
  }
  return out;
 }
 function adjacency(m){const graph=new Map(nodes(m).map(n=>[n,[]]));for(const r of m.roads){if(r.dir!=='reverse')graph.get(r.a).push(r.b);if(r.dir!=='forward')graph.get(r.b).push(r.a);}return graph;}
 function route(m,start,target='',graph=adjacency(m)){
  const goals=new Set(target?[target]:m.exits); if(!graph.has(start)||goals.size===0)return null;
  const queue=[start],prev=new Map([[start,null]]);
  for(let i=0;i<queue.length;i++){
   const n=queue[i];if(goals.has(n)&&n!==start){const path=[];let at=n;while(at!==null){path.push(at);at=prev.get(at);}return path.reverse();}
   for(const next of graph.get(n)||[])if(!prev.has(next)){prev.set(next,n);queue.push(next);}
  }
  return null;
 }
 function exitRoutes(m,start,graph=adjacency(m)){
  if(!graph.has(start))return [];
  const queue=[start],prev=new Map([[start,null]]);
  for(let i=0;i<queue.length;i++)for(const next of graph.get(queue[i])||[])if(!prev.has(next)){prev.set(next,queue[i]);queue.push(next);}
  return m.exits.filter(n=>n!==start&&prev.has(n)).map(end=>{const out=[];let at=end;while(at!==null){out.push(at);at=prev.get(at);}return out.reverse();});
 }
 function cleanup(m){
  const alive=new Set(nodes(m));m.exits=m.exits.filter(n=>alive.has(n));
  m.sources=m.sources.filter(s=>alive.has(s.node)&&!m.exits.includes(s.node));
  for(const s of m.sources)s.target='';
  m.signals=m.signals.filter(s=>alive.has(s.node));
 }
 function eraseNode(m,node){m.roads=m.roads.filter(r=>r.a!==node&&r.b!==node);cleanup(m);}
 function green(s,time,axis){
  const phase=((time+s.offset)%(2*(s.cycle+1))+2*(s.cycle+1))%(2*(s.cycle+1));
  return axis==='ew'?phase<s.cycle:phase>=s.cycle+1&&phase<2*s.cycle+1;
 }
 function validate(v){
  const fail=()=>{throw Error('方案格式无效：请导入路流导出的 JSON 文件');};
  if(!v||v.version!==1||!Array.isArray(v.roads)||!Array.isArray(v.sources)||!Array.isArray(v.exits)||!Array.isArray(v.signals))fail();
  if(v.roads.length>808||v.sources.length>425||v.exits.length>425||v.signals.length>425||!Number.isFinite(v.demand)||v.demand<2||v.demand>60)fail();
  const m=empty(),seen=new Set();
  for(const r of v.roads){
   if(!r||!valid(r.a)||!valid(r.b)||!['both','forward','reverse'].includes(r.dir)||seen.has(key(r.a,r.b)))fail();
   const a=xy(r.a),b=xy(r.b);if(Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1])!==1)fail();
   seen.add(key(r.a,r.b));m.roads.push({a:r.a,b:r.b,dir:r.dir});
  }
  const alive=new Set(nodes(m));const unique=(arr)=>new Set(arr).size===arr.length;
  if(!unique(v.exits)||!v.exits.every(n=>alive.has(n)))fail();m.exits=[...v.exits];
  if(!unique(v.sources.map(s=>s?.node))||!unique(v.signals.map(s=>s?.node)))fail();
  for(const s of v.sources){if(!s||!alive.has(s.node)||m.exits.includes(s.node)||typeof s.target!=='string'||s.target!==''&&!m.exits.includes(s.target))fail();m.sources.push({node:s.node,target:''});}
  for(const s of v.signals){if(!s||!alive.has(s.node)||!Number.isFinite(s.cycle)||s.cycle<3||s.cycle>20||!Number.isFinite(s.offset)||s.offset<0||s.offset>42)fail();m.signals.push({node:s.node,cycle:s.cycle,offset:s.offset});}
  m.demand=v.demand;return m;
 }
 function demo(){
  const m=empty();
  draw(m,'1,8','23,8');draw(m,'12,1','12,15');
  draw(m,'5,4','19,4');draw(m,'5,12','19,12');draw(m,'5,4','5,12');draw(m,'19,4','19,12');
  m.sources=[{node:'1,8',target:''},{node:'12,1',target:''},{node:'5,12',target:''}];
  m.exits=['23,8','12,15','19,4'];m.signals=[{node:'12,8',cycle:6,offset:0},{node:'5,8',cycle:6,offset:3},{node:'19,8',cycle:6,offset:7}];return m;
 }
 return {COLS,ROWS,xy,valid,key,empty,line,draw,setDirection,nodes,neighbors,adjacency,route,exitRoutes,cleanup,eraseNode,green,validate,demo};
});

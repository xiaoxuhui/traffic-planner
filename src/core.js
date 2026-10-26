(function(root,factory){ const api=factory(); if(typeof module==='object')module.exports=api; else root.TrafficCore=api; })(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const COLS=25, ROWS=17,MIN_LEVEL=-8,MAX_LEVEL=8;
 const xy=id=>id.split('@')[0].split(',').map(Number);
 const level=id=>Number(id.split('@')[1]||0);
 const valid=id=>typeof id==='string' && /^(0|[1-9]\d*),(0|[1-9]\d*)(@-?[1-8])?$/.test(id) && xy(id)[0]<COLS && xy(id)[1]<ROWS;
 function node(x,y,z=0){const n=x+','+y+(z?'@'+z:'');if(!Number.isInteger(z)||!valid(n))throw Error('道路坐标或高度超出范围');return n;}
 const adjacent=(a,b)=>{const [x,y]=xy(a),[u,v]=xy(b);return Math.abs(x-u)+Math.abs(y-v)===1&&Math.abs(level(a)-level(b))<=1;};
 const key=(a,b)=>a<b?a+'|'+b:b+'|'+a;
 function empty(mode='road'){const m={version:1,roads:[],sources:[],exits:[],signals:[],bridges:[],routes:[],demand:18};if(mode==='metro')Object.assign(m,{mode:'metro',stations:[],trainCars:6});return m;}
 function syncStations(m){m.sources=m.stations.map(node=>({node,target:''}));m.exits=[...m.stations];}
 function addStation(m,node){if(m.mode!=='metro'||!nodes(m).includes(node)||bridgeAt(m,node))throw Error('请在轨道节点上放置站台，避开旧式跨线点');if(!m.stations.includes(node))m.stations.push(node);syncStations(m);return m;}
 function removeStation(m,node){m.stations=m.stations.filter(n=>n!==node);syncStations(m);cleanup(m);}
 function line(a,b){
  if(!valid(a)||!valid(b))throw Error('道路坐标超出地图');
  if(level(a)!==level(b))throw Error('不同高度请使用坡道连接');
  const [x,y]=xy(a),[tx,ty]=xy(b),out=[a]; let cx=x,cy=y;
  while(cx!==tx){cx+=Math.sign(tx-cx);out.push(node(cx,cy,level(a)));}
  while(cy!==ty){cy+=Math.sign(ty-cy);out.push(node(cx,cy,level(a)));}
  return out;
 }
 function setDirection(r,dir){if(!['both','forward','reverse'].includes(dir))throw Error('无效道路方向');r.dir=dir;}
 function putRoad(m,a,b,dir){if(a>b){[a,b]=[b,a];dir=dir==='both'?'both':dir==='forward'?'reverse':'forward';}const old=m.roads.find(r=>key(r.a,r.b)===key(a,b));if(old)old.dir=dir;else m.roads.push({a,b,dir});}
 function ramp(m,a,b,dir='both'){
  if(!valid(a)||!valid(b)||Math.abs(level(a)-level(b))!==1||!['both','forward','reverse'].includes(dir))throw Error('坡道需要连接相邻的两个高度');
  const flat=line(a,node(...xy(b),level(a)));if(flat.length<2)throw Error('坡道需要至少一格平面长度');
  const points=flat.map((n,i)=>node(...xy(n),i>=Math.ceil((flat.length-1)/2)?level(b):level(a)));
  for(let i=1;i<points.length;i++)putRoad(m,points[i-1],points[i],dir);return m;
 }
 function draw(m,a,b,dir='both',options={}){
  if(!['both','forward','reverse'].includes(dir))throw Error('无效道路方向');
  const points=line(a,b),oldNeighbors=new Map(points.map(n=>[n,neighbors(m,n,false)]));
  for(let i=1;i<points.length;i++){
   putRoad(m,points[i-1],points[i],dir);
  }
  if(options.crossing){
   const explicit=new Set(options.crossing==='connect'?points:[a,b]);m.bridges=(m.bridges||[]).filter(b=>!explicit.has(b.node));
   if(options.crossing!=='connect')for(let i=1;i<points.length-1;i++){
    const node=points[i],[px,py]=xy(points[i-1]),[cx,cy]=xy(node),[nx,ny]=xy(points[i+1]);if(nx-cx!==cx-px||ny-cy!==cy-py)continue;
    const axis=px===cx?'ns':'ew',old=oldNeighbors.get(node),perpendicular=old.filter(n=>level(n)===level(node)&&(axis==='ew'?xy(n)[0]===cx:xy(n)[1]===cy));
    if(perpendicular.length===2&&neighbors(m,node,false).length===4&&!m.exits.includes(node)&&!m.sources.some(s=>s.node===node))setBridge(m,node,options.crossing==='over'?axis:axis==='ew'?'ns':'ew');
   }
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
 const bridgeAt=(m,node)=>(m.bridges||[]).find(b=>b.node===node);
 function setBridge(m,node,over='ew'){
  if(!['ew','ns'].includes(over))throw Error('请选择东西或南北道路在上');
  if(neighbors(m,node,false).length!==4||neighbors(m,node,false).some(n=>level(n)!==level(node)))throw Error('请先画出同高度十字交叉的两条道路，再点击交叉点建桥');
  if(m.exits.includes(node)||m.sources.some(s=>s.node===node))throw Error('请把入口或出口放在跨线点之外');
  if(!m.bridges)m.bridges=[];const old=bridgeAt(m,node);if(old)old.over=over;else m.bridges.push({node,over});
  m.signals=m.signals.filter(s=>s.node!==node);
 }
 function search(m,start,graph){
  const first=new Map();if(!graph.has(start))return first;
  const bridges=new Set((m.bridges||[]).map(b=>b.node)),head={node:start,parent:null},queue=[head],seen=new Set([start]);first.set(start,head);
  for(let i=0;i<queue.length;i++){
   const cur=queue[i];
   for(const next of graph.get(cur.node)||[]){
    if(bridges.has(cur.node)&&cur.parent){const [px,py]=xy(cur.parent.node),[cx,cy]=xy(cur.node),[nx,ny]=xy(next);if(nx-cx!==cx-px||ny-cy!==cy-py)continue;}
    // At a bridge, entering from a different direction is a distinct state.
    const state=bridges.has(next)?cur.node+'>'+next:next;if(seen.has(state))continue;seen.add(state);
    const record={node:next,parent:cur};queue.push(record);if(!first.has(next))first.set(next,record);
   }
  }
  return first;
 }
 function reconstruct(record){const out=[];for(let at=record;at;at=at.parent)out.push(at.node);return out.reverse();}
 function weightedRoute(m,start,target,edgeCost=()=>1,graph=adjacency(m),options={}){
  if(!graph.has(start)||start===target)return null;
  const bridges=new Set((m.bridges||[]).map(b=>b.node)),best=new Map([[start,0]]),heap=[];
  function push(item){heap.push(item);let i=heap.length-1;while(i>0){const p=(i-1)>>1;if(heap[p].cost<=item.cost)break;heap[i]=heap[p];i=p;}heap[i]=item;}
  function pop(){const first=heap[0],last=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let child=i*2+1;if(child+1<heap.length&&heap[child+1].cost<heap[child].cost)child++;if(heap[child].cost>=last.cost)break;heap[i]=heap[child];i=child;}heap[i]=last;}return first;}
  push({node:start,parent:null,key:start,cost:0});
  while(heap.length){
   const cur=pop();if(cur.cost!==best.get(cur.key))continue;if(cur.node===target)return reconstruct(cur);
   const previous=cur.parent?.node??options.previous;
   for(const next of graph.get(cur.node)||[]){
    if(next===previous||options.blocked?.has(next))continue;
    if(bridges.has(cur.node)&&previous){const [px,py]=xy(previous),[cx,cy]=xy(cur.node),[nx,ny]=xy(next);if(nx-cx!==cx-px||ny-cy!==cy-py)continue;}
    const weight=edgeCost(cur.node,next,cur.cost);if(!Number.isFinite(weight)||weight<0)throw Error('道路通行代价必须为非负有限数');
    const key=bridges.has(next)?cur.node+'>'+next:next,cost=cur.cost+weight;
    if(cost<(best.get(key)??Infinity)){best.set(key,cost);push({node:next,parent:cur,key,cost});}
   }
  }
  return null;
 }
 function route(m,start,target='',graph=adjacency(m)){
  const goals=new Set(target?[target]:m.exits);for(const [node,record] of search(m,start,graph))if(node!==start&&goals.has(node))return reconstruct(record);return null;
 }
 function exitRoutes(m,start,graph=adjacency(m)){
  const planned=(m.routes||[]).filter(r=>r.nodes[0]===start);if(planned.length)return planned.filter(r=>m.exits.includes(r.nodes.at(-1))&&canFollow(m,r.nodes,graph)).map(r=>[...r.nodes]);
  const found=search(m,start,graph);return m.exits.filter(n=>n!==start&&found.has(n)).map(n=>reconstruct(found.get(n)));
 }
 function canFollow(m,points,graph=adjacency(m)){
  if(!Array.isArray(points)||points.length<1||points.length>1200||!points.every(valid))return false;
  for(let i=1;i<points.length;i++){
   if(!(graph.get(points[i-1])||[]).includes(points[i]))return false;
   if(i>1){if(points[i]===points[i-2])return false;if(bridgeAt(m,points[i-1])){const [px,py]=xy(points[i-2]),[cx,cy]=xy(points[i-1]),[nx,ny]=xy(points[i]);if(nx-cx!==cx-px||ny-cy!==cy-py)return false;}}
  }
  return true;
 }
 function addRoute(m,points){
  if(!m.sources.some(s=>s.node===points[0])||!m.exits.includes(points.at(-1))||points.length<2||!canFollow(m,points))throw Error('路线不通：请沿道路方向逐段连接，不能掉头或跨层转弯');
  if(!m.routes)m.routes=[];if(m.routes.length>=64)throw Error('最多保存 64 条行驶路线');
  if(!m.routes.some(r=>r.nodes.join('|')===points.join('|')))m.routes.push({nodes:[...points]});
 }
 function cleanup(m){
  const alive=new Set(nodes(m));m.exits=m.exits.filter(n=>alive.has(n));
  if(m.mode==='metro'){m.stations=m.stations.filter(n=>alive.has(n));syncStations(m);}else m.sources=m.sources.filter(s=>alive.has(s.node)&&!m.exits.includes(s.node));
  for(const s of m.sources)s.target='';
  m.signals=m.signals.filter(s=>alive.has(s.node));
  m.bridges=(m.bridges||[]).filter(b=>neighbors(m,b.node,false).length===4);
  m.routes=(m.routes||[]).filter(r=>m.sources.some(s=>s.node===r.nodes[0]));
 }
 function eraseNode(m,node){m.roads=m.roads.filter(r=>r.a!==node&&r.b!==node);cleanup(m);}
 function green(s,time,axis){
  const phase=((time+s.offset)%(2*(s.cycle+1))+2*(s.cycle+1))%(2*(s.cycle+1));
  return axis==='ew'?phase<s.cycle:phase>=s.cycle+1&&phase<2*s.cycle+1;
 }
 function validate(v){
  const fail=()=>{throw Error('方案格式无效：请导入路流导出的 JSON 文件');};
  if(!v||v.version!==1||!Array.isArray(v.roads)||!Array.isArray(v.sources)||!Array.isArray(v.exits)||!Array.isArray(v.signals))fail();
  if(v.roads.length>808*17||v.sources.length>425||v.exits.length>425||v.signals.length>425||!Number.isFinite(v.demand)||v.demand<2||v.demand>60)fail();
  if(v.mode!==undefined&&!['road','metro'].includes(v.mode))fail();
  const m=empty(v.mode),seen=new Set();
  for(const r of v.roads){
   if(!r||!valid(r.a)||!valid(r.b)||!['both','forward','reverse'].includes(r.dir)||seen.has(key(r.a,r.b)))fail();
   if(!adjacent(r.a,r.b))fail();
   seen.add(key(r.a,r.b));m.roads.push({a:r.a,b:r.b,dir:r.dir});
  }
  const alive=new Set(nodes(m));const unique=(arr)=>new Set(arr).size===arr.length;
  if(!unique(v.exits)||!v.exits.every(n=>alive.has(n)))fail();m.exits=[...v.exits];
  if(!unique(v.sources.map(s=>s?.node))||!unique(v.signals.map(s=>s?.node)))fail();
  for(const s of v.sources){if(!s||!alive.has(s.node)||m.mode!=='metro'&&m.exits.includes(s.node)||typeof s.target!=='string'||s.target!==''&&!m.exits.includes(s.target))fail();m.sources.push({node:s.node,target:''});}
  if(m.mode==='metro'){
   if(!Array.isArray(v.stations)||v.stations.length>425||!unique(v.stations)||!v.stations.every(n=>alive.has(n))||!Number.isInteger(v.trainCars??6)||(v.trainCars??6)<1||(v.trainCars??6)>12)fail();
   m.stations=[...v.stations];m.trainCars=v.trainCars??6;if(m.sources.length!==m.stations.length||m.exits.length!==m.stations.length||m.stations.some(n=>!m.exits.includes(n)||!m.sources.some(s=>s.node===n)))fail();syncStations(m);
  }
  for(const s of v.signals){if(!s||!alive.has(s.node)||!Number.isFinite(s.cycle)||s.cycle<3||s.cycle>20||!Number.isFinite(s.offset)||s.offset<0||s.offset>42)fail();m.signals.push({node:s.node,cycle:s.cycle,offset:s.offset});}
  const bridges=v.bridges===undefined?[]:v.bridges;if(!Array.isArray(bridges)||bridges.length>425||!unique(bridges.map(b=>b?.node)))fail();
  for(const b of bridges){if(!b||!valid(b.node)||!['ew','ns'].includes(b.over)||neighbors(m,b.node,false).length!==4||neighbors(m,b.node,false).some(n=>level(n)!==level(b.node))||m.exits.includes(b.node)||m.sources.some(s=>s.node===b.node)||m.signals.some(s=>s.node===b.node))fail();m.bridges.push({node:b.node,over:b.over});}
  const routes=v.routes===undefined?[]:v.routes;if(!Array.isArray(routes)||routes.length>64)fail();
  for(const r of routes){if(!r||!Array.isArray(r.nodes)||r.nodes.length<2||r.nodes.length>1200||!r.nodes.every(valid)||!m.sources.some(s=>s.node===r.nodes[0]))fail();for(let i=1;i<r.nodes.length;i++)if(!adjacent(r.nodes[i-1],r.nodes[i])||i>1&&r.nodes[i]===r.nodes[i-2])fail();m.routes.push({nodes:[...r.nodes]});}
  m.demand=v.demand;return m;
 }
 function demo(){
  const m=empty();
  draw(m,'1,8','23,8');draw(m,'12,1','12,15');
  draw(m,'5,4','19,4');draw(m,'5,12','19,12');draw(m,'5,4','5,12');draw(m,'19,4','19,12');
  m.sources=[{node:'1,8',target:''},{node:'12,1',target:''},{node:'5,12',target:''}];
  m.exits=['23,8','12,15','19,4'];m.signals=[{node:'12,8',cycle:6,offset:0},{node:'5,8',cycle:6,offset:3},{node:'19,8',cycle:6,offset:7}];return m;
 }
 return {COLS,ROWS,MIN_LEVEL,MAX_LEVEL,xy,level,node,valid,key,empty,line,draw,ramp,setDirection,nodes,neighbors,adjacency,route,weightedRoute,exitRoutes,canFollow,addRoute,addStation,removeStation,bridgeAt,setBridge,cleanup,eraseNode,green,validate,demo};
});

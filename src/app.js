/* Road editing and UI coordination. All graph and driving rules live in core/simulation. */
(function(){
 'use strict';
 const C=window.TrafficCore,{Simulation}=window.TrafficSim,$=id=>document.getElementById(id),NS='http://www.w3.org/2000/svg';
 const STORE='flow-traffic-layout-v1', tools=['select','road','direction','signal','source','exit','erase','bridge'];
 const hints={select:'点击入口查看随机分流路线；点击道路或红绿灯，调整它的设置。',road:'拖动绘制道路，或依次点击起点与终点。交叉处自动连接。',direction:'点击道路中间，依次切换正向、反向、双向通行。箭头即行驶方向。',signal:'点击道路节点添加红绿灯；选择灯后可调整绿灯时长与初始相位。',source:'点击道路节点设置入口。每辆车出发时，会从所有可达出口里随机选一个。',exit:'点击道路节点设置出口。车辆会随机选择能到达的出口。',erase:'点击路段拆路；点击节点优先拆除入口、出口或灯，再拆除相连道路。'};
 hints.bridge='点击十字交叉点建桥，再次点击切换哪条路在上。桥上桥下独立直行，不能在这里转弯。';
 let map=C.empty(),tool='road',drawDir='both',anchor=null,hover=null,selection=null,running=false,speed=1,showGrid=true,undo=[],redo=[],toastTimer,keyboardNode='12,8',pointerStart=null;
 try{const saved=localStorage.getItem(STORE);if(saved)map=C.validate(JSON.parse(saved));}catch{setTimeout(()=>toast('未能读取本地方案，已打开空白地图'),100);}
 let sim=new Simulation(map),lastTime=0,lastStats=0;
 const pos=id=>{const [x,y]=C.xy(id);return [40+x*40,40+y*40];};
 const path=ids=>ids.map((id,i)=>(i?'L':'M')+pos(id).join(',')).join(' ');
 const sourceName=node=>String.fromCharCode(65+map.sources.findIndex(s=>s.node===node));
 const exitName=node=>'出口 '+(map.exits.indexOf(node)+1)+' · ('+node+')';
 const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function toast(text){$('toast').textContent=text;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3200);}
 function save(manual=false){try{localStorage.setItem(STORE,JSON.stringify(map));$('save-state').textContent='✓ 已保存到本地';if(manual)toast('方案已保存在此设备');}catch{$('save-state').textContent='保存不可用';toast('浏览器存储不可用，可导出 JSON 保存方案');}}
 function setRunning(on){
  running=on;$('run').innerHTML='<svg><use href="#i-'+(on?'pause':'play')+'"/></svg><span>'+(on?'暂停模拟':'开始模拟')+'</span>';
  $('mode-label').textContent=on?'模拟运行中':'规划模式';$('run-status').textContent=on?'车流运行中':'准备就绪';$('live-tag').textContent=on?'● 运行中':sim.time?'已暂停':'待运行';$('map').dataset.running=String(on);lastTime=0;
 }
 function edit(change,message){
  const before=JSON.stringify(map);change();C.cleanup(map);const after=JSON.stringify(map);if(before===after){renderInspector();renderPreview();return;}
  undo.push(before);if(undo.length>60)undo.shift();redo=[];setRunning(false);sim=new Simulation(map);anchor=null;save();render();if(message)toast(message);
 }
 function history(back){const from=back?undo:redo,to=back?redo:undo;if(!from.length)return;to.push(JSON.stringify(map));map=C.validate(JSON.parse(from.pop()));setRunning(false);sim=new Simulation(map);selection=null;anchor=null;save();render();toast(back?'已撤销':'已重做');}
 function switchTool(next){tool=next;anchor=null;hover=null;document.querySelectorAll('[data-tool]').forEach(b=>{const active=b.dataset.tool===tool;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});$('tool-hint').textContent=hints[tool];$('road-options').hidden=tool!=='road';$('road-options').style.display=tool==='road'?'':'none';renderPreview();}
 function roadAt(node){return map.roads.find(r=>r.a===node||r.b===node);}
 function inspectNode(node){
  selection=C.bridgeAt(map,node)?{type:'bridge',node}:map.sources.some(s=>s.node===node)?{type:'source',node}:map.signals.some(s=>s.node===node)?{type:'signal',node}:map.exits.includes(node)?{type:'exit',node}:{type:'node',node};renderInspector();renderPreview();
 }
 function activateNode(node){
  if(tool==='road'){
   if(anchor && anchor!==node){const a=anchor;selection=null;edit(()=>C.draw(map,a,node,drawDir),'道路已连接');}
   else{anchor=node;hover=node;renderPreview();toast('已选起点，请点击终点；Esc 取消');}return;
  }
  if(tool==='select'){inspectNode(node);return;}
  if(tool==='direction'){const r=roadAt(node);if(r)activateRoad(C.key(r.a,r.b));else toast('先绘制道路，再设置方向');return;}
  if(!C.nodes(map).includes(node)){toast('请先在这里绘制道路');return;}
  if(tool==='bridge'){
   try{const old=C.bridgeAt(map,node),over=old?.over==='ew'?'ns':'ew';selection={type:'bridge',node};edit(()=>C.setBridge(map,node,over),'已设为立交桥，桥上桥下独立直行');}catch(err){toast(err.message);}return;
  }
  if(C.bridgeAt(map,node)&&['signal','source','exit'].includes(tool)){toast('跨线点不互通，请把入口、出口或信号灯放在桥外的道路节点');return;}
  if(tool==='source'){
   if(map.exits.includes(node)){toast('这个节点已是出口，请选择其他道路节点');return;}
   selection={type:'source',node};edit(()=>{if(!map.sources.some(s=>s.node===node))map.sources.push({node,target:''});},'已设置入口，每辆车随机选择可达出口');
  }else if(tool==='exit'){
   if(map.sources.some(s=>s.node===node)){toast('这个节点已是入口，请选择其他道路节点');return;}
   selection={type:'exit',node};edit(()=>{if(!map.exits.includes(node))map.exits.push(node);},'已设置出口');
  }else if(tool==='signal'){
   selection={type:'signal',node};edit(()=>{if(!map.signals.some(s=>s.node===node))map.signals.push({node,cycle:6,offset:0});},'已放置信号灯');
  }else if(tool==='erase'){
   selection=null;edit(()=>{
    if(C.bridgeAt(map,node))map.bridges=map.bridges.filter(b=>b.node!==node);
    else if(map.sources.some(s=>s.node===node))map.sources=map.sources.filter(s=>s.node!==node);
    else if(map.exits.includes(node))map.exits=map.exits.filter(n=>n!==node);
    else if(map.signals.some(s=>s.node===node))map.signals=map.signals.filter(s=>s.node!==node);
    else C.eraseNode(map,node);
   },'已拆除，可撤销恢复');
  }
 }
 function activateRoad(key){
  const r=map.roads.find(r=>C.key(r.a,r.b)===key);if(!r)return;
  if(tool==='road')return;
  if(tool==='erase'){selection=null;edit(()=>{map.roads=map.roads.filter(r=>C.key(r.a,r.b)!==key);},'道路已拆除');return;}
  selection={type:'road',key};
  if(tool==='direction')edit(()=>C.setDirection(r,{both:'forward',forward:'reverse',reverse:'both'}[r.dir]),'已调整方向，箭头指示通行方向');
  else{renderInspector();renderPreview();}
 }
 function arrow(a,b,fraction,offset=0){const [ax,ay]=pos(a),[bx,by]=pos(b),angle=Math.atan2(by-ay,bx-ax)*180/Math.PI;const x=ax+(bx-ax)*fraction,y=ay+(by-ay)*fraction;return '<path d="m-3 -3 3 3-3 3" fill="none" stroke="#d7d5ad" stroke-width="1.4" opacity=".8" transform="translate('+x+' '+y+') rotate('+angle+') translate(0 '+offset+')"/>';}
 function renderRoads(){
  let outer='',inner='',lanes='',arrows='';
  map.roads.forEach(r=>{const d=path([r.a,r.b]);outer+='<path d="'+d+'"/>';inner+='<path d="'+d+'"/>';lanes+='<path d="'+d+'"/>';
   if(r.dir==='both'){arrows+=arrow(r.a,r.b,.5,6)+arrow(r.b,r.a,.5,6);}else arrows+=r.dir==='forward'?arrow(r.a,r.b,.5,0):arrow(r.b,r.a,.5,0);
  });
  const junctions=C.nodes(map).filter(n=>C.neighbors(map,n,false).length>=3).map(n=>{const [x,y]=pos(n);return '<rect x="'+(x-12)+'" y="'+(y-12)+'" width="24" height="24" rx="3" fill="#56645b"/>';}).join('');
  $('roads').innerHTML='<g fill="none" stroke="#86917c" stroke-width="30" stroke-linecap="round">'+outer+'</g><g fill="none" stroke="#56645b" stroke-width="26" stroke-linecap="round">'+inner+'</g><g fill="none" stroke="#c8c7a5" stroke-width=".8" stroke-dasharray="4 7" opacity=".6">'+lanes+'</g>'+junctions+arrows;
 }
 function renderMarkers(){
  let html='';
  map.sources.forEach((s,i)=>{const [x,y]=pos(s.node),letter=String.fromCharCode(65+i);html+='<g transform="translate('+x+' '+y+')"><circle r="17" fill="#263d2c" stroke="#b7e894" stroke-width="2"/><circle r="12" fill="#b7e894"/><text text-anchor="middle" y="4" fill="#263c25" font-size="11" font-weight="700">'+letter+'</text><rect x="-26" y="-42" width="52" height="18" rx="4" fill="#1b3224"/><text x="0" y="-30" text-anchor="middle" fill="#b7e894" font-size="9">入口 '+letter+'</text></g>';});
  map.exits.forEach((n,i)=>{const [x,y]=pos(n);html+='<g transform="translate('+x+' '+y+')"><circle r="16" fill="#26372b" stroke="#ecb17c" stroke-width="2"/><path d="M-7 0H7m-5-5 5 5-5 5" stroke="#ecb17c" stroke-width="2" fill="none"/><rect x="-26" y="-42" width="52" height="18" rx="4" fill="#352e24"/><text x="0" y="-30" text-anchor="middle" fill="#ecb17c" font-size="9">出口 '+(i+1)+'</text></g>';});
  map.signals.forEach(s=>{const [x,y]=pos(s.node);html+='<g transform="translate('+(x+13)+' '+(y-29)+')"><rect width="23" height="14" rx="5" fill="#17241e" stroke="#739b83"/><circle data-light-ew="'+s.node+'" cx="6.5" cy="7" r="3.3"/><circle data-light-ns="'+s.node+'" cx="16.5" cy="7" r="3.3"/></g>';});
  $('markers').innerHTML=html;
 }
 function renderBridges(){
  $('bridges').innerHTML=map.bridges.map(b=>{const [x,y]=pos(b.node);return '<g data-bridge="'+b.node+'" data-over="'+b.over+'" transform="translate('+x+' '+y+') rotate('+(b.over==='ew'?0:90)+')"><path d="M-32 -10H32V21H-32Z" fill="#10251c" opacity=".6"/><path d="M-34 13 -20 6H20L34 13V20L20 13H-20L-34 20Z" fill="#3c5045"/><path d="M-34 -13 -20 -20H20L34 -13V13L20 6H-20L-34 13Z" fill="#758276" stroke="#a4b49b" stroke-width="1"/><path d="M-34 -13 -20 -20H20L34 -13M-34 13 -20 6H20L34 13" stroke="#d7d7b1" stroke-width="2" fill="none"/><path d="M-34 0 -20 -7H20L34 0" fill="none" stroke="#e3dcac" stroke-width="1" stroke-dasharray="5 5"/><path d="M-17 -6 -13 -3 -9 -6M9 -9 13 -12 17 -9" fill="none" stroke="#e0e5c4" stroke-width="1.3"/><rect x="-23" y="17" width="5" height="6" rx="1" fill="#9aab93"/><rect x="18" y="17" width="5" height="6" rx="1" fill="#9aab93"/></g>';}).join('');
 }
 function renderHits(){
  let html=map.roads.map(r=>{const [ax,ay]=pos(r.a),[bx,by]=pos(r.b);return '<rect class="road-hit" data-road="'+C.key(r.a,r.b)+'" x="'+(Math.min(ax,bx)-9)+'" y="'+(Math.min(ay,by)-9)+'" width="'+(Math.abs(bx-ax)+18)+'" height="'+(Math.abs(by-ay)+18)+'" rx="4" fill="transparent" role="button" aria-label="道路 '+r.a+' 至 '+r.b+'"/>';}).join('');
  for(let y=0;y<C.ROWS;y++)for(let x=0;x<C.COLS;x++){const id=x+','+y,[px,py]=pos(id);const source=map.sources.some(s=>s.node===id),exit=map.exits.includes(id),signal=map.signals.some(s=>s.node===id);html+='<circle class="node-hit" data-node="'+id+'" cx="'+px+'" cy="'+py+'" r="13" role="button" tabindex="'+(id===keyboardNode?'0':'-1')+'" aria-label="网格 '+id+(source?'，入口 '+sourceName(id):exit?'，'+exitName(id):'')+(signal?'，信号灯':'')+'"/>';}
  $('hit-targets').innerHTML=html;
 }
 function renderPreview(){
  let d='';if(anchor){d='<path d="'+path(C.line(anchor,hover||anchor))+'" stroke="#c6f6a4" stroke-width="24" opacity=".35" stroke-linecap="round" fill="none"/><circle cx="'+pos(anchor)[0]+'" cy="'+pos(anchor)[1]+'" r="8" fill="#d4ffb6"/>';}$('draw-preview').innerHTML=d;
  let h='';if(selection?.type==='source'){const s=map.sources.find(s=>s.node===selection.node);if(s)h=C.exitRoutes(map,s.node).map(route=>'<path d="'+path(route)+'" fill="none" stroke="#c8f5a9" stroke-width="3" stroke-dasharray="8 8" opacity=".65"/>').join('');}
  if(selection?.type==='road'){const r=map.roads.find(r=>C.key(r.a,r.b)===selection.key);if(r)h='<path d="'+path([r.a,r.b])+'" fill="none" stroke="#c8f5a9" stroke-width="32" opacity=".25"/>';}
  if(selection?.type==='bridge'){const [x,y]=pos(selection.node);h='<circle cx="'+x+'" cy="'+y+'" r="35" stroke="#b7e894" stroke-width="2" stroke-dasharray="5 4" fill="none"/>';}
  $('route-preview').innerHTML=h;
 }
 function renderInspector(){
  let html='',type='INSPECTOR';
  if(selection?.type==='bridge'){
   const b=C.bridgeAt(map,selection.node);if(b){type='OVERPASS';html='<h4 class="inspect-title">立交桥<span>↟</span></h4><p class="inspect-sub">坐标 ('+b.node+')<br>桥上桥下各自直行，互不转弯</p><label for="bridge-over">哪条道路从上面跨过？</label><select id="bridge-over"><option value="ew"'+(b.over==='ew'?' selected':'')+'>东西道路在上</option><option value="ns"'+(b.over==='ns'?' selected':'')+'>南北道路在上</option></select><button id="bridge-remove">拆桥 · 恢复平面路口</button>';}
  }else if(selection?.type==='source'){
   const s=map.sources.find(s=>s.node===selection.node);if(s){type='ENTRY';const routes=C.exitRoutes(map,s.node);html='<h4 class="inspect-title">入口 '+sourceName(s.node)+'<span>↗</span></h4><p class="inspect-sub">坐标 ('+s.node+') · '+routes.length+' 个可达出口</p><p class="inspect-sub">每辆车出发时，随机选择一个可达出口。'+(!routes.length?'请先连接出口。':'')+'</p><p class="inspect-sub">虚线显示所有可选路线</p>';}
  }else if(selection?.type==='signal'){
   const s=map.signals.find(s=>s.node===selection.node);if(s){type='SIGNAL';html='<h4 class="inspect-title">路口信号灯<span>●</span></h4><p class="inspect-sub">坐标 ('+s.node+') · 东西 / 南北轮流通行<br>绿灯间隔有 1 秒全红清空路口</p><label for="signal-cycle">每方向绿灯 <output id="cycle-value">'+s.cycle+'</output> 秒</label><input id="signal-cycle" type="range" min="3" max="20" value="'+s.cycle+'"><button id="signal-phase">初相：'+(C.green(s,0,'ew')?'东西绿灯':C.green(s,0,'ns')?'南北绿灯':'全红')+' · 切换</button>';}
  }else if(selection?.type==='road'){
   const r=map.roads.find(r=>C.key(r.a,r.b)===selection.key);if(r){type='ROAD';html='<h4 class="inspect-title">道路方向<span>⇄</span></h4><p class="inspect-sub">A ('+r.a+') → B ('+r.b+')</p><label for="road-direction">通行方式</label><select id="road-direction"><option value="both">⇄ 双向通行</option><option value="forward">→ 单向 A 至 B</option><option value="reverse">← 单向 B 至 A</option></select>';}
  }else if(selection?.type==='exit'&&map.exits.includes(selection.node)){type='EXIT';html='<h4 class="inspect-title">'+exitName(selection.node)+'</h4><p class="inspect-sub">这是车辆可随机选择的目的地。<br>车辆抵达所选出口后离开路网。</p>';}
  else if(selection?.type==='node'&&C.nodes(map).includes(selection.node)){html='<h4 class="inspect-title">道路节点 ('+selection.node+')</h4><p class="inspect-sub">连接 '+C.neighbors(map,selection.node,false).length+' 条道路。<br>可在此设置入口、出口或红绿灯。</p>';}
  $('selection-type').textContent=type;
  $('inspector').innerHTML=html||'<div class="inspect-empty"><svg><use href="#i-cursor"/></svg><p>选择道路或设施<br>查看并调整它的设置</p></div>';
  if($('road-direction'))$('road-direction').value=map.roads.find(r=>C.key(r.a,r.b)===selection.key).dir;
 }
 function renderStats(){
  $('arrived').textContent=sim.arrived;$('active-cars').textContent=sim.cars.length;$('waiting').textContent=sim.waiting;$('travel').textContent=sim.average?sim.average.toFixed(1):'—';
  const secs=Math.floor(sim.time);$('clock').textContent=String(Math.floor(secs/60)).padStart(2,'0')+':'+String(secs%60).padStart(2,'0');
 }
 function renderMotion(){
  const colors=['#c6e9ab','#e9b788','#a4d5de','#d9c6e7','#eddca0'];
  let above='',below='';
  for(const c of sim.cars){
   const a=c.path[c.i],b=c.path[c.i+1],[ax,ay]=pos(a),[bx,by]=pos(b),dx=bx-ax,dy=by-ay,len=Math.hypot(dx,dy),axis=dx?'ew':'ns';
   let x=ax+dx*c.p-dy/len*6,y=ay+dy*c.p+dx/len*6,under=false,layer='ground';
   const bridge=C.bridgeAt(map,a)||C.bridgeAt(map,b);
   if(bridge){const distance=(bridge.node===a?c.p:1-c.p)*40;if(distance<35){under=axis!==bridge.over;layer=under?'under':'over';if(!under){const lift=7*Math.min(1,Math.max(0,(34-distance)/14));if(axis==='ew')y-=lift;else x+=lift;}}}
   const car='<g data-destination="'+c.path.at(-1)+'" data-layer="'+layer+'" transform="translate('+x+' '+y+') rotate('+(Math.atan2(dy,dx)*180/Math.PI)+')"><rect x="-6.5" y="-3.4" width="13" height="6.8" rx="2" fill="'+colors[c.source%colors.length]+'" stroke="#1c342b" stroke-width=".7"/><rect x="1" y="-2.5" width="2.8" height="5" rx=".7" fill="#3a5546"/><rect x="-4.2" y="-2.5" width="2" height="5" rx=".5" fill="#5a7057"/></g>';
   if(under)below+=car;else above+=car;
  }
  $('under-cars').innerHTML=below;$('cars').innerHTML=above;
  map.signals.forEach(s=>{const ew=document.querySelector('[data-light-ew="'+s.node+'"]'),ns=document.querySelector('[data-light-ns="'+s.node+'"]');if(ew)ew.setAttribute('fill',C.green(s,sim.time,'ew')?'#b7ed88':'#dc7970');if(ns)ns.setAttribute('fill',C.green(s,sim.time,'ns')?'#b7ed88':'#dc7970');});
 }
 function render(){
  renderRoads();renderBridges();renderMarkers();renderHits();renderPreview();renderInspector();renderMotion();renderStats();
  $('road-count').textContent=map.roads.length;$('map').dataset.roads=map.roads.length;$('demand').value=map.demand;$('demand-value').textContent=map.demand;
  $('undo').disabled=!undo.length;$('redo').disabled=!redo.length;$('map-meta').textContent=map.roads.length?'自由建造 · 网格 25 × 17':'空白地图 · 连接两点开始画路';
  const note=$('network-note');note.classList.remove('warning');
  if(!map.roads.length)note.textContent='先画道路，再安排入口与出口。';
  else if(!map.sources.length||!map.exits.length){note.textContent='再设置'+(!map.sources.length?'入口':'')+(!map.sources.length&&!map.exits.length?'和':'')+(!map.exits.length?'出口':'')+'，就能开始模拟。';note.classList.add('warning');}
  else if(sim.blockedSources.length){note.textContent='⚠ '+sim.blockedSources.map(s=>'入口 '+sourceName(s.node)).join('、')+' 无法到达出口，请检查道路方向与连接。';note.classList.add('warning');}
  else note.textContent='✓ '+map.sources.length+' 个入口均有可达路线 · '+map.exits.length+' 个出口';
 }
 // Pointer input uses SVG coordinates, so the same tools work at every viewport size.
 function eventNode(e){const point=$('map').createSVGPoint();point.x=e.clientX;point.y=e.clientY;const p=point.matrixTransform($('map').getScreenCTM().inverse());return Math.max(0,Math.min(24,Math.round((p.x-40)/40)))+','+Math.max(0,Math.min(16,Math.round((p.y-40)/40)));}
 $('map').addEventListener('pointerdown',e=>{if(e.button!==0)return;pointerStart={node:eventNode(e),x:e.clientX,y:e.clientY};if(tool==='road'){$('map').setPointerCapture(e.pointerId);e.preventDefault();}});
 $('map').addEventListener('pointermove',e=>{if(tool==='road'){hover=eventNode(e);if(pointerStart&&Math.hypot(e.clientX-pointerStart.x,e.clientY-pointerStart.y)>5&&!anchor)anchor=pointerStart.node;renderPreview();}});
 $('map').addEventListener('pointerup',e=>{
  if(!pointerStart)return;const start=pointerStart;pointerStart=null;const node=eventNode(e);
  if(tool==='road'){const moved=Math.hypot(e.clientX-start.x,e.clientY-start.y)>5;if(moved&&start.node!==node){const a=anchor||start.node;edit(()=>C.draw(map,a,node,drawDir),'道路已连接');}else activateNode(node);}
  else{const road=e.target.closest('[data-road]');if(road&&['select','direction','erase'].includes(tool))activateRoad(road.dataset.road);else activateNode(node);}
 });
 $('map').addEventListener('pointercancel',()=>{pointerStart=null;anchor=null;renderPreview();});
 $('map').addEventListener('keydown',e=>{
  const target=e.target.closest('[data-node]');if(!target)return;const [x,y]=C.xy(target.dataset.node);const dirs={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
  if(dirs[e.key]){e.preventDefault();const [dx,dy]=dirs[e.key];keyboardNode=Math.max(0,Math.min(24,x+dx))+','+Math.max(0,Math.min(16,y+dy));target.setAttribute('tabindex','-1');const next=document.querySelector('[data-node="'+keyboardNode+'"]');next.setAttribute('tabindex','0');next.focus();if(anchor){hover=keyboardNode;renderPreview();}}
  else if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();keyboardNode=target.dataset.node;activateNode(keyboardNode);document.querySelector('[data-node="'+keyboardNode+'"]')?.focus();}
 });
 document.querySelectorAll('[data-tool]').forEach(b=>b.addEventListener('click',()=>switchTool(b.dataset.tool)));
 document.querySelectorAll('[data-speed]').forEach(b=>b.addEventListener('click',()=>{speed=Number(b.dataset.speed);document.querySelectorAll('[data-speed]').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',String(x===b));});}));
 $('draw-dir').addEventListener('change',e=>drawDir=e.target.value);
 $('run').addEventListener('click',()=>{if(!running&&(!map.sources.length||!map.exits.length||sim.blockedSources.length===map.sources.length)){toast('请先连接道路，并设置有可达路线的入口和出口');return;}anchor=null;renderPreview();setRunning(!running);});
 $('reset').addEventListener('click',()=>{setRunning(false);sim.reset();renderMotion();renderStats();toast('模拟已重置，路网设计保留');});
 $('undo').addEventListener('click',()=>history(true));$('redo').addEventListener('click',()=>history(false));$('save').addEventListener('click',()=>save(true));
 $('new-map').addEventListener('click',()=>{selection=null;anchor=null;hover=null;switchTool('road');edit(()=>{map=C.empty();},'空白地图已就绪，可撤销恢复上一个方案');});
 $('demo').addEventListener('click',()=>{selection=null;edit(()=>{map=C.demo();},'示例路网已载入，点击开始模拟');});
 $('grid-toggle').addEventListener('click',()=>{showGrid=!showGrid;$('grid').style.display=showGrid?'':'none';$('grid-toggle').classList.toggle('selected',showGrid);$('grid-toggle').setAttribute('aria-pressed',String(showGrid));});
 $('demand').addEventListener('input',e=>$('demand-value').textContent=e.target.value);$('demand').addEventListener('change',e=>edit(()=>{map.demand=Number(e.target.value);},'入口流量已更新'));
 $('inspector').addEventListener('input',e=>{if(e.target.id==='signal-cycle')$('cycle-value').textContent=e.target.value;});
 $('inspector').addEventListener('change',e=>{
  const id=e.target.id,value=e.target.value;
  if(id==='road-direction')edit(()=>{map.roads.find(r=>C.key(r.a,r.b)===selection.key).dir=value;},'道路方向已更新');
  if(id==='bridge-over')edit(()=>C.setBridge(map,selection.node,value),'桥上桥下方向已切换');
  if(id==='signal-cycle')edit(()=>{const s=map.signals.find(s=>s.node===selection.node),northSouth=C.green(s,0,'ns');s.cycle=Number(value);s.offset=northSouth?s.cycle+1:0;},'信号周期已更新');
 });
 $('inspector').addEventListener('click',e=>{if(e.target.closest('#signal-phase'))edit(()=>{const s=map.signals.find(s=>s.node===selection.node);s.offset=C.green(s,0,'ew')?s.cycle+1:0;},'信号初始相位已切换');if(e.target.closest('#bridge-remove'))edit(()=>{map.bridges=map.bridges.filter(b=>b.node!==selection.node);selection=null;},'已拆桥，恢复平面路口');});
 $('export').addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(map,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='路流-交通方案.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('已导出方案 JSON');});
 $('import').addEventListener('click',()=>$('import-file').click());
 $('import-file').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>1024*1024)throw Error('文件过大，请导入 1MB 以内的方案');const imported=C.validate(JSON.parse(await file.text()));selection=null;edit(()=>{map=imported;},'方案已导入');}catch(err){toast(err instanceof SyntaxError?'JSON 格式有误，方案未改变':err.message);}e.target.value='';});
 $('help').addEventListener('click',()=>$('guide').showModal());$('close-help').addEventListener('click',()=>$('guide').close());$('guide-start').addEventListener('click',()=>$('guide').close());
 document.addEventListener('keydown',e=>{
  if($('guide').open||e.target.closest('input,select,textarea'))return;
  if(e.key==='Escape'){anchor=null;hover=null;renderPreview();return;}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();history(!e.shiftKey);return;}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();history(false);return;}
  if(!e.ctrlKey&&!e.metaKey&&/^[1-8]$/.test(e.key))switchTool(tools[Number(e.key)-1]);
  if(e.code==='Space'&&!e.target.closest('button,[data-node]')){e.preventDefault();$('run').click();}
 });
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&running)setRunning(false);});
 function frame(now){if(running){if(lastTime)sim.advance(Math.min((now-lastTime)/1000,0.1)*speed);lastTime=now;renderMotion();if(now-lastStats>150){renderStats();lastStats=now;}}requestAnimationFrame(frame);}
 setRunning(false);render();requestAnimationFrame(frame);
})();

/* Road editing and UI coordination. All graph and driving rules live in core/simulation. */
(function(){
 'use strict';
 const C=window.TrafficCore,L=window.TrafficLayers,{Simulation}=window.TrafficSim,$=id=>document.getElementById(id),NS='http://www.w3.org/2000/svg';
 const STORE='flow-traffic-layout-v1',METRO_STORE='flow-metro-layout-v1',MODE_STORE='flow-active-mode-v1',tools=['select','road','direction','signal','source','exit','erase','bridge','route'];
 const hints={select:'点击入口查看随机分流路线；点击道路或红绿灯，调整它的设置。',road:'拖动绘制道路，或依次点击起点与终点。交叉处自动连接。',direction:'点击道路中间，依次切换正向、反向、双向通行。箭头即行驶方向。',signal:'点击道路节点添加红绿灯；选择灯后可调整绿灯时长与初始相位。',source:'点击道路节点设置入口。每辆车出发时，会从所有可达出口里随机选一个。',exit:'点击道路节点设置出口。车辆会随机选择能到达的出口。',erase:'点击路段拆路；点击节点优先拆除入口、出口或灯，再拆除相连道路。'};
 hints.bridge='点击十字交叉点建桥，再次点击切换哪条路在上。桥上桥下独立直行，不能在这里转弯。';
 hints.road='拖过已有道路的中间默认跨过、不连接；要接入路口，把它作为一段的端点。可选择新路在上或在下。';
 hints.route='先点入口，再沿道路逐段点击，最后点出口保存。车辆严格沿线行驶；可画多条路线随机分流。Esc 取消。';
 hints.ramp='先点坡道起点，切换到相邻高度，再点击终点。坡道是不同高度之间的明确连接。';
 let map=C.empty(),tool='road',drawDir='both',crossingMode='over',routeDraft=[],selectedRoute=null,anchor=null,hover=null,selection=null,running=false,speed=1,showGrid=true,undo=[],redo=[],toastTimer,keyboardNode='12,8',pointerStart=null,buildLevel=0,onlyLevel=false;
 try{const mode=localStorage.getItem(MODE_STORE)==='metro'?'metro':'road';map=C.empty(mode);const saved=localStorage.getItem(mode==='metro'?METRO_STORE:STORE);if(saved)map=C.validate(JSON.parse(saved));}catch{setTimeout(()=>toast('未能读取本地方案，已打开空白地图'),100);}
 let sim=new Simulation(map),lastTime=0,lastStats=0,pauseReason='';
 const pos=L.pos;
 const path=L.path;
 const sourceName=node=>String.fromCharCode(65+map.sources.findIndex(s=>s.node===node));
 const exitName=node=>'出口 '+(map.exits.indexOf(node)+1)+' · ('+node+')';
 const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const isMetro=()=>map.mode==='metro';
 function toolHint(){if(tool==='ramp')return anchor?'起点在'+L.levelName(C.level(anchor))+'，请切到相邻高度后点击终点。':hints.ramp;if(isMetro())return ({road:'在当前高度绘制双向轨道；同层连接，跨层通过坡道接通。',source:'点击轨道节点放置站台。站台同时收发列车，每三座站台配置一列车。',exit:'点击轨道节点放置站台，站台同时作为入口和出口。',route:'先选起始站台，按顺序点途经节点和站台，最后点「完成线路」。途中站台不会提前结束绘制。',select:'点击站台查看线路，列车沿手画线逐站停靠并在终点折返。'})[tool]||hints[tool];return hints[tool];}
 function changeMode(mode){
  if((isMetro()?'metro':'road')===mode)return;save();setRunning(false);let next=C.empty(mode);try{const saved=localStorage.getItem(mode==='metro'?METRO_STORE:STORE);if(saved)next=C.validate(JSON.parse(saved));}catch{toast('该工作台存档不可用，已打开空图');}
  map=next;sim=new Simulation(map);undo=[];redo=[];selection=null;selectedRoute=null;routeDraft=[];buildLevel=0;onlyLevel=false;keyboardNode='12,8';drawDir='both';crossingMode=mode==='metro'?'connect':'over';switchTool('road');save();render();toast(mode==='metro'?'地铁工作台：站台同时收发列车，默认六节编组':'已回到道路工作台，原设计已恢复');
 }
 function changeLevel(z){if(!Number.isInteger(z)||z<C.MIN_LEVEL||z>C.MAX_LEVEL)return;buildLevel=z;keyboardNode=C.node(...C.xy(keyboardNode),z);if(tool!=='ramp'&&tool!=='route')anchor=null;hover=null;if(tool!=='route')selection=null;$('build-level').value=String(z);$('grid').setAttribute('transform','translate('+(z*3)+' '+(-z*4)+')');$('tool-hint').textContent=toolHint();renderScene();renderHits();renderPreview();renderInspector();renderMotion();$('map-meta').textContent=L.levelName(z)+' · 网格 25 × 17';}
 function renderMode(){
  const metro=isMetro();document.body.dataset.mode=metro?'metro':'road';document.querySelectorAll('[data-mode]').forEach(b=>{if(b.tagName==='BUTTON')b.setAttribute('aria-pressed',String((b.dataset.mode==='metro')===metro));});
  $('mode-help').textContent=metro?'站台双向收发 · 列车数＝⌊站台数÷3⌋':'两个工作台分别自动保存';$('project-name').textContent=metro?'地铁工作台':'城市实验场';document.querySelector('.map-heading h2').textContent=metro?'地铁线路工作台':'城市实验场';
  for(const [t,label] of Object.entries(metro?{road:'绘制轨道',direction:'轨道方向',source:'设置站台',route:'地铁线路'}:{road:'绘制道路',direction:'道路方向',source:'车辆入口',route:'行驶路线'}))document.querySelector('[data-tool="'+t+'"] span').textContent=label;
  document.querySelector('.arrivals>span').textContent=metro?'累计停站':'累计到达';document.querySelector('.metric-grid>div:nth-child(1)>span:last-child').textContent=metro?'在线列车':'在途车辆';document.querySelector('.metric-grid>div:nth-child(2)>span:last-child').textContent=metro?'停站 / 等候':'排队车辆';document.querySelector('.metric-grid>div:nth-child(3)>span:last-child').textContent=metro?'平均站间 / 秒':'平均用时 / 秒';
  document.querySelector('.arrivals>div>span').innerHTML=(metro?'次':'辆')+' <svg><use href="#i-out"/></svg>';document.querySelector('.arrivals>small').textContent=metro?'沿手画线路逐站停靠。':'每一次顺畅到达，都是好设计。';document.querySelector('.metric-grid>div:nth-child(4)>span:last-child').textContent=metro?'轨道段数':'道路段数';document.querySelector('.map-legend>span:nth-child(1)').innerHTML='<i class="entry-dot"></i>'+(metro?'站台':'入口');document.querySelector('.map-legend>span:nth-child(2)').innerHTML='<i class="exit-dot"></i>'+(metro?'双向轨道':'出口');document.querySelector('.map-legend>span:nth-child(3)').innerHTML='<i class="signal-dot"></i>'+(metro?'轨道信号':'信号灯');
  $('demand-controls').hidden=metro;$('metro-settings').hidden=!metro;$('train-cars').value=map.trainCars??6;$('build-level').value=String(buildLevel);$('only-level').checked=onlyLevel;$('draw-dir').value=drawDir;$('draw-crossing').value=crossingMode;$('tool-hint').textContent=toolHint();$('grid').setAttribute('transform','translate('+(buildLevel*3)+' '+(-buildLevel*4)+')');
 }
 function toast(text){$('toast').textContent=text;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3200);}
 function save(manual=false){try{localStorage.setItem(isMetro()?METRO_STORE:STORE,JSON.stringify(map));localStorage.setItem(MODE_STORE,isMetro()?'metro':'road');$('save-state').textContent='✓ 已保存到本地';if(manual)toast('方案已保存在此设备');}catch{$('save-state').textContent='保存不可用';toast('浏览器存储不可用，可导出 JSON 保存方案');}}
 function setRunning(on,reason=''){
  running=on;pauseReason=on?'':reason;$('run').innerHTML='<svg><use href="#i-'+(on?'pause':'play')+'"/></svg><span>'+(on?'暂停模拟':'开始模拟')+'</span>';
  $('mode-label').textContent=on?'模拟运行中':'规划模式';$('run-status').textContent=on?'车流运行中':'准备就绪';$('live-tag').textContent=on?'● 运行中':sim.time?'已暂停':'待运行';$('map').dataset.running=String(on);lastTime=0;
  renderStats();
 }
 function edit(change,message){
  const before=JSON.stringify(map);change();C.cleanup(map);const after=JSON.stringify(map);if(before===after){renderInspector();renderPreview();return;}
  undo.push(before);if(undo.length>60)undo.shift();redo=[];sim=new Simulation(map);setRunning(false);anchor=null;save();render();if(message)toast(message);
 }
 function history(back){const from=back?undo:redo,to=back?redo:undo;if(!from.length)return;to.push(JSON.stringify(map));map=C.validate(JSON.parse(from.pop()));sim=new Simulation(map);setRunning(false);selection=null;selectedRoute=null;anchor=null;routeDraft=[];save();render();toast(back?'已撤销':'已重做');}
 function switchTool(next){tool=next;anchor=null;hover=null;routeDraft=[];document.querySelectorAll('[data-tool]').forEach(b=>{const active=b.dataset.tool===tool;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});$('tool-hint').textContent=toolHint();$('road-options').hidden=!['road','ramp'].includes(tool);$('road-options').style.display=['road','ramp'].includes(tool)?'':'none';renderPreview();}
 function roadAt(node){return map.roads.find(r=>r.a===node||r.b===node);}
 function drawRoad(a,b){try{const z=C.drawingLevel(map,a,b,crossingMode),start=C.node(...C.xy(a),z),end=C.node(...C.xy(b),z);selection=null;edit(()=>C.draw(map,start,end,drawDir,{crossing:crossingMode}),'已按选定高度绘制，原有其它层道路保留');if(z!==buildLevel){changeLevel(z);toast('整段新道路已设为'+L.levelName(z)+'，下方道路独立保留');}}catch(err){toast(err.message);}}
 function inspectNode(node){
  selectedRoute=null;
  selection=isMetro()&&map.stations.includes(node)?{type:'station',node}:C.bridgeAt(map,node)?{type:'bridge',node}:map.sources.some(s=>s.node===node)?{type:'source',node}:map.signals.some(s=>s.node===node)?{type:'signal',node}:map.exits.includes(node)?{type:'exit',node}:{type:'node',node};renderInspector();renderPreview();
 }
 function activateNode(node){
  if(tool==='ramp'){if(!anchor){anchor=node;hover=node;$('tool-hint').textContent=toolHint();renderPreview();toast('已选坡道起点，请切换到相邻高度后点击终点');return;}try{const a=anchor;edit(()=>C.ramp(map,a,node,drawDir),'坡道已连接相邻高度');}catch(err){toast(err.message);}return;}
  if(tool==='route'){
   if(!routeDraft.length){if(!map.sources.some(s=>s.node===node)){toast(isMetro()?'先点击起始站台':'先点击一个车辆入口作为路线起点');return;}routeDraft=[node];hover=node;selection={type:isMetro()?'station':'source',node};renderInspector();renderPreview();toast(isMetro()?'按顺序点击途经节点和站台，最后点击完成线路':'已选入口，按行驶顺序逐段点击道路，最后点击出口');return;}
   if(node===routeDraft.at(-1))return;
   const candidate=[...routeDraft,...(C.level(routeDraft.at(-1))===C.level(node)?C.line(routeDraft.at(-1),node).slice(1):[node])];
   if(!C.canFollow(map,candidate)){toast('这段走不通：检查道路方向，不能掉头或跨层转弯；可在转角处分段点击');return;}
   if(isMetro()){routeDraft=candidate;hover=node;renderInspector();renderPreview();return;}
   if(map.exits.includes(node)){
    const start=candidate[0],existing=map.routes.findIndex(r=>r.nodes.join('|')===candidate.join('|'));routeDraft=[];selection={type:'source',node:start};
    if(existing>=0){selectedRoute=existing;renderInspector();renderPreview();toast('这条路线已经存在，可添加不同的途经路线');}
    else edit(()=>{C.addRoute(map,candidate);selectedRoute=map.routes.length-1;},'路线已保存，可在入口设置中继续添加、预览或删除单条路线');
   }
   else{routeDraft=candidate;hover=node;renderPreview();}return;
  }
  if(tool==='road'){
   if(anchor && anchor!==node){const a=anchor;drawRoad(a,node);}
   else{anchor=node;hover=node;renderPreview();toast('已选起点，请点击终点；Esc 取消');}return;
  }
  if(tool==='select'){inspectNode(node);return;}
  if(tool==='direction'){const r=roadAt(node);if(r)activateRoad(C.key(r.a,r.b));else toast('先绘制道路，再设置方向');return;}
  if(!C.nodes(map).includes(node)){toast('请先在这里绘制道路');return;}
  if(isMetro()&&['source','exit'].includes(tool)){selection={type:'station',node};try{edit(()=>C.addStation(map,node),'站台已设置，同时作为列车入口和出口');}catch(err){toast(err.message);}return;}
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
    if(isMetro()&&map.stations.includes(node))C.removeStation(map,node);
    else if(C.bridgeAt(map,node))map.bridges=map.bridges.filter(b=>b.node!==node);
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
 function renderScene(){
  const scene=L.staticScene(map,buildLevel,onlyLevel);$('roads').innerHTML=scene.roads;$('markers').innerHTML=scene.markers;$('bridges').innerHTML=scene.bridges;$('negative-levels').innerHTML=scene.below;$('positive-levels').innerHTML=scene.above;
 }
 function renderHits(){
  let html=map.roads.filter(r=>C.level(r.a)===buildLevel||C.level(r.b)===buildLevel).map(r=>{const [ax,ay]=pos(r.a),[bx,by]=pos(r.b);return '<rect class="road-hit" data-road="'+C.key(r.a,r.b)+'" x="'+(Math.min(ax,bx)-9)+'" y="'+(Math.min(ay,by)-9)+'" width="'+(Math.abs(bx-ax)+18)+'" height="'+(Math.abs(by-ay)+18)+'" rx="4" fill="transparent" role="button" aria-label="道路 '+r.a+' 至 '+r.b+'"/>';}).join('');
  for(let y=0;y<C.ROWS;y++)for(let x=0;x<C.COLS;x++){const id=C.node(x,y,buildLevel),[px,py]=pos(id);const source=map.sources.some(s=>s.node===id),exit=map.exits.includes(id),signal=map.signals.some(s=>s.node===id),station=isMetro()&&map.stations.includes(id);html+='<circle class="node-hit'+(C.bridgeAt(map,id)?' bridge-hit':'')+'" data-node="'+id+'" cx="'+px+'" cy="'+py+'" r="13" role="button" tabindex="'+(id===keyboardNode?'0':'-1')+'" aria-label="网格 '+id+(station?'，站台 '+(map.stations.indexOf(id)+1):source?'，入口 '+sourceName(id):exit?'，'+exitName(id):'')+(signal?'，信号灯':'')+'"/>';}
  $('hit-targets').innerHTML=html;
 }
 function renderPreview(){
  let d='';if(anchor){const points=C.level(anchor)===C.level(hover||anchor)?C.line(anchor,hover||anchor):[anchor,hover];d='<path d="'+path(points)+'" stroke="#c6f6a4" stroke-width="24" opacity=".35" stroke-linecap="round" fill="none"/><circle cx="'+pos(anchor)[0]+'" cy="'+pos(anchor)[1]+'" r="8" fill="#d4ffb6"/>';}$('draw-preview').innerHTML=d;
  if(routeDraft.length){let points=routeDraft;if(hover&&hover!==points.at(-1))points=[...points,...(C.level(points.at(-1))===C.level(hover)?C.line(points.at(-1),hover).slice(1):[hover])];$('draw-preview').innerHTML='<path d="'+path(points)+'" fill="none" stroke="'+(C.canFollow(map,points)?'#e7c486':'#d48d72')+'" stroke-width="5" stroke-dasharray="7 5"/>';}
  let h='';if(selection?.type==='source'){
   const s=map.sources.find(s=>s.node===selection.node),chosen=selectedRoute===null?null:map.routes[selectedRoute];
   if(s){const routes=chosen?.nodes[0]===s.node?[chosen.nodes]:C.exitRoutes(map,s.node);h=routes.map(route=>'<path d="'+path(route)+'" fill="none" stroke="'+(C.canFollow(map,route)?'#c8f5a9':'#e69c80')+'" stroke-width="'+(chosen?5:3)+'" stroke-dasharray="8 8" opacity=".8"/>').join('');}
  }
  if(selection?.type==='road'){const r=map.roads.find(r=>C.key(r.a,r.b)===selection.key);if(r)h='<path d="'+path([r.a,r.b])+'" fill="none" stroke="#c8f5a9" stroke-width="32" opacity=".25"/>';}
  if(isMetro()&&(selectedRoute!==null||!selection||selection.type==='station')){const routes=selectedRoute!==null&&map.routes[selectedRoute]?[map.routes[selectedRoute]]:map.routes.filter(r=>!selection?.node||r.nodes.includes(selection.node));h=routes.map(r=>'<path d="'+path(r.nodes)+'" fill="none" stroke="#a5dfcf" stroke-width="4" stroke-dasharray="7 6" opacity=".75"/>').join('');}
  $('route-preview').innerHTML=h;
 }
 function metroInspector(){
  const station=selection?.type==='station'?selection.node:null,ready=routeDraft.length>1&&map.stations.includes(routeDraft.at(-1))&&routeDraft[0]!==routeDraft.at(-1);
  let html=station?'<h4 class="inspect-title">站台 '+(map.stations.indexOf(station)+1)+'<span>M</span></h4><p class="inspect-sub">'+L.levelName(C.level(station))+' · ('+station+')<br>同时作为列车入口和出口</p><button id="route-start">＋ 从这里绘制地铁线路</button>':'<h4 class="inspect-title">地铁线路</h4><p class="inspect-sub">先放置站台，再用线路工具按顺序连接。途中站台会停车，两个终点自动折返。</p>';
  if(routeDraft.length)html+='<p class="inspect-sub">已绘制 '+(routeDraft.length-1)+' 格，经过 '+routeDraft.filter(n=>map.stations.includes(n)).length+' 个站台。切层可继续沿坡道绘制。</p><button id="finish-metro-line" class="metro-finish"'+(ready?'':' disabled')+'>完成线路</button>';
  html+='<div class="route-list">'+map.routes.map((r,i)=>'<div class="route-item'+(selectedRoute===i?' chosen':'')+'"><button class="route-preview-button" data-preview-route="'+i+'" aria-label="预览线路 '+(i+1)+'"><span>线路 '+(i+1)+' · '+r.nodes.filter(n=>map.stations.includes(n)).length+' 站</span><small>'+(r.nodes.length-1)+' 格 · '+(sim.lines.some(l=>l.index===i)?'可往返':'待修复')+'</small></button><button class="route-delete" data-remove-route="'+i+'" aria-label="删除线路 '+(i+1)+'">×</button></div>').join('')+'</div>';
  if(map.routes.length)html+='<button id="route-show-all"'+(selectedRoute===null?' disabled':'')+'>显示全部线路</button>';if(station)html+='<button id="station-remove">移除这个站台</button>';return html;
 }
 function finishMetroLine(){
  const candidate=[...routeDraft];if(candidate.length<2||!map.stations.includes(candidate.at(-1))||candidate[0]===candidate.at(-1)){toast('请把线路画到另一个终点站台');return;}
  if(!C.canFollow(map,candidate)||!C.canFollow(map,[...candidate].reverse())){toast('线路需要可双向往返，请检查单向轨道和连接');return;}
  if(candidate.length-1<window.TrafficMetro.halfLength(map)*2+0.1){toast('线路太短，容不下当前编组，请延长轨道');return;}
  routeDraft=[];selection={type:'station',node:candidate[0]};edit(()=>{C.addRoute(map,candidate);selectedRoute=map.routes.findIndex(r=>r.nodes.join('|')===candidate.join('|'));},'地铁线路已保存，将逐站停靠并在终点折返');
 }
 function renderInspector(){
  let html='',type='INSPECTOR';
  if(isMetro()&&(!selection||selection.type==='station')){type='METRO';html=metroInspector();}
  else if(selection?.type==='bridge'){
   const b=C.bridgeAt(map,selection.node);if(b){type='OVERPASS';html='<h4 class="inspect-title">立交桥<span>↟</span></h4><p class="inspect-sub">坐标 ('+b.node+')<br>桥上桥下各自直行，互不转弯</p><label for="bridge-over">哪条道路从上面跨过？</label><select id="bridge-over"><option value="ew"'+(b.over==='ew'?' selected':'')+'>东西道路在上</option><option value="ns"'+(b.over==='ns'?' selected':'')+'>南北道路在上</option></select><button id="bridge-remove">拆桥 · 恢复平面路口</button>';}
  }else if(selection?.type==='source'){
   const s=map.sources.find(s=>s.node===selection.node);
   if(s){
    type='ENTRY';const routes=C.exitRoutes(map,s.node),plans=map.routes.map((route,index)=>({route,index})).filter(p=>p.route.nodes[0]===s.node),count=new Set(routes.map(p=>p.at(-1))).size;
    const list=plans.map(({route,index},number)=>{const exit=map.exits.indexOf(route.nodes.at(-1)),valid=exit>=0&&C.canFollow(map,route.nodes),active=selectedRoute===index;return '<div class="route-item'+(active?' chosen':'')+'" data-route-row="'+index+'"><button class="route-preview-button" data-preview-route="'+index+'" aria-pressed="'+active+'" aria-label="预览路线 '+(number+1)+'"><span>路线 '+(number+1)+' → '+(exit>=0?'出口 '+(exit+1):'失效出口')+'</span><small>'+(route.nodes.length-1)+' 格 · '+(valid?'可用':'路线不通')+'</small></button><button class="route-delete" data-remove-route="'+index+'" aria-label="删除路线 '+(number+1)+'" title="仅删除这条路线">×</button></div>';}).join('');
    html='<h4 class="inspect-title">入口 '+sourceName(s.node)+'<span>↗</span></h4><p class="inspect-sub">坐标 ('+s.node+') · '+count+' 个可达出口</p><p class="inspect-sub">'+(plans.length?'已指定 '+plans.length+' 条路线，车辆严格沿线前进。':'未指定路线：随机选择出口，途中按拥堵、信号等待和距离避堵。')+(!routes.length?' 路线不通，请检查连接与方向。':'')+'</p><button id="route-start">'+(plans.length?'＋ 添加另一条路线':'＋ 绘制第一条路线')+'</button>'+(plans.length?'<div class="route-list">'+list+'</div><button id="route-show-all"'+(selectedRoute===null?' disabled':'')+'>显示全部路线</button>':'')+'<p class="inspect-sub">'+(plans.length?'点路线单独预览，点 × 只删这一条；可画不同途经点通往同一出口。车辆在候选路线间随机分流。':'虚线仅为出口连通示意，不限制其他分流道路；也可画多条手动候选路线。')+'</p>';
   }
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
  if(isMetro()){$('metro-fleet-summary').textContent='⌊'+map.stations.length+' ÷ 3⌋＝'+sim.trainCount+' 列 · 每列 '+map.trainCars+' 节；在线 '+sim.cars.length+'，待出库 '+sim.pendingTrains.length;$('flow-note').textContent=(running?'沿手画线路运行，每站停车两秒，终点折返。':pauseReason|| (sim.time?'模拟已暂停，点击开始继续。':'先设置站台并完成线路。'))+(sim.turnarounds?' 已折返 '+sim.turnarounds+' 次。':'');$('reverse-yield').disabled=true;return;}
  const waitingEntries=sim.pending.flatMap((p,i)=>p?['入口 '+String.fromCharCode(65+i)]:[]);
  $('flow-note').textContent=running?(waitingEntries.length?waitingEntries.join('、')+' 正在等前车腾出位置；其他入口按各自道路空位继续发车。':'各入口按设定流量独立发车中。'):(pauseReason|| (sim.time?'模拟已暂停，点击开始模拟继续发车。':''));
  if(sim.rerouted)$('flow-note').textContent+=' 自动避堵已改道 '+sim.rerouted+' 次。';
  if(sim.releasedQueues)$('flow-note').textContent+=' 已协调让行疏通 '+sim.releasedQueues+' 次。';
  if(sim.reversed)$('flow-note').textContent+=' 已后退让行 '+sim.reversed+' 次。';
  $('reverse-yield').disabled=!sim.cars.length||Boolean(sim.reverseCar);
  $('reverse-yield').textContent=sim.reverseCar?'↶ 正在后退…':'↶ 后退让行';
 }
 function renderMotion(){
  const motion=L.motion(map,sim,buildLevel,onlyLevel),ground=motion.get(0)||{under:'',over:''};$('under-cars').innerHTML=ground.under;$('cars').innerHTML=ground.over;
  document.querySelectorAll('[data-elevation]').forEach(group=>{const layer=motion.get(Number(group.dataset.elevation))||{under:'',over:''};group.querySelector('.level-under-cars').innerHTML=layer.under;group.querySelector('.level-cars').innerHTML=layer.over;});
  map.signals.forEach(s=>{const ew=document.querySelector('[data-light-ew="'+s.node+'"]'),ns=document.querySelector('[data-light-ns="'+s.node+'"]');if(ew)ew.setAttribute('fill',C.green(s,sim.time,'ew')?'#b7ed88':'#dc7970');if(ns)ns.setAttribute('fill',C.green(s,sim.time,'ns')?'#b7ed88':'#dc7970');});
 }
 function render(){
  renderMode();renderScene();renderHits();renderPreview();renderInspector();renderMotion();renderStats();
  $('road-count').textContent=map.roads.length;$('map').dataset.roads=map.roads.length;$('demand').value=map.demand;$('demand-value').textContent=map.demand;
  $('undo').disabled=!undo.length;$('redo').disabled=!redo.length;$('map-meta').textContent=L.levelName(buildLevel)+' · '+(map.roads.length?'网格 25 × 17':'空白地图 · 连接两点开始画路');
  const note=$('network-note');note.classList.remove('warning');
  if(isMetro()){
   note.textContent=!map.roads.length?'先绘制轨道，再放置站台。':map.stations.length<3?'已有 '+map.stations.length+' 座站台，按公式当前为 0 列；至少三站才配置列车。':!map.routes.length?'请用地铁线路工具画到终点站台，并点击完成线路。':sim.issues.length?sim.issues.join('；'):sim.blockedSources.length?'有 '+sim.blockedSources.length+' 座站台尚未接入有效线路。':'✓ '+map.stations.length+' 座站台 · '+sim.trainCount+' 列车 · '+sim.lines.length+' 条往返线路';
   if(!sim.lines.length||sim.issues.length||sim.blockedSources.length)note.classList.add('warning');return;
  }
  if(!map.roads.length)note.textContent='先画道路，再安排入口与出口。';
  else if(!map.sources.length||!map.exits.length){note.textContent='再设置'+(!map.sources.length?'入口':'')+(!map.sources.length&&!map.exits.length?'和':'')+(!map.exits.length?'出口':'')+'，就能开始模拟。';note.classList.add('warning');}
  else if(sim.blockedSources.length){const planned=sim.blockedSources.some(s=>map.routes.some(r=>r.nodes[0]===s.node));note.textContent='⚠ '+sim.blockedSources.map(s=>'入口 '+sourceName(s.node)).join('、')+(planned?' 的指定路线不通，车辆不会自动改道；请修复或删除路线。':' 无法到达出口，请检查道路方向与连接。');note.classList.add('warning');}
  else note.textContent='✓ '+map.sources.length+' 个入口均有可达路线 · '+map.exits.length+' 个出口';
 }
 // Pointer input uses SVG coordinates, so the same tools work at every viewport size.
 function eventNode(e){const point=$('map').createSVGPoint();point.x=e.clientX;point.y=e.clientY;const p=point.matrixTransform($('map').getScreenCTM().inverse());return C.node(Math.max(0,Math.min(24,Math.round((p.x-40-buildLevel*3)/40))),Math.max(0,Math.min(16,Math.round((p.y-40+buildLevel*4)/40))),buildLevel);}
 $('map').addEventListener('pointerdown',e=>{if(e.button!==0)return;pointerStart={node:eventNode(e),x:e.clientX,y:e.clientY};if(tool==='road'){$('map').setPointerCapture(e.pointerId);e.preventDefault();}});
 $('map').addEventListener('pointermove',e=>{if(tool==='road'||tool==='route'){hover=eventNode(e);if(tool==='road'&&pointerStart&&Math.hypot(e.clientX-pointerStart.x,e.clientY-pointerStart.y)>5&&!anchor)anchor=pointerStart.node;renderPreview();}});
 $('map').addEventListener('pointerup',e=>{
  if(!pointerStart)return;const start=pointerStart;pointerStart=null;const node=eventNode(e);
  if(tool==='road'){const moved=Math.hypot(e.clientX-start.x,e.clientY-start.y)>5;if(moved&&start.node!==node){const a=anchor||start.node;drawRoad(a,node);}else activateNode(node);}
  else{const road=e.target.closest('[data-road]');if(road&&['select','direction','erase'].includes(tool))activateRoad(road.dataset.road);else activateNode(node);}
 });
 $('map').addEventListener('pointercancel',()=>{pointerStart=null;anchor=null;renderPreview();});
 $('map').addEventListener('keydown',e=>{
  const target=e.target.closest('[data-node]');if(!target)return;const [x,y]=C.xy(target.dataset.node);const dirs={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
  if(dirs[e.key]){e.preventDefault();const [dx,dy]=dirs[e.key];keyboardNode=C.node(Math.max(0,Math.min(24,x+dx)),Math.max(0,Math.min(16,y+dy)),buildLevel);target.setAttribute('tabindex','-1');const next=document.querySelector('[data-node="'+keyboardNode+'"]');next.setAttribute('tabindex','0');next.focus();if(anchor){hover=keyboardNode;renderPreview();}}
  else if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();keyboardNode=target.dataset.node;activateNode(keyboardNode);document.querySelector('[data-node="'+keyboardNode+'"]')?.focus();}
 });
 document.querySelectorAll('[data-tool]').forEach(b=>b.addEventListener('click',()=>switchTool(b.dataset.tool)));
 document.querySelectorAll('[data-speed]').forEach(b=>b.addEventListener('click',()=>{speed=Number(b.dataset.speed);document.querySelectorAll('[data-speed]').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',String(x===b));});}));
 $('draw-dir').addEventListener('change',e=>drawDir=e.target.value);
 $('draw-crossing').addEventListener('change',e=>crossingMode=e.target.value);
 document.querySelectorAll('button[data-mode]').forEach(b=>b.addEventListener('click',()=>changeMode(b.dataset.mode)));
 $('build-level').addEventListener('change',e=>changeLevel(Number(e.target.value)));$('level-up').addEventListener('click',()=>changeLevel(buildLevel+1));$('level-down').addEventListener('click',()=>changeLevel(buildLevel-1));$('only-level').addEventListener('change',e=>{onlyLevel=e.target.checked;renderScene();renderMotion();});
 $('train-cars').addEventListener('change',e=>{const count=Number(e.target.value);if(!Number.isInteger(count)||count<1||count>12){e.target.value=map.trainCars??6;toast('车厢数请填写 1 到 12 的整数');return;}edit(()=>{map.trainCars=count;},'编组已更新，列车按站台总数重新配置');});
 $('run').addEventListener('click',()=>{if(!running&&isMetro()&&(!sim.trainCount||!sim.lines.length)){toast(!sim.trainCount?'站台数不足三座，按公式当前为零列车':'请先完成可双向往返的地铁线路');return;}if(!running&&!isMetro()&&(!map.sources.length||!map.exits.length||sim.blockedSources.length===map.sources.length)){toast('请先连接道路，并设置有可达路线的入口和出口');return;}anchor=null;renderPreview();setRunning(!running);});
 $('reset').addEventListener('click',()=>{setRunning(false);sim.reset();renderMotion();renderStats();toast('模拟已重置，路网设计保留');});
 $('reverse-yield').addEventListener('click',()=>{const c=sim.requestReverse(true);if(!c){toast('暂无可安全后退的待行车辆：请先等后方腾出空间');return;}renderMotion();renderStats();toast(running?'车辆正在沿原路慢速后退，让出空间':'已安排后退让行，点击开始模拟继续');});
 $('undo').addEventListener('click',()=>history(true));$('redo').addEventListener('click',()=>history(false));$('save').addEventListener('click',()=>save(true));
 $('new-map').addEventListener('click',()=>{selection=null;anchor=null;hover=null;switchTool('road');edit(()=>{map=C.empty(map.mode);},'空白地图已就绪，可撤销恢复上一个方案');});
 function examplePreview(m){
  const roads=m.roads.map(r=>'<path d="'+path([r.a,r.b])+'"/>').join('');
  const bridges=m.bridges.map(b=>{const [x,y]=pos(b.node);return '<g transform="translate('+x+' '+y+') rotate('+(b.over==='ew'?0:90)+')"><path d="M-32 4H32" stroke="#0d2119" stroke-width="38"/><path d="M-32 0H32" stroke="#bfd09a" stroke-width="26"/></g>';}).join('');
  const marks=m.sources.map(s=>{const [cx,cy]=pos(s.node);return '<circle cx="'+cx+'" cy="'+cy+'" r="17" fill="#c6f39d"/>';}).join('')+m.exits.map(n=>{const [cx,cy]=pos(n);return '<circle cx="'+cx+'" cy="'+cy+'" r="13" fill="#e7ae7b"/>';}).join('');
  return '<svg class="example-preview" viewBox="0 0 1040 720" aria-hidden="true"><g fill="none" stroke="#8fa78b" stroke-width="23" stroke-linecap="round">'+roads+'</g>'+bridges+marks+'</svg>';
 }
 function openExamples(){
  const metro=isMetro(),E=window.TrafficExamples,catalogue=metro?E.metroCatalog:E.catalog;
  if($('example-cards').dataset.mode!==(metro?'metro':'road')){$('example-cards').dataset.mode=metro?'metro':'road';$('example-cards').innerHTML=catalogue.map((e,i)=>{const m=metro?E.createMetro(e.id):E.create(e.id);return '<button class="example-card" data-example="'+e.id+'">'+examplePreview(m)+'<span class="example-tag">0'+(i+1)+' / '+escape(e.tag)+'</span><strong>'+escape(e.name)+'</strong><span class="example-description">'+escape(e.description)+'</span><span class="example-stats">'+(metro?m.stations.length+' 站 · '+Math.floor(m.stations.length/3)+' 列 · '+m.routes.length+' 条线路':m.sources.length+' 个入口 · '+m.bridges.length+' 处跨线 · '+m.routes.length+' 条路线')+' <b>载入 →</b></span></button>';}).join('');}
  document.querySelector('#examples .eyebrow').textContent=metro?'METRO STUDIES · 02':'TRAFFIC STUDIES · 06';document.querySelector('.examples-note').textContent=metro?'默认六节编组，列车总数为站台数除以三向下取整。示例可继续编辑，载入支持撤销。':'均为可编辑的网格路网；四叶草与盘龙为简化示意，不按真实比例复刻。载入会替换当前地图，可通过「撤销」恢复。';
  $('examples').showModal();
 }
 $('demo').addEventListener('click',openExamples);$('examples-open').addEventListener('click',openExamples);$('close-examples').addEventListener('click',()=>$('examples').close());
 $('example-cards').addEventListener('click',e=>{
  const card=e.target.closest('[data-example]');if(!card)return;const E=window.TrafficExamples,item=(isMetro()?E.metroCatalog:E.catalog).find(x=>x.id===card.dataset.example),next=isMetro()?E.createMetro(item.id):E.create(item.id),same=JSON.stringify(map)===JSON.stringify(next),message=item.name+'已载入，点击开始模拟；可撤销恢复原图';
  selection=null;anchor=null;hover=null;routeDraft=[];edit(()=>{map=next;},message);
  if(same){setRunning(false);sim.reset();renderMotion();renderStats();toast(message);}
  $('examples').close();switchTool('select');
 });
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
 $('inspector').addEventListener('click',e=>{
  if(e.target.closest('#finish-metro-line')){finishMetroLine();return;}
  if(e.target.closest('#station-remove')){const station=selection.node;edit(()=>{C.removeStation(map,station);selection=null;},'站台已移除，列车数按公式重新配置');return;}
  if(e.target.closest('#route-start')){const start=selection.node;selectedRoute=null;switchTool('route');routeDraft=[start];hover=start;renderInspector();renderPreview();toast(isMetro()?'按顺序点途经节点和站台，最后点击完成线路':'从当前入口按顺序点击途经点，最后点出口；已有路线会保留');return;}
  const preview=e.target.closest('[data-preview-route]');
  if(preview){selectedRoute=Number(preview.dataset.previewRoute);switchTool('select');renderInspector();return;}
  if(e.target.closest('#route-show-all')){selectedRoute=null;switchTool('select');renderInspector();return;}
  const remove=e.target.closest('[data-remove-route]');
  if(remove){const index=Number(remove.dataset.removeRoute);if(!isMetro()&&map.routes[index]?.nodes[0]!==selection?.node)return;edit(()=>{map.routes.splice(index,1);selectedRoute=null;routeDraft=[];},'已删除这一条路线，其余路线保留；可撤销恢复');}
 });
 $('export').addEventListener('click',()=>{
  const text=JSON.stringify(map,null,2),name='路流-交通方案.json';
  try{
   if(window.GameHubBridge&&typeof window.GameHubBridge.saveFile==='function'){if(window.GameHubBridge.saveFile(name,text)===false)throw Error('大厅未受理保存，请稍后重试');toast('已请求大厅保存方案');return;}
   const url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('已导出方案 JSON');
  }catch(err){toast('导出失败：'+err.message);}
 });
 $('import').addEventListener('click',()=>$('import-file').click());
 $('import-file').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>1024*1024)throw Error('文件过大，请导入 1MB 以内的方案');const imported=C.validate(JSON.parse(await file.text()));selection=null;edit(()=>{map=imported;},'方案已导入');}catch(err){toast(err instanceof SyntaxError?'JSON 格式有误，方案未改变':err.message);}e.target.value='';});
 $('help').addEventListener('click',()=>$('guide').showModal());$('close-help').addEventListener('click',()=>$('guide').close());$('guide-start').addEventListener('click',()=>$('guide').close());
 document.addEventListener('keydown',e=>{
  if($('guide').open||$('examples').open||e.target.closest('input,select,textarea'))return;
  if(e.key==='Escape'){anchor=null;hover=null;routeDraft=[];renderPreview();return;}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();history(!e.shiftKey);return;}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();history(false);return;}
  if(!e.ctrlKey&&!e.metaKey&&/^[0-9]$/.test(e.key))switchTool(e.key==='0'?'ramp':tools[Number(e.key)-1]);
  if(e.code==='Space'&&!e.target.closest('button,[data-node]')){e.preventDefault();$('run').click();}
 });
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&running)setRunning(false,'切换到其他页面时自动暂停，点击开始模拟继续发车。');});
 function frame(now){if(running){if(lastTime)sim.advance(Math.min((now-lastTime)/1000,0.1)*speed);lastTime=now;renderMotion();if(now-lastStats>150){renderStats();lastStats=now;}}requestAnimationFrame(frame);}
 $('build-level').innerHTML=Array.from({length:C.MAX_LEVEL-C.MIN_LEVEL+1},(_,i)=>{const z=i+C.MIN_LEVEL;return '<option value="'+z+'">'+L.levelName(z)+'</option>';}).join('');
 setRunning(false);$('tool-hint').textContent=toolHint();render();requestAnimationFrame(frame);
})();

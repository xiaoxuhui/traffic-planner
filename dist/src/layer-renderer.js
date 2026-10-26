(function(root,factory){const api=factory(typeof module==='object'?require('./core.js'):root.TrafficCore);if(typeof module==='object')module.exports=api;else root.TrafficLayers=api;})(typeof globalThis!=='undefined'?globalThis:this,function(C){
 'use strict';
 const pos=id=>{const [x,y]=C.xy(id),z=C.level(id);return [40+x*40+z*3,40+y*40-z*4];};
 const path=ids=>ids.map((n,i)=>(i?'L':'M')+pos(n).join(',')).join(' ');
 const roadLevel=r=>Math.max(C.level(r.a),C.level(r.b));
 const levels=m=>[...new Set([0,...C.nodes(m).map(C.level)])].sort((a,b)=>a-b);
 const levelName=z=>z===0?'地面':z>0?'高架 '+z+' 层':'地下 '+(-z)+' 层';
 function arrow(a,b,fraction,offset=0){const [ax,ay]=pos(a),[bx,by]=pos(b),angle=Math.atan2(by-ay,bx-ax)*180/Math.PI;return '<path d="m-3 -3 3 3-3 3" fill="none" stroke="#d7d5ad" stroke-width="1.4" opacity=".8" transform="translate('+(ax+(bx-ax)*fraction)+' '+(ay+(by-ay)*fraction)+') rotate('+angle+') translate(0 '+offset+')"/>';}
 function roads(m,z){
  let outer='',inner='',lanes='',arrows='';
  for(const r of m.roads.filter(r=>roadLevel(r)===z)){const d=path([r.a,r.b]);outer+='<path d="'+d+'"/>';inner+='<path data-road-surface="'+C.key(r.a,r.b)+'" data-height="'+z+'" d="'+d+'"/>';lanes+='<path d="'+d+'"/>';arrows+=r.dir==='both'?arrow(r.a,r.b,.5,6)+arrow(r.b,r.a,.5,6):r.dir==='forward'?arrow(r.a,r.b,.5):arrow(r.b,r.a,.5);}
  const junctions=C.nodes(m).filter(n=>C.level(n)===z&&C.neighbors(m,n,false).length>=3).map(n=>{const [x,y]=pos(n);return '<rect x="'+(x-12)+'" y="'+(y-12)+'" width="24" height="24" rx="3" fill="#56645b"/>';}).join('');
  const shadow=z?'<g fill="none" stroke="#10251d" stroke-width="34" opacity=".5" transform="translate(1 4)">'+outer+'</g>':'';
  const rails=m.mode==='metro'?'<g fill="none" stroke="#b8d3c7" stroke-width="1" stroke-dasharray="2 4">'+outer+'</g>':'';
  return shadow+'<g fill="none" stroke="'+(z>0?'#a0b3a7':'#86917c')+'" stroke-width="30" stroke-linecap="round">'+outer+'</g><g fill="none" stroke="'+(z<0?'#455c53':z>0?'#62776d':'#56645b')+'" stroke-width="26" stroke-linecap="round">'+inner+'</g><g fill="none" stroke="#c8c7a5" stroke-width=".8" stroke-dasharray="4 7" opacity=".6">'+lanes+'</g>'+junctions+rails+arrows;
 }
 function bridges(m,z){return m.bridges.filter(b=>C.level(b.node)===z).map(b=>{const [x,y]=pos(b.node);let arrows='';for(const r of m.roads.filter(r=>(r.a===b.node||r.b===b.node)&&(C.xy(r.a)[1]===C.xy(r.b)[1]?'ew':'ns')===b.over)){const f=r.b===b.node?.72:.28;if(r.dir!=='reverse')arrows+=arrow(r.a,r.b,f,r.dir==='both'?6:0);if(r.dir!=='forward')arrows+=arrow(r.b,r.a,1-f,r.dir==='both'?6:0);}return '<g data-bridge="'+b.node+'" data-over="'+b.over+'"><g transform="translate('+x+' '+y+') rotate('+(b.over==='ew'?0:90)+')"><rect x="-34" y="-10" width="68" height="30" rx="1" fill="#0b2017" opacity=".6"/><rect x="-34" y="-14" width="68" height="28" fill="#56645b"/><path d="M-34 -14H34M-34 14H34" stroke="#8b967e" stroke-width="1.5"/><path d="M-34 0H34" stroke="#c8c7a5" stroke-width=".8" stroke-dasharray="4 7" opacity=".6"/></g>'+arrows+'</g>';}).join('');}
 function markers(m,z){
  let html='';
  if(m.mode==='metro')for(const [i,n] of m.stations.entries()){
   if(C.level(n)!==z)continue;const [x,y]=pos(n),near=C.neighbors(m,n,false),[u,v]=near.length?pos(near[0]):[x+40,y],angle=Math.atan2(v-y,u-x)*180/Math.PI,terminal=near.length===1,start=terminal?0:-45;
   html+='<g data-station="'+n+'" transform="translate('+x+' '+y+')"><g transform="rotate('+angle+')"><rect x="'+start+'" y="-19" width="90" height="6" rx="2" fill="#a9d9ca"/><rect x="'+start+'" y="13" width="90" height="6" rx="2" fill="#a9d9ca"/></g><circle r="12" fill="#224138" stroke="#b0e8d9" stroke-width="2"/><text text-anchor="middle" y="4" fill="#d2fff1" font-size="10" font-weight="700">M</text><rect x="-29" y="-40" width="58" height="17" rx="4" fill="#153b31"/><text y="-28" text-anchor="middle" fill="#b5ebdc" font-size="9">站台 '+(i+1)+'</text></g>';
  }else{
   m.sources.forEach((s,i)=>{if(C.level(s.node)!==z)return;const [x,y]=pos(s.node),letter=String.fromCharCode(65+i);html+='<g transform="translate('+x+' '+y+')"><circle r="17" fill="#263d2c" stroke="#b7e894" stroke-width="2"/><circle r="12" fill="#b7e894"/><text text-anchor="middle" y="4" fill="#263c25" font-size="11" font-weight="700">'+letter+'</text><rect x="-26" y="-42" width="52" height="18" rx="4" fill="#1b3224"/><text x="0" y="-30" text-anchor="middle" fill="#b7e894" font-size="9">入口 '+letter+'</text></g>';});
   m.exits.forEach((n,i)=>{if(C.level(n)!==z)return;const [x,y]=pos(n);html+='<g transform="translate('+x+' '+y+')"><circle r="16" fill="#26372b" stroke="#ecb17c" stroke-width="2"/><path d="M-7 0H7m-5-5 5 5-5 5" stroke="#ecb17c" stroke-width="2" fill="none"/><rect x="-26" y="-42" width="52" height="18" rx="4" fill="#352e24"/><text x="0" y="-30" text-anchor="middle" fill="#ecb17c" font-size="9">出口 '+(i+1)+'</text></g>';});
  }
  for(const s of m.signals){if(C.level(s.node)!==z)continue;const [x,y]=pos(s.node);html+='<g transform="translate('+(x+13)+' '+(y-29)+')"><rect width="23" height="14" rx="5" fill="#17241e" stroke="#739b83"/><circle data-light-ew="'+s.node+'" cx="6.5" cy="7" r="3.3"/><circle data-light-ns="'+s.node+'" cx="16.5" cy="7" r="3.3"/></g>';}
  return html;
 }
 function staticScene(m,selected=0,only=false){
  const allowed=z=>!only||z===selected,groups=z=>'<g data-elevation="'+z+'"><g class="level-roads">'+roads(m,z)+'</g><g class="level-markers">'+markers(m,z)+'</g><g class="level-under-cars"></g><g class="level-bridges">'+bridges(m,z)+'</g><g class="level-cars"></g></g>';
  return {roads:allowed(0)?roads(m,0):'',markers:allowed(0)?markers(m,0):'',bridges:allowed(0)?bridges(m,0):'',below:levels(m).filter(z=>z<0&&allowed(z)).map(groups).join(''),above:levels(m).filter(z=>z>0&&allowed(z)).map(groups).join('')};
 }
 function motion(m,sim,selected=0,only=false){
  const result=new Map([[0,{under:'',over:''}]]),colors=['#c6e9ab','#e9b788','#a4d5de','#d9c6e7','#eddca0'];
  for(const c of sim.cars)for(const part of m.mode==='metro'?sim.parts(c):[{a:c.path[c.i],b:c.path[c.i+1],p:c.p,index:0}]){
   const {a,b,p,index}=part,z=roadLevel({a,b});if(only&&z!==selected)continue;const [ax,ay]=pos(a),[bx,by]=pos(b),dx=bx-ax,dy=by-ay,len=Math.hypot(dx,dy),axis=C.xy(a)[1]===C.xy(b)[1]?'ew':'ns',x=ax+dx*p-dy/len*6,y=ay+dy*p+dx/len*6;
   let under=false,layer='ground';const bridge=C.bridgeAt(m,a)||C.bridgeAt(m,b);if(bridge&&(bridge.node===a?p:1-p)*40<35){under=axis!==bridge.over;layer=under?'under':'over';}
   const metro=m.mode==='metro',state=metro?(c.waiting?'stopped':'forward'):c.reversing?'reverse':sim.time<(c.holdUntil||0)?'yielding':'forward',fill=metro?colors[c.line%colors.length]:colors[c.source%colors.length]||colors[0];
   let html='<g data-car-id="'+c.id+'"'+(metro?' data-train-id="'+c.id+'" data-coach-index="'+(index+1)+'" data-direction="'+c.direction+'" data-station="'+(c.station||'')+'"':'')+' data-height="'+z+'" data-motion="'+state+'" data-progress="'+p+'" data-reroutes="'+(c.reroutes||0)+'" data-segment="'+a+'>'+b+'" data-destination="'+c.path.at(-1)+'" data-layer="'+layer+'" transform="translate('+x+' '+y+') rotate('+(Math.atan2(dy,dx)*180/Math.PI)+')"><title>'+(metro?'列车 '+c.id+' · 第 '+(index+1)+' 节车厢':c.reversing?'后退让行':state==='yielding'?'等待其它车辆先行':'车辆行驶中')+'</title>';
   if(metro)html+='<path d="M-8 0h2" stroke="#9bb5aa" stroke-width="1.4"/>';
   html+='<rect x="-6.5" y="'+(metro?'-4.3':'-3.4')+'" width="13" height="'+(metro?'8.6':'6.8')+'" rx="'+(metro?'1.3':'2')+'" fill="'+fill+'" stroke="'+(c.reversing?'#ffd799':'#1c342b')+'" stroke-width="'+(c.reversing?'1.6':'.7')+'"/><rect x="1" y="-2.5" width="2.8" height="5" rx=".7" fill="#3a5546"/><rect x="-4.2" y="-2.5" width="2" height="5" rx=".5" fill="#5a7057"/>'+(c.reversing?'<path d="M-6 -2v1M-6 1v1" stroke="#fff7db" stroke-width="2"/>':'')+'</g>';
   if(!result.has(z))result.set(z,{under:'',over:''});result.get(z)[under?'under':'over']+=html;
  }
  return result;
 }
 return {pos,path,arrow,roadLevel,levels,levelName,staticScene,motion};
});

/* Editable grid models. Named real-world interchanges are teaching schematics. */
(function(root,factory){if(typeof module==='object')module.exports=factory(require('./core'));else root.TrafficExamples=factory(root.TrafficCore);})(typeof globalThis!=='undefined'?globalThis:this,function(C){
 'use strict';
 function stroke(m,points,dir='both',crossing='connect'){for(let i=1;i<points.length;i++)C.draw(m,points[i-1],points[i],dir,{crossing});}
 function points(v){return v.flatMap((n,i)=>i?C.line(v[i-1],n).slice(1):[n]);}
 function ports(m,pairs){m.sources=pairs.map(p=>({node:p[0],target:''}));m.exits=pairs.map(p=>p[1]);m.demand=12;return m;}
 const fourPorts=[['2,8','1,8'],['22,8','23,8'],['12,2','12,1'],['12,14','12,15']];
 function axes(){const m=C.empty();stroke(m,['1,8','23,8']);stroke(m,['12,1','12,15']);C.setBridge(m,'12,8','ew');return ports(m,fourPorts);}
 function planAll(m){m.sources.forEach((s,i)=>m.exits.forEach((exit,j)=>{if(i!==j){const p=C.route(m,s.node,exit);if(p)C.addRoute(m,p);}}));return m;}
 function city(){const m=C.demo();for(const s of m.sources)for(const p of C.exitRoutes(m,s.node))C.addRoute(m,p);return m;}
 function elevated(){return planAll(axes());}
 function diamond(){
  const m=axes();
  for(const p of [ ['7,8','7,6','10,6','10,4','12,4'],['12,4','14,4','14,6','17,6','17,8'],['17,8','17,10','14,10','14,12','12,12'],['12,12','10,12','10,10','7,10','7,8'] ])stroke(m,p,'forward');
  m.signals=[{node:'12,4',cycle:6,offset:0},{node:'12,12',cycle:6,offset:7}];return planAll(m);
 }
 function cloverleaf(){
  const m=axes(),nw=['7,8','7,4','10,4','10,6','12,6'],ne=['12,4','16,4','16,6','14,6','14,8'],se=['17,8','17,12','14,12','14,10','12,10'],sw=['12,12','8,12','8,10','10,10','10,8'];
  for(const ramp of [nw,ne,se,sw])stroke(m,ramp,'forward');
  const add=p=>C.addRoute(m,points(p));
  add(['2,8','23,8']);add(['22,8','1,8']);add(['12,2','12,15']);add(['12,14','12,1']);
  // Left turns pass the central crossing before following a quadrant loop.
  add(['2,8',...se,'12,1']);add(['12,2',...sw,'23,8']);add(['22,8',...nw,'12,15']);add(['12,14',...ne,'1,8']);
  add(['2,8',...nw,'12,15']);add(['12,2',...ne,'1,8']);add(['22,8',...se,'12,1']);add(['12,14',...sw,'23,8']);return m;
 }
 function ring(){
  const m=C.empty();stroke(m,['7,4','17,4','17,12','7,12','7,4'],'forward');
  for(const p of [['1,8','7,8'],['17,8','23,8'],['12,1','12,4'],['12,12','12,15']])stroke(m,p);
  return planAll(ports(m,fourPorts));
 }
 function panlong(){
  const m=C.empty();stroke(m,['1,8','23,8']);stroke(m,['9,1','9,15']);stroke(m,['15,1','15,15']);C.setBridge(m,'9,8','ew');C.setBridge(m,'15,8','ns');
  stroke(m,['5,4','19,4','19,12','5,12','5,4'],'forward','over');
  for(const p of [['9,6','12,6','12,10','15,10'],['15,6','17,6','17,10','9,10'],['5,8','5,6','9,6'],['19,8','19,10','15,10'],['9,10','5,10','5,8']])stroke(m,p,'forward','over');
  return planAll(ports(m,[['2,8','1,8'],['22,8','23,8'],['9,2','9,1'],['9,14','9,15'],['15,2','15,1'],['15,14','15,15']]));
 }
 const catalog=[
  {id:'city',name:'城市信号路网',tag:'入门 · 平面路口',description:'从原有城市案例开始，观察红绿灯与多出口分流。',factory:city},
  {id:'elevated',name:'双层高架跨线',tag:'高架 · 两层直行',description:'东西高架跨过南北道路，桥上桥下独立通行。',factory:elevated},
  {id:'diamond',name:'菱形立交',tag:'匝道 · 信号控制',description:'四条定向匝道接入主路，在两端信号路口换向。',factory:diamond},
  {id:'cloverleaf',name:'四叶草立交',tag:'经典 · 网格化示意',description:'四个象限的回环匝道，指定左转路线先过桥再绕行。',factory:cloverleaf},
  {id:'panlong',name:'盘龙立交',tag:'复杂 · 简化示意',description:'多处上下跨线与交织匝道，体验复杂枢纽的定向车流。',factory:panlong},
  {id:'ring',name:'单向环形分流',tag:'环路 · 顺向汇入',description:'四个方向接入单向环路，沿同一方向绕行至各出口。',factory:ring}
 ];
 function create(id){const item=catalog.find(e=>e.id===id);if(!item)throw Error('未找到这个示例');return C.validate(item.factory());}
 return {catalog:catalog.map(({factory,...info})=>Object.freeze(info)),create};
});

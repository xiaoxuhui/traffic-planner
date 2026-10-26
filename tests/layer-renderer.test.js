const {test}=require('node:test'),assert=require('node:assert/strict');const C=require('../src/core'),L=require('../src/layer-renderer'),{Simulation}=require('../src/simulation');
test('complete road and car groups are split by physical height in increasing paint order',()=>{
 const m=C.empty();for(const z of [-1,0,1,2]){C.draw(m,C.node(2,8,z),C.node(18,8,z));m.sources.push({node:C.node(2,8,z),target:''});m.exits.push(C.node(18,8,z));}const scene=L.staticScene(m),s=new Simulation(m,()=>0);s.advance(3);
 assert.match(scene.below,/data-elevation="-1"/);assert.ok(scene.above.indexOf('data-elevation="1"')<scene.above.indexOf('data-elevation="2"'));assert.ok(!scene.roads.includes('@1'));const motion=L.motion(m,s);for(const z of [-1,0,1,2])assert.match(motion.get(z).over,new RegExp('data-height="'+z+'"'));
 const single=L.staticScene(m,0,true);assert.equal(single.above,'');assert.equal(single.below,'');assert.equal(L.motion(m,s,0,true).size,1);
});
test('metro stations render once rather than overlapping source and exit markers',()=>{
 const m=C.empty('metro');C.draw(m,'1,8','23,8');for(const x of [1,12,23])C.addStation(m,x+',8');C.addRoute(m,C.line('1,8','23,8'));const scene=L.staticScene(m),s=new Simulation(m),body=L.motion(m,s).get(0).over;
 assert.equal((scene.markers.match(/data-station=/g)||[]).length,3);assert.ok(!scene.markers.includes('入口'));assert.equal((body.match(/data-coach-index=/g)||[]).length,6);
});
test('six-coach trains follow an explicit ramp without changing the line or collapsing layers',()=>{
 const m=C.empty('metro');C.draw(m,'1,8','7,8');C.ramp(m,'7,8','11,8@1');C.draw(m,'11,8@1','23,8@1');for(const n of ['1,8','4,8','11,8@1','15,8@1','19,8@1','23,8@1'])C.addStation(m,n);C.addRoute(m,C.route(m,'1,8','23,8@1'));const s=new Simulation(m);let usedBoth=false;
 for(let f=0;f<3000;f++){s.advance(1/30);for(const c of s.cars){assert.equal(s.parts(c).length,6);for(const part of s.parts(c))assert.ok(part.p>=0&&part.p<=1);const levels=new Set(s.parts(c).map(p=>L.roadLevel(p)));if(levels.size>1)usedBoth=true;}}
 assert.ok(usedBoth);for(const n of m.stations)assert.ok(s.destinations[n]>0);
});

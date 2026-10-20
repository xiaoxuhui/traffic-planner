const {test}=require('node:test'),assert=require('node:assert/strict');const C=require('../src/core'),{Simulation}=require('../src/simulation');
function parallel(){const m=C.empty();C.draw(m,'1,1','8,1');C.draw(m,'3,1','3,4');C.draw(m,'3,4','6,4');C.draw(m,'6,4','6,1');m.sources=[{node:'1,1',target:''}];m.exits=['8,1'];return m;}
function traffic(){return [3,4,5].map((x,i)=>({id:i+20,path:C.line(x+',1','8,1'),i:0,p:0.7,born:0,waiting:true,admitted:false,lock:null,source:-1}));}
test('weighted routing can use a longer connected bypass instead of a loaded shortest path',()=>{
 const m=parallel();const p=C.weightedRoute(m,'1,1','8,1',(a,b)=>C.xy(a)[1]===1&&C.xy(b)[1]===1&&C.xy(a)[0]>=3&&C.xy(a)[0]<6?15:1);assert.ok(p.includes('3,4'));assert.ok(C.canFollow(m,p));
});
test('new automatic vehicles use the available diversion under congestion',()=>{
 const m=parallel();m.signals=[{node:'6,1',cycle:6,offset:7}];const s=new Simulation(m,()=>0);s.cars=traffic();s.step(1/30);const car=s.cars.find(c=>c.source===0);assert.ok(car);assert.ok(car.path.includes('3,4'));
});
test('explicit instructions remain exact even when an automatic detour is less loaded',()=>{
 const m=parallel(),p=C.line('1,1','8,1');C.addRoute(m,p);m.signals=[{node:'6,1',cycle:6,offset:7}];const s=new Simulation(m,()=>0);s.cars=traffic();s.step(1/30);assert.deepEqual(s.cars.find(c=>c.source===0).path,p);
});
test('vehicles already on the road never change their selected path',()=>{
 const m=parallel(),s=new Simulation(m,()=>0);s.advance(0.1);const car=s.cars[0],before=[...car.path];s.cars.push(...traffic());s.advance(0.2);assert.deepEqual(car.path,before);
});
test('weighted paths still respect one-way restrictions and overpass separation',()=>{
 const m=C.empty();C.draw(m,'1,5','9,5','forward');C.draw(m,'5,1','5,9');C.setBridge(m,'5,5','ew');
 assert.equal(C.weightedRoute(m,'1,5','5,9',()=>1),null);assert.equal(C.weightedRoute(m,'9,5','1,5',()=>1),null);assert.ok(C.weightedRoute(m,'1,5','9,5',()=>1));
});
test('the four previously ignored diversion edges carry actual traffic in the saved network',()=>{
 const m=C.validate(require('./fixtures/diversion-grid.json'));let seed=9;const s=new Simulation(m,()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;});const used=new Set();
 for(let i=0;i<1800;i++){s.advance(0.1);for(const c of s.cars)used.add(C.key(c.path[c.i],c.path[c.i+1]));}
 for(const [a,b] of [['7,5','7,6'],['7,5','8,5'],['11,10','12,10'],['12,10','12,9']])assert.ok(used.has(C.key(a,b)),'unused diversion '+a+' → '+b);
 assert.ok(s.arrived>0);
});

const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../src/core'),{Simulation}=require('../src/simulation');
function crossing(){const m=C.empty();C.draw(m,'1,5','9,5');C.draw(m,'5,1','5,9');return m;}
test('bridge separates crossing paths: straight allowed, turning forbidden',()=>{
 const m=crossing();assert.ok(C.route(m,'1,5','5,9'));C.setBridge(m,'5,5','ew');
 assert.ok(C.route(m,'1,5','9,5'));assert.ok(C.route(m,'5,1','5,9'));assert.equal(C.route(m,'1,5','5,9'),null);assert.equal(C.route(m,'5,1','9,5'),null);
 m.exits=['9,5','5,9'];assert.deepEqual(C.exitRoutes(m,'1,5').map(p=>p.at(-1)),['9,5']);
});
test('bridge directions obey one-way roads for either deck choice',()=>{
 const m=crossing();C.setBridge(m,'5,5','ns');const r=m.roads.find(r=>r.a==='5,5'&&r.b==='6,5');r.dir='reverse';
 assert.equal(C.route(m,'1,5','9,5'),null);assert.ok(C.route(m,'9,5','1,5'));assert.ok(C.route(m,'5,1','5,9'));
});
test('removing bridge restores turns and removing road cleans bridge',()=>{
 const m=crossing();C.setBridge(m,'5,5','ew');m.bridges=[];assert.ok(C.route(m,'1,5','5,9'));
 C.setBridge(m,'5,5','ew');C.eraseNode(m,'4,5');assert.deepEqual(m.bridges,[]);
});
test('bridge rejects non-crossings and source/exit nodes, replaces planar lights',()=>{
 const m=crossing();assert.throws(()=>C.setBridge(m,'1,5','ew'));m.exits=['5,5'];assert.throws(()=>C.setBridge(m,'5,5','ew'));m.exits=[];
 m.signals=[{node:'5,5',cycle:6,offset:0}];C.setBridge(m,'5,5','ew');assert.equal(m.signals.length,0);assert.equal(C.bridgeAt(m,'5,5').over,'ew');
});
test('bridge save roundtrip and legacy files without bridges are compatible',()=>{
 const m=crossing();C.setBridge(m,'5,5','ns');assert.deepEqual(C.validate(JSON.parse(JSON.stringify(m))),m);
 const old=C.demo();delete old.bridges;assert.deepEqual(C.validate(old).bridges,[]);
 const bad=crossing();bad.bridges=[{node:'1,5',over:'ew'}];assert.throws(()=>C.validate(bad));
 const bad2=crossing();bad2.bridges=[{node:'5,5',over:'up'}];assert.throws(()=>C.validate(bad2));
});
test('two layers carry both streams without a shared intersection lock',()=>{
 const m=crossing();C.setBridge(m,'5,5','ew');m.sources=[{node:'1,5',target:''},{node:'5,1',target:''}];m.exits=['9,5','5,9'];m.demand=40;
 const s=new Simulation(m,()=>0);s.advance(50);assert.ok(s.destinations['9,5']>5);assert.ok(s.destinations['5,9']>5);assert.equal(s.locks.size,0);
});
test('search can revisit the bridge from a different approach after a valid detour',()=>{
 const m=crossing();C.setBridge(m,'5,5','ew');C.draw(m,'8,5','8,2');C.draw(m,'8,2','5,2');
 const p=C.route(m,'1,5','5,9');assert.ok(p);assert.equal(p.filter(n=>n==='5,5').length,2);
});

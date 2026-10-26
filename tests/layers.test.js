const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../src/core'),{Simulation}=require('../src/simulation');
test('three parallel roads at the same coordinates retain independent identities',()=>{
 const m=C.empty();for(const z of [0,1,2])C.draw(m,C.node(2,8,z),C.node(12,8,z),'forward');
 assert.equal(m.roads.length,30);C.draw(m,C.node(2,8,1),C.node(12,8,1),'forward');assert.equal(m.roads.length,30);
 for(const z of [0,1,2]){assert.ok(C.route(m,C.node(2,8,z),C.node(12,8,z)));assert.equal(C.route(m,C.node(12,8,z),C.node(2,8,z)),null);}
 assert.equal(C.route(m,'2,8','12,8@1'),null);assert.equal(C.route(m,'2,8@1','12,8@2'),null);
});
test('same-height junctions connect while overlaid different heights do not',()=>{
 const m=C.empty();C.draw(m,'2,8','12,8');C.draw(m,'7,3@1','7,13@1');assert.equal(C.route(m,'2,8','7,13@1'),null);
 C.draw(m,'2,8@1','12,8@1');assert.ok(C.route(m,'2,8@1','7,13@1'));assert.equal(C.route(m,'2,8','12,8@1'),null);
});
test('only an explicit ramp connects consecutive heights, preserving direction',()=>{
 const m=C.empty();C.draw(m,'2,8','5,8','forward');C.ramp(m,'5,8','9,8@1','forward');C.draw(m,'9,8@1','13,8@1','forward');C.ramp(m,'13,8@1','17,8@2','forward');
 const p=C.route(m,'2,8','17,8@2');assert.ok(p);assert.ok(p.some(n=>C.level(n)===1));assert.equal(C.route(m,'17,8@2','2,8'),null);assert.ok(C.canFollow(m,p));
 assert.throws(()=>C.draw(m,'1,1','3,1@1'));assert.throws(()=>C.ramp(m,'1,1','3,1@2'));
});
test('elevated and underground roads roundtrip, and deletion leaves other layers alone',()=>{
 const m=C.empty();for(const z of [-2,0,1,2])C.draw(m,C.node(2,8,z),C.node(12,8,z));m.sources=[{node:'2,8@2',target:''}];m.exits=['12,8@2'];
 assert.deepEqual(C.validate(JSON.parse(JSON.stringify(m))),m);C.eraseNode(m,'7,8@1');assert.ok(C.route(m,'2,8','12,8'));assert.ok(C.route(m,'2,8@2','12,8@2'));assert.equal(C.route(m,'2,8@1','12,8@1'),null);
 assert.ok(C.valid('1,1@-8'));assert.ok(C.valid('1,1@8'));for(const n of ['1,1@0','1,1@9','1,1@-9','1,1@01','25,1@1'])assert.equal(C.valid(n),false);
});
test('cars on three coincident layers reach only their own layer exit',()=>{
 const m=C.empty();for(const z of [0,1,2]){C.draw(m,C.node(2,8,z),C.node(12,8,z));m.sources.push({node:C.node(2,8,z),target:''});m.exits.push(C.node(12,8,z));}
 const s=new Simulation(m,()=>0);s.advance(30);for(const n of m.exits)assert.ok(s.destinations[n]>0);assert.equal(s.locks.size,0);
});
test('drawing over a parallel existing road selects one height for the whole new stroke',()=>{
 const m=C.empty();C.draw(m,'2,8','12,8','forward');assert.equal(C.drawingLevel(m,'2,8','16,8','over'),1);C.draw(m,'2,8@1','16,8@1','forward');assert.equal(C.drawingLevel(m,'2,8','16,8','over'),2);assert.equal(C.drawingLevel(m,'2,8@2','16,8@2','over'),2);assert.equal(C.drawingLevel(m,'2,8','16,8','under'),-1);assert.equal(C.drawingLevel(m,'2,8','16,8','connect'),0);
});

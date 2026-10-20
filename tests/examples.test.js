const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../src/core'),E=require('../src/examples'),{Simulation}=require('../src/simulation');
test('example library includes six distinct editable road networks',()=>{
 assert.equal(E.catalog.length,6);assert.equal(new Set(E.catalog.map(e=>e.id)).size,6);
 assert.equal(new Set(E.catalog.map(e=>JSON.stringify(E.create(e.id).roads))).size,6);
 const a=E.create('panlong');a.roads.length=0;assert.ok(E.create('panlong').roads.length>100);assert.throws(()=>E.create('missing'));
 assert.ok(E.create('panlong').bridges.length>=4);assert.equal(E.create('ring').bridges.length,0);
 assert.ok(E.create('ring').roads.some(r=>r.dir!=='both'));
});
for(const item of E.catalog){
 test(item.id+': all entrances have valid assigned routes and fresh JSON roundtrips',()=>{
  const m=E.create(item.id);assert.deepEqual(C.validate(JSON.parse(JSON.stringify(m))),m);
  for(const s of m.sources){const paths=C.exitRoutes(m,s.node);assert.ok(paths.length>0,s.node+' has no route');assert.ok(m.routes.some(r=>r.nodes[0]===s.node));for(const p of paths){assert.ok(C.canFollow(m,p));assert.ok(m.exits.includes(p.at(-1)));}}
  for(const r of m.routes)assert.ok(C.canFollow(m,r.nodes),'invalid route');
 });
 test(item.id+': traffic continues to arrive from every entrance',()=>{
  let seed=9;const m=E.create(item.id),s=new Simulation(m,()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;});
  for(let minute=0;minute<4;minute++){const before=s.arrived;s.advance(60);assert.ok(s.arrived>before,'no arrivals in minute '+(minute+1));}
  assert.equal(s.blockedSources.length,0);assert.ok(s.nextId>m.sources.length*10);
  // Run each entry on its own to verify its routes really reach an exit.
  for(const source of m.sources){const only=C.validate(m);only.sources=[source];only.routes=only.routes.filter(r=>r.nodes[0]===source.node);const traffic=new Simulation(only,()=>0.5);traffic.advance(100);assert.ok(traffic.arrived>0,'entry '+source.node+' never arrives');}
 });
}
test('cloverleaf left-turn routes go past the bridge before using a loop ramp',()=>{
 const m=E.create('cloverleaf');const westToNorth=m.routes.find(r=>r.nodes[0]==='2,8'&&r.nodes.at(-1)==='12,1').nodes;
 assert.ok(westToNorth.indexOf('12,8')<westToNorth.indexOf('17,8'));assert.ok(westToNorth.includes('17,12'));
});

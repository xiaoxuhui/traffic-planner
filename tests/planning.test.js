const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../src/core'),{Simulation}=require('../src/simulation');
test('a long stroke crosses an existing road without joining, drawn road can be on top or below',()=>{
 const m=C.empty();C.draw(m,'5,1','5,9');C.draw(m,'1,5','9,5','both',{crossing:'over'});assert.equal(C.bridgeAt(m,'5,5').over,'ew');assert.equal(C.route(m,'1,5','5,9'),null);
 const n=C.empty();C.draw(n,'5,1','5,9');C.draw(n,'1,5','9,5','both',{crossing:'under'});assert.equal(C.bridgeAt(n,'5,5').over,'ns');
});
test('ending a road at the intersection explicitly joins it; connecting mode joins mid-stroke',()=>{
 const m=C.empty();C.draw(m,'5,1','5,9');C.draw(m,'1,5','5,5','both',{crossing:'over'});C.draw(m,'5,5','9,5','both',{crossing:'over'});assert.equal(C.bridgeAt(m,'5,5'),undefined);assert.ok(C.route(m,'1,5','5,9'));
 C.setBridge(m,'5,5','ew');C.draw(m,'1,5','9,5','both',{crossing:'connect'});assert.equal(C.bridgeAt(m,'5,5'),undefined);
});
function network(){const m=C.empty();C.draw(m,'1,1','8,1');C.draw(m,'3,1','3,5');C.draw(m,'3,5','8,5');C.draw(m,'8,5','8,1');m.sources=[{node:'1,1',target:''}];m.exits=['8,1','8,5'];return m;}
test('vehicles obey the full chosen route rather than taking a shorter graph path',()=>{
 const m=network(),p=[...C.line('1,1','3,1'),...C.line('3,1','3,5').slice(1),...C.line('3,5','8,5').slice(1),...C.line('8,5','8,1').slice(1)];C.addRoute(m,p);
 assert.deepEqual(C.exitRoutes(m,'1,1'),[p]);const s=new Simulation(m);s.advance(0.1);assert.deepEqual(s.cars[0].path,p);
});
test('a broken user route blocks spawning instead of silently choosing a different path',()=>{
 const m=network();C.addRoute(m,C.line('1,1','8,1'));const r=m.roads.find(r=>r.a==='4,1'&&r.b==='5,1');r.dir='reverse';C.cleanup(m);
 const s=new Simulation(m);s.advance(20);assert.equal(s.cars.length,0);assert.equal(s.blockedSources.length,1);assert.equal(m.routes.length,1);assert.equal(C.validate(m).routes.length,1);
});
test('routes reject missing roads, backwards one-way use, immediate U turns and cross-layer turns',()=>{
 const m=network();assert.throws(()=>C.addRoute(m,['1,1','1,2','8,1']));assert.throws(()=>C.addRoute(m,['1,1','2,1','1,1','2,1','3,1','4,1','5,1','6,1','7,1','8,1']));
 m.roads.find(r=>r.a==='4,1'&&r.b==='5,1').dir='reverse';assert.throws(()=>C.addRoute(m,C.line('1,1','8,1')));
 const n=C.empty();C.draw(n,'1,5','9,5');C.draw(n,'5,1','5,9');n.sources=[{node:'1,5',target:''}];n.exits=['5,9'];C.setBridge(n,'5,5');assert.throws(()=>C.addRoute(n,[...C.line('1,5','5,5'),...C.line('5,5','5,9').slice(1)]));
});
test('multiple routes allow random exits and saved routes roundtrip; old saves gain an empty list',()=>{
 const m=network();C.addRoute(m,C.line('1,1','8,1'));C.addRoute(m,[...C.line('1,1','3,1'),...C.line('3,1','3,5').slice(1),...C.line('3,5','8,5').slice(1)]);let i=0;const s=new Simulation(m,()=>i++%2?0.99:0);s.advance(50);assert.ok(s.destinations['8,1']>0);assert.ok(s.destinations['8,5']>0);assert.deepEqual(C.validate(m),m);
 const old=C.empty();delete old.routes;assert.deepEqual(C.validate(old).routes,[]);
});

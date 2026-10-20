const {test}=require('node:test');
const assert=require('node:assert/strict');
const C=require('../src/core.js');
test('draw a continuous orthogonal road without duplicates',()=>{
 const m=C.empty(); C.draw(m,'1,2','4,5','both'); C.draw(m,'1,2','4,5','both');
 assert.equal(m.roads.length,6); assert.equal(C.route(m,'1,2','4,5').length,7);
});
test('forward/reverse directions survive endpoint normalization',()=>{
 const m=C.empty(); C.draw(m,'4,1','1,1','forward');
 assert.ok(C.route(m,'4,1','1,1')); assert.equal(C.route(m,'1,1','4,1'),null);
 m.roads.forEach(r=>C.setDirection(r,'both')); assert.ok(C.route(m,'1,1','4,1'));
});
test('route finds a reachable exit or requested target',()=>{
 const m=C.empty(); C.draw(m,'1,1','5,1'); m.exits=['3,1','5,1'];
 assert.equal(C.route(m,'1,1').at(-1),'3,1'); assert.equal(C.route(m,'1,1','5,1').at(-1),'5,1');
 assert.equal(C.route(m,'0,0'),null);
});
test('delete isolated node clears attachments and target references',()=>{
 const m=C.empty(); C.draw(m,'1,1','2,1'); m.sources=[{node:'1,1',target:'2,1'}]; m.exits=['2,1']; m.signals=[{node:'1,1',cycle:6,offset:0}];
 C.eraseNode(m,'2,1'); assert.equal(m.roads.length,0); assert.deepEqual(m.sources,[]); assert.deepEqual(m.signals,[]);
});
test('signals alternate axes and include all-red clearance',()=>{
 const s={cycle:6,offset:0}; assert.equal(C.green(s,0,'ew'),true); assert.equal(C.green(s,0,'ns'),false);
 assert.equal(C.green(s,6.5,'ew'),false); assert.equal(C.green(s,6.5,'ns'),false); assert.equal(C.green(s,8,'ns'),true);
});
test('valid save round trip and demo has reachable sources',()=>{
 const m=C.demo(); assert.deepEqual(C.validate(JSON.parse(JSON.stringify(m))),m);
 for(const s of m.sources) assert.ok(C.route(m,s.node,s.target));
});
test('invalid imported graphs rejected including duplicate edges and missing targets',()=>{
 const bad=[{}, {...C.empty(),demand:NaN}, {...C.empty(),roads:[{a:'0,0',b:'4,0',dir:'both'}]}, {...C.empty(),roads:[{a:'0,0',b:'1,0',dir:'oops'}]}];
 for(const v of bad) assert.throws(()=>C.validate(v));
 const m=C.demo(); m.sources[0].target='24,16'; assert.throws(()=>C.validate(m));
 const n=C.demo(); n.roads.push(n.roads[0]); assert.throws(()=>C.validate(n));
});
test('out-of-grid coordinates and zero-length drawings are handled',()=>{
 const m=C.empty(); C.draw(m,'1,1','1,1'); assert.equal(m.roads.length,0);
 assert.throws(()=>C.draw(m,'-1,1','1,1')); assert.throws(()=>C.draw(m,'1,1','25,1'));
});
test('reachable exit routes include all reachable destinations and exclude disconnected ones',()=>{
 const m=C.empty();C.draw(m,'1,1','5,1');C.draw(m,'9,9','10,9');m.exits=['3,1','5,1','10,9'];
 assert.deepEqual(C.exitRoutes(m,'1,1').map(p=>p.at(-1)),['3,1','5,1']);assert.deepEqual(C.exitRoutes(m,'0,0'),[]);
});
test('legacy fixed source targets are cleared on load',()=>{
 const m=C.demo();m.sources[0].target=m.exits[0];assert.equal(C.validate(m).sources[0].target,'');
});

const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../src/core'),{Simulation}=require('../src/simulation');
function metro(count=6,z=0){const m=C.empty('metro');C.draw(m,C.node(1,8,z),C.node(23,8,z));for(let i=0;i<count;i++)C.addStation(m,C.node(1+Math.floor(i*22/Math.max(1,count-1)),8,z));if(count>1)C.addRoute(m,C.line(C.node(1,8,z),C.node(23,8,z)));return m;}
test('metro platforms are both entry and exit, roundtrip and cleanup preserve this',()=>{
 const m=metro(6);assert.equal(m.mode,'metro');assert.equal(m.trainCars,6);assert.deepEqual(m.sources.map(s=>s.node),m.stations);assert.deepEqual(m.exits,m.stations);assert.deepEqual(C.validate(JSON.parse(JSON.stringify(m))),m);
 C.eraseNode(m,m.stations[2]);assert.equal(m.stations.length,5);assert.deepEqual(m.sources.map(s=>s.node),m.exits);
 const road=C.empty();C.draw(road,'1,1','2,1');road.sources=[{node:'1,1',target:''}];road.exits=['1,1'];assert.throws(()=>C.validate(road));
});
test('fixed train pool is floor(platform count / 3), with six coaches each',()=>{
 for(const n of [0,1,2,3,6,8,9]){const m=metro(n),s=new Simulation(m);assert.equal(s.trainCount,Math.floor(n/3));assert.equal(s.cars.length+s.pendingTrains.length,s.trainCount);for(const c of s.cars)assert.equal(s.parts(c).length,6);s.advance(60);assert.ok(s.cars.length<=s.trainCount);s.reset();assert.equal(s.cars.length+s.pendingTrains.length,s.trainCount);}
});
test('trains stop at every platform, then reverse at terminals on the exact hand-drawn line',()=>{
 const m=metro(3),s=new Simulation(m),seen=new Set(),path=[...m.routes[0].nodes];let changes=0,lastDirection=s.cars[0].direction;
 for(let i=0;i<2400;i++){s.advance(1/30);const c=s.cars[0];if(c.station&&c.waiting)seen.add(c.station);if(c.direction!==lastDirection){changes++;lastDirection=c.direction;}assert.deepEqual(c.path,c.direction===1?path:[...path].reverse());}
 assert.equal(seen.size,3);assert.ok(changes>=2);assert.ok(s.destinations[m.stations[1]]>=2);assert.ok(s.arrived>=4);
});
test('single-direction or too-short shuttle lines do not silently choose a different route',()=>{
 const m=metro(3);m.roads.forEach(r=>r.dir='forward');const s=new Simulation(m);s.advance(30);assert.equal(s.cars.length,0);assert.equal(s.pendingTrains.length,1);assert.ok(s.issues.length);
 const tiny=C.empty('metro');C.draw(tiny,'1,1','3,1');for(const n of ['1,1','2,1','3,1'])C.addStation(tiny,n);C.addRoute(tiny,C.line('1,1','3,1'));const short=new Simulation(tiny);assert.equal(short.cars.length,0);assert.ok(short.issues.some(t=>t.includes('短')));
});
test('same-track train bodies maintain whole-train spacing through stops and terminal reversal',()=>{
 const s=new Simulation(metro(9));for(let f=0;f<3600;f++){s.advance(1/30);const occupied=s.occupancy();for(let i=0;i<occupied.length;i++)for(let j=i+1;j<occupied.length;j++){const a=occupied[i],b=occupied[j];if(a.id===b.id||a.a!==b.a||a.b!==b.b)continue;assert.ok(a.hi+0.44<=b.lo+1e-8||b.hi+0.44<=a.lo+1e-8);}}
 assert.ok(s.arrived>10);
});
test('dispatch checks following distance across grid nodes, not only a shared segment',()=>{
 const s=new Simulation(metro(3)),a=s.cars[0],b={...a,id:99,s:a.s+s.half*2+0.3};s.cars.push(b);assert.equal(s.bodyFits(a),false);
});
test('a train holds a crossing until its last coach clears and both lines keep serving',()=>{
 const m=C.empty('metro');C.draw(m,'1,8','23,8');C.draw(m,'12,1','12,15');for(const n of ['1,8','7,8','23,8','12,1','12,6','12,15'])C.addStation(m,n);C.addRoute(m,C.line('1,8','23,8'));C.addRoute(m,C.line('12,1','12,15'));const s=new Simulation(m);
 for(let f=0;f<3600;f++){s.advance(1/30);const inside=s.cars.filter(c=>{const i=c.path.indexOf('12,8');return i>=0&&Math.abs(c.s-i)<s.half+0.3-1e-8;});assert.ok(inside.length<=1);for(const c of inside)assert.equal(s.locks.get('12,8'),c.id);}
 for(const n of m.stations)assert.ok(s.destinations[n]>0,'no service at '+n);
});
test('two metro layers stay isolated and both trains continue visiting their own stations',()=>{
 const m=metro(3);C.draw(m,'1,8@1','23,8@1');for(const n of ['1,8@1','12,8@1','23,8@1'])C.addStation(m,n);C.addRoute(m,C.line('1,8@1','23,8@1'));const s=new Simulation(m);s.advance(100);assert.equal(s.trainCount,2);for(const n of m.stations)assert.ok(s.destinations[n]>0);for(const c of s.cars)assert.equal(new Set(c.path.map(C.level)).size,1);
});

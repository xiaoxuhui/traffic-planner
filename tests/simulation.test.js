const {test}=require('node:test');const assert=require('node:assert/strict');
const C=require('../src/core');const {Simulation}=require('../src/simulation');
function simple(){const m=C.empty();C.draw(m,'1,1','8,1');m.sources=[{node:'1,1',target:'8,1'}];m.exits=['8,1'];return m;}
test('cars reach the selected exit and travel time is recorded',()=>{const s=new Simulation(simple());s.advance(30);assert.ok(s.arrived>3);assert.ok(s.average>5);assert.equal(s.destinations['8,1'],s.arrived);});
test('unreachable one-way source never spawns',()=>{const m=simple();m.roads.forEach(r=>r.dir='reverse');const s=new Simulation(m);s.advance(30);assert.equal(s.cars.length,0);assert.equal(s.arrived,0);assert.equal(s.blockedSources.length,1);});
test('red stops at stop line and green releases',()=>{
 const m=simple();m.signals=[{node:'2,1',cycle:6,offset:7}];const s=new Simulation(m);s.advance(1.8);
 assert.ok(s.cars.length);assert.ok(s.cars[0].p<=0.7+1e-6);assert.ok(s.cars[0].waiting);s.advance(25);assert.ok(s.arrived>0);
});
test('same-lane cars keep their minimum gap at high demand',()=>{
 const m=simple();m.demand=60;m.signals=[{node:'4,1',cycle:6,offset:7}];const s=new Simulation(m);
 for(let i=0;i<2400;i++){s.step(1/30);for(const a of s.cars)for(const b of s.cars)if(a.id!==b.id&&a.path[a.i]===b.path[b.i]&&a.path[a.i+1]===b.path[b.i+1])assert.ok(Math.abs(a.p-b.p)>=0.42-1e-6);}
 assert.ok(s.arrived>0);
});
test('cross traffic uses exclusive junction reservation and both streams progress',()=>{
 const m=C.empty();C.draw(m,'1,5','9,5');C.draw(m,'5,1','5,9');m.sources=[{node:'1,5',target:'9,5'},{node:'5,1',target:'5,9'}];m.exits=['9,5','5,9'];m.demand=40;const s=new Simulation(m);
 for(let i=0;i<3600;i++){s.step(1/30);const inside=s.cars.filter(c=>c.path[c.i+1]==='5,5'&&c.p>0.7||c.path[c.i]==='5,5'&&c.p<0.28);assert.ok(inside.length<=1);}
 assert.ok(s.destinations['9,5']>0);assert.ok(s.destinations['5,9']>0);
});
test('reset clears cars, counters, clock and locks',()=>{const s=new Simulation(simple());s.advance(20);s.reset();assert.equal(s.time,0);assert.equal(s.arrived,0);assert.equal(s.cars.length,0);assert.equal(s.locks.size,0);});
test('fixed timestep gives the same simulation at different render intervals',()=>{
 const a=new Simulation(simple()),b=new Simulation(simple());for(let i=0;i<600;i++)a.advance(1/30);for(let i=0;i<200;i++)b.advance(0.1);assert.equal(a.arrived,b.arrived);assert.equal(a.cars.length,b.cars.length);assert.ok(Math.abs(a.time-b.time)<1e-6);
});
test('empty map is safe',()=>{
 const e=new Simulation(C.empty());e.advance(10);assert.equal(e.cars.length,0);
});
function fork(){const m=C.empty();C.draw(m,'5,1','5,5');C.draw(m,'1,5','9,5');m.sources=[{node:'5,1',target:''}];m.exits=['1,5','9,5'];return m;}
test('each new car independently chooses among all reachable exits',()=>{
 let samples=0;const s=new Simulation(fork(),()=>samples++%2?0.999:0);s.advance(50);
 assert.ok(s.destinations['1,5']>0);assert.ok(s.destinations['9,5']>0);assert.equal(samples,s.nextId-1+s.pending.filter(Boolean).length);
});
test('random selection never chooses an unreachable exit',()=>{
 const m=fork();m.roads.filter(r=>r.a.endsWith(',5')&&r.b.endsWith(',5')&&Number(r.a.split(',')[0])<5).forEach(r=>r.dir='forward');
 const s=new Simulation(m,()=>0);s.advance(40);assert.ok(s.destinations['9,5']>0);assert.equal(s.destinations['1,5'],undefined);
});
test('old fixed destination does not pin newly spawned cars',()=>{
 const m=fork();m.sources[0].target='9,5';const s=new Simulation(m,()=>0);s.advance(40);assert.ok(s.destinations['1,5']>0);assert.equal(s.destinations['9,5'],undefined);
});
test('a queued car keeps its random choice until its entry lane is available',()=>{
 const m=fork();m.demand=60;m.signals=[{node:'5,2',cycle:20,offset:0}];let samples=0;const s=new Simulation(m,()=>{samples++;return 0;});s.advance(10);
 assert.ok(s.pending[0]);assert.ok(s.cars.some(c=>c.waiting));const before=samples;s.advance(1);assert.equal(samples,before);
});

const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../src/core'),{Simulation}=require('../src/simulation');
function packedRing({locked=false,red=false,crossing=false}={}){
 const m=C.empty(),ring=['4,4','5,4','5,5','4,5'],ends=['4,3','6,4','6,5','3,5'];
 for(let i=0;i<4;i++){C.draw(m,ring[i],ring[(i+1)%4]);C.draw(m,ring[i],ends[i]);}m.exits=ends;
 if(red)m.signals=[{node:'5,4',cycle:6,offset:7}];
 const s=new Simulation(m);let id=1;
 s.cars=ring.flatMap((n,i)=>[0.7,0.26].map(p=>({id:id++,path:[n,ring[(i+1)%4],ring[(i+2)%4],ends[(i+2)%4]],i:0,p,born:0,waiting:true,admitted:false,lock:null,source:-1})));
 if(locked)for(const c of s.cars.filter(c=>c.p<0.3)){c.lock=c.path[0];s.locks.set(c.lock,c.id);}
 if(crossing){const c={id:id++,path:['4,3','4,4','4,5','3,5'],i:0,p:0.7,born:0,waiting:true,admitted:false,lock:null,source:-1};s.cars.push(c);}
 return s;
}
function assertSpacing(s){
 for(const c of s.cars)for(const o of s.cars){
  if(c===o)continue;const a=c.path[c.i],b=c.path[c.i+1];
  if(o.path[o.i]===a&&o.path[o.i+1]===b&&o.p>c.p)assert.ok(o.p-c.p>=0.44-1e-8,'same-segment gap');
  if(c.path[c.i+2]&&o.path[o.i]===b&&o.path[o.i+1]===c.path[c.i+2])assert.ok(1+o.p-c.p>=0.44-1e-8,'cross-segment gap');
 }
}
for(const locked of [false,true])test('multi-car gridlock clears with safe spacing and unchanged routes; held locks='+locked,()=>{
 const s=packedRing({locked}),cars=[...s.cars],paths=cars.map(c=>[...c.path]);
 for(let i=0;i<600;i++){s.advance(1/30);assertSpacing(s);}
 assert.equal(s.arrived,8,'all eight cars must escape the initially stationary queue');assert.deepEqual(cars.map(c=>c.path),paths);assert.ok(s.releasedQueues>0);assert.equal(s.locks.size,0);
});
test('packed gridlock waits for red then clears and makes crossing traffic yield',()=>{
 const s=packedRing({locked:true,red:true,crossing:true}),cars=[...s.cars];
 s.advance(2);assert.ok(cars.filter(c=>c.p>=0.7).every(c=>c.i===0&&c.p<=0.7+1e-8));assert.equal(s.releasedQueues||0,0);
 for(let i=0;i<900;i++){s.advance(1/30);assertSpacing(s);const owners=[...s.locks.values()];assert.equal(new Set(owners).size,owners.length);}
 assert.equal(s.arrived,9);assert.equal(s.cars.length,0);
});
test('an entrance yields to traffic already reserved to enter its first segment',()=>{
 const m=C.empty();C.draw(m,'2,3','5,3');m.sources=[{node:'3,3',target:''}];m.exits=['5,3'];
 const s=new Simulation(m),through={id:1,path:C.line('2,3','5,3'),i:0,p:0.8,born:0,waiting:false,admitted:true,lock:null,source:-1};s.cars=[through];s.nextId=2;
 s.advance(0.1);assert.equal(s.nextId,2,'new traffic must not cut in ahead of a reserved through vehicle');
 for(let i=0;i<180;i++){s.advance(1/30);assertSpacing(s);}assert.ok(s.arrived>=2,'the entrance must resume after through traffic clears');
});
test('four busy manual entries keep arriving through an organically formed gridlock',()=>{
 const m=C.validate(require('./fixtures/gridlock-ring.json')),s=new Simulation(m,()=>0);let arrived=0,spawned=0;
 for(let minute=0;minute<6;minute++){
  for(let frame=0;frame<300;frame++){s.advance(1/30);assertSpacing(s);}
  assert.ok(s.arrived>arrived,'arrivals must continue in every ten-second window');assert.ok(s.nextId>spawned);arrived=s.arrived;spawned=s.nextId;
  for(const c of s.cars)assert.ok(m.routes.some(r=>JSON.stringify(r.nodes)===JSON.stringify(c.path)));
 }
 assert.ok(s.arrived>=100);assert.ok(s.releasedQueues>0);assert.equal(s.rerouted,0);
});
test('red-light queue cannot strand a follower holding the previous junction',()=>{
 const m=C.empty();C.draw(m,'2,3','5,3');C.draw(m,'3,2','3,4');C.draw(m,'4,2','4,4');m.exits=['5,3'];m.signals=[{node:'4,3',cycle:20,offset:21}];
 const s=new Simulation(m);const leader={id:1,path:['3,3','4,3','5,3'],i:0,p:0.7,born:0,waiting:false,admitted:false,lock:null,source:0};
 const follower={id:2,path:['2,3','3,3','4,3','5,3'],i:0,p:0.69,born:0,waiting:false,admitted:false,lock:null,source:0};s.cars=[leader,follower];s.advance(8);
 assert.equal(follower.i,0,'follower must wait outside the junction until it can clear it');assert.equal(s.locks.has('3,3'),false);s.advance(40);assert.equal(s.arrived,2);
});
test('high-demand saved road network keeps spawning and arriving for ten simulated minutes',()=>{
 const m=C.validate(require('./fixtures/high-demand-grid.json'));let seed=9;const s=new Simulation(m,()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;});let arrived=0,spawned=0;
 for(let i=0;i<10;i++){s.advance(60);assert.ok(s.arrived>arrived,'no arrivals during minute '+(i+1));assert.ok(s.nextId>spawned,'no spawns during minute '+(i+1));arrived=s.arrived;spawned=s.nextId;}
 assert.ok(s.arrived>1000);assert.ok(s.waiting<s.cars.length);
});
test('a locally clear entrance keeps spawning even when unrelated traffic already exceeds 180 cars',()=>{
 const m=C.empty();C.draw(m,'1,1','5,1');for(let y=4;y<=12;y++)C.draw(m,'0,'+y,'24,'+y);m.sources=[{node:'1,1',target:''}];m.exits=['5,1',...Array.from({length:9},(_,i)=>'24,'+(i+4))];
 const s=new Simulation(m,()=>0);s.cars=Array.from({length:180},(_,i)=>({id:i+1,path:C.line((i%24)+','+(4+Math.floor(i/24)),'24,'+(4+Math.floor(i/24))),i:0,p:0.1,born:0,waiting:false,admitted:false,lock:null,source:-1}));s.nextId=181;s.step(1/30);
 assert.ok(s.cars.some(c=>c.source===0),'unrelated congestion must not stop this free entrance');assert.equal(s.nextId,182);
});
test('a closed queue with one vehicle per segment can advance together without changing routes',()=>{
 const m=C.empty(),ring=['4,4','5,4','5,5','4,5'],ends=['4,3','6,4','6,5','3,5'];for(let i=0;i<4;i++){C.draw(m,ring[i],ring[(i+1)%4]);C.draw(m,ring[i],ends[i]);}m.exits=ends;
 const s=new Simulation(m);s.cars=ring.map((n,i)=>({id:i+1,path:[n,ring[(i+1)%4],ring[(i+2)%4],ends[(i+2)%4]],i:0,p:0.7,born:0,waiting:true,admitted:false,lock:null,source:-1}));const paths=s.cars.map(c=>[...c.path]);
 s.advance(0.1);assert.ok(s.cars.every(c=>c.admitted||c.i>0),'closed queue should receive a coordinated reservation');assert.deepEqual(s.cars.map(c=>c.path),paths);s.advance(10);assert.equal(s.arrived,4);
});
test('coordinated queue movement still waits for red lights',()=>{
 const m=C.empty(),ring=['4,4','5,4','5,5','4,5'],ends=['4,3','6,4','6,5','3,5'];for(let i=0;i<4;i++){C.draw(m,ring[i],ring[(i+1)%4]);C.draw(m,ring[i],ends[i]);}m.exits=ends;m.signals=[{node:'5,4',cycle:6,offset:7}];
 const s=new Simulation(m);s.cars=ring.map((n,i)=>({id:i+1,path:[n,ring[(i+1)%4],ring[(i+2)%4],ends[(i+2)%4]],i:0,p:0.7,born:0,waiting:true,admitted:false,lock:null,source:-1}));s.advance(2);assert.ok(s.cars.every(c=>c.i===0&&c.p<=0.7+1e-8));assert.equal(s.locks.size,0);s.advance(20);assert.equal(s.arrived,4);
});

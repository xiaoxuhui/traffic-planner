const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../src/core'),{Simulation}=require('../src/simulation');
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

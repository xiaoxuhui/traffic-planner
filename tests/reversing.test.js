const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../src/core'),{Simulation}=require('../src/simulation');
function blockedJunction(){
 const m=C.empty();C.draw(m,'2,5','8,5');C.draw(m,'5,3','5,7');m.exits=['8,5','5,3'];m.signals=[{node:'6,5',cycle:20,offset:21}];
 const s=new Simulation(m),car=(id,path,i,p,lock=null)=>({id,path,i,p,lock,born:0,waiting:true,admitted:false,source:-1});
 const leader=car(1,C.line('5,5','8,5'),0,0.7),blocker=car(2,C.line('3,5','8,5'),2,0.26,'5,5'),crossing=car(3,C.line('5,7','5,3'),1,0.7);
 s.cars=[leader,blocker,crossing];s.locks.set('5,5',blocker.id);s.nextId=4;return {s,blocker,crossing};
}
test('a stranded junction owner reverses outside and lets crossing traffic pass first',()=>{
 const {s,blocker,crossing}=blockedJunction(),route=[...blocker.path];let reversed=false,last=blocker.i+blocker.p;
 for(let f=0;f<270;f++){s.advance(1/30);const p=blocker.i+blocker.p;if(p<last-1e-8){reversed=true;assert.ok(last-p<=0.6/30+1e-8);}last=p;}
 assert.ok(reversed,'blocking car must physically reverse');assert.ok(crossing.done,'crossing traffic must pass while the east exit remains red');assert.deepEqual(blocker.path,route);assert.ok(s.reversed>0);
 s.advance(35);assert.equal(s.arrived,3);assert.equal(s.locks.size,0);
});
test('manual reversing checks the whole retreat corridor and refuses an occupied rear',()=>{
 const {s,blocker}=blockedJunction();s.cars.push({id:4,path:[...blocker.path],i:1,p:0.3,born:0,waiting:true,admitted:false,lock:null,source:-1});
 assert.equal(s.requestReverse(true,blocker.id),null);assert.equal(blocker.p,0.26);assert.equal(s.locks.get('5,5'),blocker.id);
});
test('reversing reserves rear space, preserves gaps and releases its lock only after retreat',()=>{
 const {s,blocker}=blockedJunction(),rear={id:4,path:[...blocker.path],i:1,p:0.05,born:0,waiting:false,admitted:false,lock:null,source:-1};s.cars.push(rear);
 assert.equal(s.requestReverse(true,blocker.id),blocker);let done=false;
 for(let f=0;f<60;f++){s.advance(1/30);assert.ok(blocker.i+blocker.p-(rear.i+rear.p)>=0.44-1e-8);if(blocker.reversing)assert.equal(s.locks.get('5,5'),blocker.id);else{done=true;assert.ok(blocker.i+blocker.p<=1.56+1e-8);assert.notEqual(s.locks.get('5,5'),blocker.id);break;}}
 assert.ok(done);s.reset();assert.equal(s.reversed,0);
});
test('ordinary red-light waiting does not cause automatic backing; user can request it',()=>{
 const m=C.empty();C.draw(m,'1,1','6,1');m.signals=[{node:'3,1',cycle:20,offset:21}];m.exits=['6,1'];const s=new Simulation(m),c={id:1,path:C.line('1,1','6,1'),i:1,p:0.7,born:0,waiting:true,admitted:false,lock:null,source:-1};s.cars=[c];
 s.advance(5);assert.equal(s.reversed,0);assert.equal(c.p,0.7);assert.equal(s.requestReverse(true),c);s.advance(1);assert.ok(c.p<0.7);assert.equal(c.i,1);assert.equal(s.arrived,0);
});
test('an entrance cannot spawn into space reserved for a reversing vehicle',()=>{
 const m=C.empty();C.draw(m,'1,1','6,1');m.sources=[{node:'1,1',target:''}];m.exits=['6,1'];const s=new Simulation(m),c={id:1,path:C.line('1,1','6,1'),i:0,p:0.7,born:0,waiting:true,admitted:false,lock:null,source:0};s.cars=[c];s.nextId=2;
 assert.equal(s.requestReverse(true),c);s.advance(0.2);assert.equal(s.nextId,2);assert.ok(c.p<0.7);assert.ok(c.p>=0);
});
test('a short retreat cannot stop inside the junction behind it without owning that junction',()=>{
 const m=C.empty();C.draw(m,'2,5','8,5');C.draw(m,'5,3','5,7');m.exits=['8,5'];const s=new Simulation(m),c={id:1,path:C.line('4,5','8,5'),i:1,p:0.7,born:0,waiting:true,admitted:false,lock:null,source:-1};s.cars=[c];
 assert.equal(s.requestReverse(true),c);s.advance(1);assert.equal(c.i,1);assert.ok(c.p>=0.3-1e-8);assert.equal(c.reversing,null);
});

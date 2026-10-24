const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../src/core'),{Simulation}=require('../src/simulation');
function network(){const m=C.empty();C.draw(m,'1,4','12,4','forward');C.draw(m,'4,4','4,6','forward');C.draw(m,'4,6','8,6','forward');C.draw(m,'8,6','8,4','forward');m.sources=[{node:'1,4',target:''}];m.exits=['12,4'];return m;}
function driver(path,source=0){return {id:1,path:[...path],i:2,p:0.55,born:0,waiting:false,admitted:false,lock:null,source};}
function jam(){return [5,6,7].map((x,i)=>({id:10+i,path:C.line(x+',4','12,4'),i:0,p:0.7,born:0,waiting:true,admitted:false,lock:null,source:-1}));}
test('an automatic car replans the untravelled tail when congestion appears after departure',()=>{
 const m=network(),s=new Simulation(m,()=>0);s.advance(2.2);const car=s.cars[0],original=[...car.path];car.i=2;car.p=0.55;s.cars.push(...jam());s.loadsAt=-Infinity;
 s.step(1/30);assert.ok(car.path.includes('4,6'),'car must use bypass after new queue appears');assert.deepEqual(car.path.slice(0,4),original.slice(0,4));assert.equal(car.path.at(-1),'12,4');assert.equal(car.i,2);assert.ok(car.p>=0.55&&car.p<0.7);assert.equal(car.reroutes,1);
 s.advance(40);assert.equal(car.done,true);assert.ok(s.destinations['12,4']>0);
});
test('hand-drawn routes remain exact despite congestion and an available bypass',()=>{
 const m=network(),p=C.line('1,4','12,4');C.addRoute(m,p);const s=new Simulation(m),car=driver(p);s.cars=[car,...jam()];s.step(1/30);assert.deepEqual(car.path,p);assert.equal(car.reroutes||0,0);
});
test('remaining distance and predicted signal wait both influence automatic route time',()=>{
 const m=network(),s=new Simulation(m);assert.ok(!s.autoRoute(0,'12,4').includes('4,6'),'empty short route wins');
 m.signals=[{node:'6,4',cycle:20,offset:21}];assert.ok(s.autoRoute(0,'12,4').includes('4,6'),'long red makes the longer bypass faster');
 m.signals[0].offset=0;assert.ok(!s.autoRoute(0,'12,4').includes('4,6'),'green keeps the shorter route');
});
test('a car already admitted to a junction cannot change its reserved turn',()=>{
 const m=network(),s=new Simulation(m),car=driver(C.line('1,4','12,4'));car.admitted=true;car.lock='4,4';s.locks.set('4,4',car.id);s.cars=[car,...jam()];const original=[...car.path];s.step(1/30);assert.deepEqual(car.path,original);assert.equal(s.locks.get('4,4'),car.id);
});
test('rerouting never doubles back over the travelled prefix or changes destination',()=>{
 const m=network();C.draw(m,'2,4','2,7');C.draw(m,'2,7','9,7');C.draw(m,'9,7','9,4');const s=new Simulation(m),car=driver(C.line('1,4','12,4'));s.cars=[car,...jam()];s.step(1/30);assert.ok(car.path.includes('4,6'));assert.equal(new Set(car.path).size,car.path.length);assert.ok(C.canFollow(m,car.path));assert.equal(car.path.at(-1),'12,4');
});
test('weighted search preserves incoming direction at its starting bridge',()=>{
 const m=C.empty();C.draw(m,'1,4','9,4');C.draw(m,'4,1','4,9');C.setBridge(m,'4,4','ew');
 assert.equal(C.weightedRoute(m,'4,4','4,9',()=>1,C.adjacency(m),{previous:'3,4'}),null);
 assert.ok(C.weightedRoute(m,'4,4','9,4',()=>1,C.adjacency(m),{previous:'3,4'}));
});
test('tiny savings and cooldown do not cause repeated route switching',()=>{
 const m=network(),s=new Simulation(m),car=driver(C.line('1,4','12,4'));s.cars=[car,...jam()];s.step(1/30);assert.equal(car.reroutes,1);const chosen=[...car.path];
 s.cars=[car];car.p=0.55;s.step(1/30);assert.deepEqual(car.path,chosen);assert.equal(car.reroutes,1);
 const fresh=new Simulation(network()),v=driver(C.line('1,4','12,4'));fresh.cars=[v];fresh.step(1/30);assert.equal(v.reroutes||0,0);
});

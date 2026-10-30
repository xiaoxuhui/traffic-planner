const {test}=require('node:test'),assert=require('node:assert/strict');
const {PassengerService,CAPACITY}=require('../src/metro-passengers'),C=require('../src/core'),{Simulation}=require('../src/simulation');
const stations=['1,8','12,8','23,8'];
const service=()=>new PassengerService(stations,[{stops:stations.map(node=>({node}))}]);
function map(){const m=C.empty('metro');C.draw(m,stations[0],stations[2]);for(const n of stations)C.addStation(m,n);C.addRoute(m,C.line(stations[0],stations[2]));return m;}
test('every station generates passengers with random other destinations, including disconnected stations',()=>{
 const s=new PassengerService(stations,[]);for(const n of stations)assert.equal(s.queues.get(n).length,1);s.advance(120);for(const n of stations){const q=s.queues.get(n);assert.ok(q.length>10);assert.ok(q.every(p=>p.origin===n&&p.destination!==n));assert.equal(new Set(q.map(p=>p.destination)).size,2);}assert.equal(s.waiting,s.generated);
 assert.equal(new PassengerService(['1,1'],[]).generated,0);assert.equal(new PassengerService([],[]).waiting,0);
});
test('passengers board toward their destination, arrive only there, and preserve total count',()=>{
 const s=service(),c={station:stations[1],nextStop:2,stops:stations.map(node=>({node})),passengers:[]};s.queues.set(stations[1],[{id:99,destination:stations[0],born:0},{id:100,destination:stations[2],born:0}]);s.service(c,0,6);assert.deepEqual(c.passengers.map(p=>p.id),[100]);assert.equal(s.queues.get(stations[1])[0].id,99);c.station=stations[2];c.nextStop=3;s.service(c,10,6);assert.equal(s.delivered,1);assert.equal(c.passengers.length,0);
 const sim=new Simulation(map());sim.advance(180);assert.ok(sim.passengers.delivered>10);assert.equal(sim.passengers.generated,sim.passengers.waiting+sim.cars.reduce((n,t)=>n+t.passengers.length,0)+sim.passengers.delivered);assert.ok(sim.turnarounds>1);
});
test('capacity leaves excess passengers waiting, with no destination reassignment',()=>{
 const s=service(),c={station:stations[0],nextStop:1,stops:stations.map(node=>({node})),passengers:[]};s.queues.set(stations[0],Array.from({length:CAPACITY+4},(_,id)=>({id,destination:stations[2],born:0})));s.service(c,0,1);assert.equal(c.passengers.length,CAPACITY);assert.equal(s.queues.get(stations[0]).length,4);assert.ok(s.queues.get(stations[0]).every(p=>p.destination===stations[2]));
});
test('passengers transfer at shared platforms and never teleport between heights',()=>{
 const ns=['a','b','c','b@1'],s=new PassengerService(ns,[{stops:[{node:'a'},{node:'b'}]},{stops:[{node:'b'},{node:'c'}]}]);s.queues.set('a',[{id:1,destination:'c',born:0},{id:2,destination:'b@1',born:0}]);const c={station:'a',nextStop:1,stops:[{node:'a'},{node:'b'}],passengers:[]};s.service(c,0,6);assert.equal(c.passengers.length,1);assert.equal(c.passengers[0].alight,'b');c.station='b';c.nextStop=2;s.service(c,5,6);assert.ok(s.queues.get('b').some(p=>p.id===1&&p.destination==='c'));const second={station:'b',nextStop:1,stops:[{node:'b'},{node:'c'}],passengers:[]};s.service(second,5,6);assert.ok(second.passengers.some(p=>p.id===1));second.station='c';second.nextStop=2;s.service(second,10,6);assert.ok(s.delivered>=1);assert.ok(s.queues.get('a').some(p=>p.id===2));
});
test('passenger reset restarts state without changing the map, and zero time generates nobody new',()=>{
 const m=map(),saved=JSON.stringify(m),s=new Simulation(m);s.advance(0);assert.equal(s.passengers.generated,3);s.advance(60);assert.ok(s.passengers.generated>3);s.reset();assert.equal(s.passengers.generated,3);assert.equal(s.passengers.delivered,0);assert.equal(s.passengers.waiting,3);assert.equal(JSON.stringify(m),saved);
});

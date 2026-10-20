const C=require('../src/core'),{Simulation}=require('../src/simulation'),fs=require('node:fs');
const map=C.validate(JSON.parse(fs.readFileSync(process.argv[2],'utf8')));let seed=9;
const s=new Simulation(map,()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;});
console.log(JSON.stringify({sources:map.sources,roads:map.roads.length,exits:map.exits.length,demand:map.demand,bridges:map.bridges.length,routes:map.routes.length}));
for(let t=0;t<600;t+=30){s.advance(30);console.log(JSON.stringify({time:Math.round(s.time),arrived:s.arrived,spawned:s.nextId-1,cars:s.cars.length,waiting:s.waiting,locks:s.locks.size}));}
console.log('Stopped vehicles:',JSON.stringify(s.cars.filter(c=>c.waiting).slice(0,12).map(c=>({id:c.id,a:c.path[c.i],b:c.path[c.i+1],next:c.path[c.i+2],p:c.p,lock:c.lock,admitted:c.admitted}))));

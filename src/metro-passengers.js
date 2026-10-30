(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;else root.TrafficPassengers=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const RATE=12,CAPACITY=20;
 class PassengerService{
  constructor(stations,lines){
   this.stations=stations;this.queues=new Map(stations.map(n=>[n,[]]));this.generated=0;this.delivered=0;this.totalTime=0;this.nextId=1;this.seed=42731;this.nextArrival=new Map();this.distances=new Map();
   const graph=new Map(stations.map(n=>[n,new Set()]));
   for(const line of lines)for(let i=1;i<line.stops.length;i++){const a=line.stops[i-1].node,b=line.stops[i].node;graph.get(a).add(b);graph.get(b).add(a);}
   for(const goal of stations){const d=new Map([[goal,0]]),queue=[goal];for(let i=0;i<queue.length;i++)for(const n of graph.get(queue[i]))if(!d.has(n)){d.set(n,d.get(queue[i])+1);queue.push(n);}this.distances.set(goal,d);}
   for(const n of stations){this.spawn(n,0);this.nextArrival.set(n,this.interval());}
  }
  random(){this.seed^=this.seed<<13;this.seed^=this.seed>>>17;this.seed^=this.seed<<5;return ((this.seed>>>0)+0.5)/4294967296;}
  interval(){return -Math.log(this.random())*60/RATE;}
  spawn(origin,time){if(this.stations.length<2)return;let index=Math.floor(this.random()*(this.stations.length-1));if(index>=this.stations.indexOf(origin))index++;this.queues.get(origin).push({id:this.nextId++,origin,destination:this.stations[index],born:time});this.generated++;}
  advance(time){for(const n of this.stations){let next=this.nextArrival.get(n);while(next<=time){this.spawn(n,next);next+=this.interval();}this.nextArrival.set(n,next);}}
  get waiting(){let count=0;for(const q of this.queues.values())count+=q.length;return count;}
  service(c,time,coaches){
   if(!c.station)return;c.passengers??=[];
   c.passengers=c.passengers.filter(p=>{
    if(p.destination===c.station){this.delivered++;this.totalTime+=time-p.born;return false;}
    if(p.alight===c.station){delete p.alight;this.queues.get(c.station).push(p);return false;}return true;
   });
   const future=c.stops.slice(c.nextStop).map(s=>s.node),queue=this.queues.get(c.station),remaining=[];
   for(const p of queue){
    const d=this.distances.get(p.destination),here=d.get(c.station);let best=here,alight=null;
    for(const n of future)if(d.has(n)&&d.get(n)<best){best=d.get(n);alight=n;}
    if(alight&&c.passengers.length<coaches*CAPACITY){p.alight=alight;c.passengers.push(p);}else remaining.push(p);
   }
   this.queues.set(c.station,remaining);
  }
 }
 return {PassengerService,RATE,CAPACITY};
});

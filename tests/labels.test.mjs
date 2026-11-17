import test from 'node:test';
import assert from 'node:assert/strict';
import {placeLabels,segmentsCross,boxesOverlap,boxHitsCircle,segmentHitsBox} from '../src/label-layout.js';

function fixture(){
  const obstacles={earth:{x:320,y:300,r:130},segments:[],points:[]};
  for(let i=0;i<120;i++){
    const t=i*Math.PI/60,u=(i+1)*Math.PI/60;
    obstacles.segments.push([{x:320+245*Math.cos(t),y:320+220*Math.sin(t)},{x:320+245*Math.cos(u),y:320+220*Math.sin(u)}]);
  }
  const labels=[['Descending node',75,300],['Ascending node',565,300],['Spacecraft',420,120],['RAAN',480,250],['+I',570,350],['+J',180,180],['+K',320,120]]
    .map(([id,x,y])=>({id,anchor:{x,y},w:id.includes('node')?40:id.length*10+12,h:32,priority:id==='RAAN'?100:80}));
  return {labels,obstacles};
}
function valid(placements,obstacles,width,height){
  const list=[...placements.values()];
  for(const [i,a] of list.entries()){
    assert.ok(a.box.x>=0&&a.box.x+a.box.w<=width&&a.box.y>=0&&a.box.y+a.box.h<=height);
    assert.ok(!boxHitsCircle(a.box,obstacles.earth));
    assert.ok(!obstacles.segments.some(([p,q])=>segmentHitsBox(p,q,a.box)));
    for(const b of list.slice(i+1)){
      assert.ok(!boxesOverlap(a.box,b.box));
      assert.ok(!segmentsCross(a.start,a.anchor,b.start,b.anchor));
      assert.ok(!segmentHitsBox(a.start,a.anchor,b.box));
      assert.ok(!segmentHitsBox(b.start,b.anchor,a.box));
    }
  }
}
test('interleaved feature names produce nearby uncrossed leaders around a globe and orbit',()=>{
  const {labels,obstacles}=fixture(),placements=placeLabels(labels,obstacles,650,650);
  assert.equal(placements.size,labels.length);valid(placements,obstacles,650,650);
  assert.ok([...placements.values()].every(p=>p.length<120));
});
test('unchanged frames keep label positions stable and small feature motion stays local',()=>{
  const {labels,obstacles}=fixture();
  let placements=placeLabels(labels,obstacles,650,650),history=new Map();
  for(let frame=0;frame<12;frame++){
    history=new Map([...placements].map(([id,p])=>[id,{x:p.box.x,y:p.box.y,w:p.box.w,h:p.box.h,dx:p.box.x+p.box.w/2-p.anchor.x,dy:p.box.y+p.box.h/2-p.anchor.y}]));
    const next=placeLabels(labels,obstacles,650,650,history);
    valid(next,obstacles,650,650);
    for(const [id,p] of next){const old=placements.get(id);assert.ok(Math.hypot(p.box.x-old.box.x,p.box.y-old.box.y)<5);}
    placements=next;labels.find(l=>l.id==='Spacecraft').anchor.x+=.5;
  }
});
test('a crowded canvas never permits a label to obscure protected geometry',()=>{
  const obstacles={earth:{x:100,y:100,r:85},points:[],segments:[]};
  const labels=Array.from({length:12},(_,i)=>({id:String(i),anchor:{x:100,y:100},w:90,h:32,priority:i}));
  const placements=placeLabels(labels,obstacles,200,200);
  valid(placements,obstacles,200,200);
  assert.ok(placements.size<labels.length);
});

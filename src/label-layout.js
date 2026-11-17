// Screen-space callouts. Protect the actual drawing, then minimize leader
// crossings and distance. This module has no rendering or orbital dependencies.
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const orient=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
export function segmentsCross(a,b,c,d){
  // Shared endpoints are not crossings: two constructions may identify a node.
  return orient(a,b,c)*orient(a,b,d)<-1e-6&&orient(c,d,a)*orient(c,d,b)<-1e-6;
}
export function segmentHitsBox(a,b,box,pad=0){
  const left=box.x-pad,right=box.x+box.w+pad,top=box.y-pad,bottom=box.y+box.h+pad;
  let lo=0,hi=1;
  for(const [start,delta,min,max] of [[a.x,b.x-a.x,left,right],[a.y,b.y-a.y,top,bottom]]){
    if(Math.abs(delta)<1e-8){if(start<min||start>max)return false;}
    else{const t1=(min-start)/delta,t2=(max-start)/delta;lo=Math.max(lo,Math.min(t1,t2));hi=Math.min(hi,Math.max(t1,t2));if(lo>hi)return false;}
  }
  return true;
}
export function boxesOverlap(a,b,pad=0){
  return a.x<b.x+b.w+pad&&a.x+a.w+pad>b.x&&a.y<b.y+b.h+pad&&a.y+a.h+pad>b.y;
}
export function boxHitsCircle(box,circle,pad=0){
  return Math.hypot(clamp(circle.x,box.x,box.x+box.w)-circle.x,clamp(circle.y,box.y,box.y+box.h)-circle.y)<circle.r+pad;
}
function attachment(box,anchor){
  // Attach to the nearest straight edge, clear of the rounded corners.
  const edges=[{x:box.x,y:clamp(anchor.y,box.y+4,box.y+box.h-4)},
    {x:box.x+box.w,y:clamp(anchor.y,box.y+4,box.y+box.h-4)},
    {x:clamp(anchor.x,box.x+4,box.x+box.w-4),y:box.y},
    {x:clamp(anchor.x,box.x+4,box.x+box.w-4),y:box.y+box.h}];
  return edges.reduce((best,p)=>distance(p,anchor)<distance(best,anchor)?p:best);
}
function clearBox(box,obstacles,width,height){
  return box.x>=6&&box.y>=6&&box.x+box.w<=width-6&&box.y+box.h<=height-6&&
    !boxHitsCircle(box,obstacles.earth,5)&&!obstacles.points.some(p=>boxHitsCircle(box,p,4))&&
    !obstacles.segments.some(([a,b])=>segmentHitsBox(a,b,box,5));
}
function candidates(label,obstacles,width,height,previous){
  const {anchor,w,h}=label,result=[],seen=new Set();
  const add=(cx,cy)=>{
    if(w>width-12||h>height-12)return;
    const box={x:clamp(cx-w/2,6,width-w-6),y:clamp(cy-h/2,6,height-h-6),w,h};
    const key=Math.round(box.x)+':'+Math.round(box.y);if(seen.has(key))return;seen.add(key);
    if(!clearBox(box,obstacles,width,height))return;
    const start=attachment(box,anchor),length=distance(start,anchor);
    let cost=length;
    // Prefer leaders in open space, rather than cutting across the diagram.
    for(const [a,b] of obstacles.segments)if(segmentsCross(start,anchor,a,b))cost+=12;
    if(previous){
      const dx=box.x-previous.x,dy=box.y-previous.y;
      cost+=Math.min(40,Math.hypot(dx,dy))*.7;
    }
    result.push({box,start,anchor,cost,length});
  };
  if(previous){add(previous.x+w/2,previous.y+h/2);add(anchor.x+previous.dx,anchor.y+previous.dy);}
  // Near positions first; more distant positions remain available for dense
  // geometry. Clamping also supplies candidates along all four canvas edges.
  for(const gap of [16,30,50,80,120,180,260])for(let i=0;i<24;i++){
    const angle=i*Math.PI/12,dx=Math.cos(angle),dy=Math.sin(angle),radius=Math.abs(dx)*w/2+Math.abs(dy)*h/2+gap;
    add(anchor.x+dx*radius,anchor.y+dy*radius);
  }
  return result.sort((a,b)=>a.cost-b.cost);
}
function pairCost(a,b){
  if(boxesOverlap(a.box,b.box,6)||segmentHitsBox(a.start,a.anchor,b.box,3)||segmentHitsBox(b.start,b.anchor,a.box,3))return Infinity;
  return segmentsCross(a.start,a.anchor,b.start,b.anchor)?10000:0;
}
export function placeLabels(labels,obstacles,width,height,history=new Map()){
  // Most playback frames only move the attachment points slightly. Retain
  // local offsets when the complete layout still clears all current geometry
  // and all other leaders. Re-solve only when a constraint actually changes.
  const following=new Map();
  for(const label of labels){
    const old=history.get(label.id);if(!old||old.w!==label.w||old.h!==label.h)break;
    const box={x:label.anchor.x+old.dx-label.w/2,y:label.anchor.y+old.dy-label.h/2,w:label.w,h:label.h};
    if(!clearBox(box,obstacles,width,height))break;
    const candidate={box,anchor:label.anchor,start:attachment(box,label.anchor)};
    candidate.length=distance(candidate.start,candidate.anchor);candidate.cost=candidate.length;
    if([...following.values()].some(other=>pairCost(candidate,other)>0))break;
    following.set(label.id,candidate);
  }
  if(following.size===labels.length)return following;
  const items=labels.map(label=>({...label,candidates:candidates(label,obstacles,width,height,history.get(label.id))}));
  items.sort((a,b)=>b.priority-a.priority||a.id.localeCompare(b.id));
  const placed=new Map();
  const choose=item=>{
    let best=null,bestCost=Infinity;
    for(const candidate of item.candidates){
      let cost=candidate.cost;
      for(const [id,other] of placed){if(id!==item.id)cost+=pairCost(candidate,other);if(cost>=bestCost)break;}
      if(cost<bestCost){best=candidate;bestCost=cost;}
    }
    return best;
  };
  for(const item of items){const best=choose(item);if(best)placed.set(item.id,best);}
  // Revisit earlier choices with the complete arrangement in view; greedy
  // placement alone can strand a later label on the far side of a leader.
  for(let pass=0;pass<3;pass++)for(const item of [...items].reverse()){
    const best=choose(item);if(best)placed.set(item.id,best);
  }
  return placed;
}

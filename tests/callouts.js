() => {
  const area=document.querySelector('.orbit-canvas').getBoundingClientRect();
  const labels=[...document.querySelectorAll('#scene-labels .scene-label')].filter(el=>getComputedStyle(el).display!=='none');
  const boxes=labels.map(el=>{const b=el.getBoundingClientRect();return {left:b.left-area.left,right:b.right-area.left,top:b.top-area.top,bottom:b.bottom-area.top};});
  const paths=[...document.querySelectorAll('.label-leaders path')];
  const lines=paths.map(path=>{const n=path.getAttribute('d').match(/-?\d+(?:\.\d+)?/g).map(Number);return {start:{x:n[0],y:n[1]},end:{x:n.at(-2),y:n.at(-1)},path};});
  const orientation=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
  const cross=(a,b,c,d)=>orientation(a,b,c)*orientation(a,b,d)<-1e-4&&orientation(c,d,a)*orientation(c,d,b)<-1e-4;
  const contains=(r,p)=>p.x>r.left&&p.x<r.right&&p.y>r.top&&p.y<r.bottom;
  const hits=(r,a,b)=>contains(r,a)||contains(r,b)||[[{x:r.left,y:r.top},{x:r.right,y:r.top}],[{x:r.right,y:r.top},{x:r.right,y:r.bottom}],[{x:r.right,y:r.bottom},{x:r.left,y:r.bottom}],[{x:r.left,y:r.bottom},{x:r.left,y:r.top}]].some(([c,d])=>cross(a,b,c,d));
  const drawing=window.orbitExplorer.snapshot().camera.annotationGeometry;
  let clear=true,connected=true,inside=true;
  labels.forEach((label,i)=>{
    const b=boxes[i],feature=label.dataset.feature;
    inside&&=b.left>=-1&&b.right<=area.width+1&&b.top>=-1&&b.bottom<=area.height+1;
    const earth=drawing.earth;
    const x=Math.max(b.left,Math.min(b.right,earth.x)),y=Math.max(b.top,Math.min(b.bottom,earth.y));
    clear&&=Math.hypot(x-earth.x,y-earth.y)>=earth.r;
    clear&&=!drawing.segments.some(([a,c])=>hits(b,a,c));
    const line=lines.find(l=>l.path.dataset.feature===feature);
    const dot=[...document.querySelectorAll('.label-leaders circle')].find(p=>p.dataset.feature===feature);
    if(!line||!dot){connected=false;return;}
    const {start,end}=line;
    const onVertical=(Math.abs(start.x-b.left)<1.5||Math.abs(start.x-b.right)<1.5)&&start.y>=b.top-1&&start.y<=b.bottom+1;
    const onHorizontal=(Math.abs(start.y-b.top)<1.5||Math.abs(start.y-b.bottom)<1.5)&&start.x>=b.left-1&&start.x<=b.right+1;
    connected&&=(onVertical||onHorizontal)&&Math.abs(end.x-Number(dot.getAttribute('cx')))<.02&&Math.abs(end.y-Number(dot.getAttribute('cy')))<.02;
    connected&&=parseFloat(getComputedStyle(line.path).strokeWidth)<=1.5;
  });
  const overlaps=boxes.some((a,i)=>boxes.slice(i+1).some(b=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top));
  const crossings=lines.reduce((n,a,i)=>n+lines.slice(i+1).filter(b=>cross(a.start,a.end,b.start,b.end)).length,0);
  const throughLabels=lines.some(line=>boxes.some((box,i)=>labels[i].dataset.feature!==line.path.dataset.feature&&hits(box,line.start,line.end)));
  const lengths=lines.map(l=>Math.hypot(l.start.x-l.end.x,l.start.y-l.end.y));
  return {count:labels.length,clear,connected,inside,overlaps,throughLabels,crossings,paths:paths.length,maxLength:Math.max(0,...lengths),meanLength:lengths.reduce((a,b)=>a+b,0)/Math.max(1,lengths.length)};
}

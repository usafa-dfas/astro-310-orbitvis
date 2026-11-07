// Spherical Earth, Keplerian motion, and a single sidereal rotation convention.
// Distances in km, times in s, public angles in degrees. ECI axes: I, J, K.
export const MU = 398600.5;
export const EARTH_RADIUS = 6378.137;
export const SIDEREAL_DAY = 86164.0905;
export const EARTH_RATE = 2 * Math.PI / SIDEREAL_DAY;
export const GEO_A = Math.cbrt(MU / EARTH_RATE ** 2);
export const TAU = 2 * Math.PI;
export const DEG = Math.PI / 180;
export const mod = (x, n = 360) => ((x % n) + n) % n;
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const norm = v => Math.hypot(...v);
export const dot = (a,b) => a.reduce((s,x,i)=>s+x*b[i],0);
export const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const unit = v => v.map(x=>x/norm(v));
export const period = a => TAU * Math.sqrt(a ** 3 / MU);
export const meanMotion = a => Math.sqrt(MU / a ** 3);
export const isCircular = o => o.e < 1e-9;
export const isEquatorial = o => Math.abs(Math.sin(o.i * DEG)) < 1e-9;
export const direction = o => o.i > 90 ? -1 : 1;
export const maxLatitude = i => Math.min(i, 180 - i);

export function validateOrbit(o) {
  if (!['a','e','i','raan','arg','nu'].every(k=>Number.isFinite(o[k]))) return 'Enter a finite number in every element.';
  if (o.a < 6600 || o.a > 50000) return 'Semi-major axis must be between 6,600 and 50,000 km.';
  if (o.e < 0 || o.e > .85) return 'Eccentricity must be between 0 and 0.85.';
  if (o.i < 0 || o.i > 180) return 'Inclination must be between 0° and 180°.';
  if (o.a * (1 - o.e) <= EARTH_RADIUS) return `This orbit enters Earth. For this size, e must be less than ${(1-EARTH_RADIUS/o.a).toFixed(3)}.`;
  return null;
}

export function meanFromTrue(nu, e) {
  const v = nu * DEG;
  const E = Math.atan2(Math.sqrt(1-e*e)*Math.sin(v),e+Math.cos(v));
  return mod(E-e*Math.sin(E),TAU);
}

export function solveKepler(M, e) {
  M = mod(M,TAU);
  let E = e < .8 ? M : Math.PI;
  for (let j=0;j<16;j++) {
    const d=(E-e*Math.sin(E)-M)/(1-e*Math.cos(E));
    E -= d;
    if (Math.abs(d)<1e-13) return E;
  }
  // Monotone equation for all bound ellipses. Preserve convergence at high e.
  let lo=0,hi=TAU;
  for(let j=0;j<60;j++) {
    E=(lo+hi)/2;
    if(E-e*Math.sin(E)>M) hi=E; else lo=E;
  }
  return (lo+hi)/2;
}

export function rotateOrbital(v,o) {
  const O=o.raan*DEG,w=o.arg*DEG,i=o.i*DEG;
  const cO=Math.cos(O),sO=Math.sin(O),cw=Math.cos(w),sw=Math.sin(w),ci=Math.cos(i),si=Math.sin(i);
  return [
    (cO*cw-sO*sw*ci)*v[0]+(-cO*sw-sO*cw*ci)*v[1]+sO*si*v[2],
    (sO*cw+cO*sw*ci)*v[0]+(-sO*sw+cO*cw*ci)*v[1]-cO*si*v[2],
    sw*si*v[0]+cw*si*v[1]+ci*v[2]
  ];
}

export function stateAtTrue(o,nu) {
  const v=nu*DEG,p=o.a*(1-o.e*o.e),r=p/(1+o.e*Math.cos(v));
  return {nu:mod(nu),r,position:rotateOrbital([r*Math.cos(v),r*Math.sin(v),0],o),
    velocity:rotateOrbital([-Math.sin(v)*Math.sqrt(MU/p),(o.e+Math.cos(v))*Math.sqrt(MU/p),0],o)};
}

export function stateAt(o,t=0) {
  const M=meanFromTrue(o.nu,o.e)+meanMotion(o.a)*t;
  const E=solveKepler(M,o.e);
  const v=Math.atan2(Math.sqrt(1-o.e*o.e)*Math.sin(E),Math.cos(E)-o.e)/DEG;
  return stateAtTrue(o,v);
}

export function groundPoint(position,earthAngle) {
  const [x,y,z]=position,r=norm(position),horizontal=Math.hypot(x,y);
  return {lat:Math.atan2(z,horizontal)/DEG,
    lon:horizontal/r<1e-10 ? null : mod(Math.atan2(y,x)/DEG-earthAngle/DEG+180)-180};
}

export function anglesAt(o,nu=o.nu) {
  const s=direction(o);
  return {u:mod(o.arg+nu),pi:mod(o.raan+s*o.arg),l:mod(o.raan+s*(o.arg+nu))};
}

// Re-anchor at the current instant: shape edits retain the current location angle.
// At singularities, choose a canonical representative of the same physical geometry.
export function canonicalize(o) {
  const n={...o},s=direction(n);
  if(isEquatorial(n)) {
    n.arg=mod(n.arg+s*n.raan); n.raan=0;
  }
  if(isCircular(n)) {n.nu=mod(n.arg+n.nu); n.arg=0;}
  n.nu=mod(n.nu);n.arg=mod(n.arg);n.raan=mod(n.raan);
  return n;
}

export function nodeStates(o) {
  if(isEquatorial(o)) return [];
  return [stateAtTrue(o,-o.arg),stateAtTrue(o,180-o.arg)];
}

export function sampleGroundTrack(o,earthAngle,rotation=true,orbits=3) {
  const P=period(o.a),rate=rotation?EARTH_RATE:0;
  const start=-P*Math.min(1,orbits/3),end=P*(orbits-Math.min(1,orbits/3));
  const evaluate=t=>{
    const s=stateAt(o,t);
    return {...groundPoint(s.position,earthAngle+rate*t),t,nu:s.nu};
  };
  // Adaptive refinement in time resolves high-e perigee motion and polar passes.
  const points=[];
  function refine(a,b,depth=0) {
    const mid=evaluate((a.t+b.t)/2);
    const angular=(a.lon===null||b.lon===null)?180:Math.abs(mod(b.lon-a.lon+180)-180);
    const bend=(a.lon===null||b.lon===null||mid.lon===null)?180:
      Math.abs(mod(mid.lon-a.lon+180)-180-(mod(b.lon-a.lon+180)-180)/2);
    if(depth<9&&(angular>4||Math.abs(b.lat-a.lat)>3||bend>.7||Math.abs(mid.lat-(a.lat+b.lat)/2)>.4)) {
      refine(a,mid,depth+1);refine(mid,b,depth+1);
    } else points.push(b);
  }
  const count=orbits*180;
  let a=evaluate(start);points.push(a);
  for(let j=1;j<=count;j++){const b=evaluate(start+(end-start)*j/count);refine(a,b);a=b;}
  return points;
}

// Break on the map seam, interpolate its two edges, and never connect over a pole.
export function trackSegments(points) {
  const segments=[];let current=[];
  const flush=()=>{if(current.length>1)segments.push(current);current=[];};
  for(const p of points) {
    if(p.lon===null||Math.abs(p.lat)>89.98){flush();continue;}
    const prev=current.at(-1);
    if(prev&&Math.abs(p.lon-prev.lon)>180) {
      const end=p.lon>prev.lon?-180:180;
      const adjusted=p.lon+(p.lon>prev.lon?-360:360);
      const f=(end-prev.lon)/(adjusted-prev.lon);
      const boundary={...p,lon:end,lat:prev.lat+f*(p.lat-prev.lat)};
      current.push(boundary);flush();current.push({...boundary,lon:-end});
    }
    current.push(p);
  }
  flush();return segments;
}

export const PRESETS = {
  teaching:{name:'Teaching ellipse',a:12000,e:.25,i:45,raan:30,arg:45,nu:30,prompt:'Which element moves perigee without changing the orbital plane?'},
  leo:{name:'Circular inclined LEO',a:EARTH_RADIUS+500,e:0,i:45,raan:30,arg:0,nu:25,prompt:'Earth turns east. Why does the next ascending crossing shift west?'},
  polar:{name:'Polar orbit',a:EARTH_RADIUS+1000,e:0,i:90,raan:20,arg:0,nu:15,prompt:'What makes both poles accessible from this orbit?'},
  retro:{name:'Retrograde orbit',a:10000,e:.15,i:120,raan:30,arg:45,nu:30,prompt:'Compare i = 60° and 120°. Same latitude limits; what changes?'},
  geo:{name:'Geostationary',a:GEO_A,e:0,i:0,raan:0,arg:0,nu:0,prompt:'A circular, equatorial, prograde orbit with a sidereal-day period stays over one point.'},
  sync:{name:'Inclined geosynchronous',a:GEO_A,e:0,i:30,raan:0,arg:0,nu:0,prompt:'The period matches Earth’s rotation. Why does the ground point still move?'},
  lesson11a:{name:'Lesson 11 · circular example',a:9762.78,e:0,i:40,raan:0,arg:0,nu:180,prompt:'T ≈ 160 min. Sidereal Earth rotation gives 40.11° per orbit (rounded to 40° in class).'},
  lesson11b:{name:'Lesson 11 · elliptical example',a:23564.65,e:.3,i:30,raan:0,arg:90,nu:90,prompt:'At the descending node. T ≈ 10 h; sidereal Earth rotation gives 150.41° (class: 150°).'},
  lesson10:{name:'Lesson 10 · inspection example',a:10071.29,e:1-9000/10071.29,i:90,raan:180,arg:180,nu:0,prompt:'At perigee on +I: R = 9,000 km and V points along −K. Read the angles by inspection.'}
};

import test from 'node:test';
import assert from 'node:assert/strict';
import {MU,EARTH_RADIUS,GEO_A,EARTH_RATE,SIDEREAL_DAY,DEG,TAU,period,meanFromTrue,solveKepler,stateAt,stateAtTrue,rotateOrbital,groundPoint,anglesAt,canonicalize,norm,dot,cross,isCircular,isEquatorial,validateOrbit,maxLatitude,sampleGroundTrack,trackSegments,PRESETS} from '../src/physics.js';
const near=(a,b,tol=1e-7)=>assert.ok(Math.abs(a-b)<tol,`${a} ≠ ${b} (tolerance ${tol})`);
const vectorNear=(a,b,tol=1e-7)=>a.forEach((v,j)=>near(v,b[j],tol));
const ellipse={...PRESETS.teaching};

test('perigee, apogee, and half-period symmetry',()=>{
  near(stateAtTrue(ellipse,0).r,9000);near(stateAtTrue(ellipse,180).r,15000);
  const start={...ellipse,nu:0};near(stateAt(start,period(start.a)/2).r,15000);
  near(stateAt(start,period(start.a)).r,9000);
});
test('circular equatorial orbit has known quarter-period position and velocity',()=>{
  const o={a:7000,e:0,i:0,raan:0,arg:0,nu:0},s=stateAt(o,period(7000)/4);
  vectorNear(s.position,[0,7000,0]);vectorNear(s.velocity,[-Math.sqrt(MU/7000),0,0]);
});
test('energy, angular momentum, and plane remain invariant through ellipse',()=>{
  let h0;
  for(let j=0;j<=90;j++){
    const s=stateAt(ellipse,period(ellipse.a)*j/73),h=cross(s.position,s.velocity);
    near(dot(s.velocity,s.velocity)/2-MU/s.r,-MU/(2*ellipse.a),1e-9);
    near(norm(h),Math.sqrt(MU*ellipse.a*(1-ellipse.e**2)),1e-7);
    if(h0)vectorNear(h,h0,1e-7);else h0=h;
  }
});
test('one orbit returns position and velocity, also for negative time',()=>{
  const s=stateAt(ellipse,0),P=period(ellipse.a);
  vectorNear(stateAt(ellipse,P).position,s.position);vectorNear(stateAt(ellipse,-P).position,s.position);
  vectorNear(stateAt(ellipse,P).velocity,s.velocity);
});
test('Kepler solution converges over supported eccentricities and wrap boundaries',()=>{
  for(const e of [0,.1,.7,.8,.85])for(const M of [0,1e-10,.01,.1,1,Math.PI,6,TAU-1e-10]){
    const E=solveKepler(M,e);near(E-e*Math.sin(E),M,1e-11);
  }
});
test('elliptical motion is faster at perigee and has unequal true-anomaly steps',()=>{
  assert.ok(norm(stateAtTrue(ellipse,0).velocity)>norm(stateAtTrue(ellipse,180).velocity));
  const o={...ellipse,nu:0},P=period(o.a);
  assert.ok(stateAt(o,P/4).nu>90);near(stateAt(o,P/2).nu,180);
});
test('sidereal geostationary orbit remains fixed for an entire day',()=>{
  near(period(GEO_A),SIDEREAL_DAY,1e-7);
  for(let t=0;t<=SIDEREAL_DAY;t+=1100){const g=groundPoint(stateAt(PRESETS.geo,t).position,EARTH_RATE*t);near(g.lat,0);near(g.lon,0);}
});
test('inclined synchronous orbit moves in latitude and repeats after sidereal day',()=>{
  const o=PRESETS.sync,P=period(o.a);
  near(groundPoint(stateAt(o,P/4).position,EARTH_RATE*P/4).lat,30);
  const a=groundPoint(stateAt(o,0).position,0),b=groundPoint(stateAt(o,P).position,EARTH_RATE*P);
  near(a.lat,b.lat);near(a.lon,b.lon);
});
test('ground point subtracts Earth angle and handles polar longitude as undefined',()=>{
  const g=groundPoint([7000,0,0],30*DEG);near(g.lat,0);near(g.lon,-30);
  assert.equal(groundPoint([0,0,7000],0).lon,null);
  assert.equal(groundPoint([0,0,-7000],0).lon,null);
});
test('inclination limits include retrograde orbits',()=>{
  for(const i of [0,30,60,90,120,150,180]){
    near(maxLatitude(i),Math.min(i,180-i));
    const s=stateAtTrue({...ellipse,i,arg:0},90),g=groundPoint(s.position,0);
    near(Math.abs(g.lat),maxLatitude(i),1e-8);
  }
});
test('nodes are equatorial and ascending motion has positive K velocity',()=>{
  const o={...ellipse,arg:135,raan:230,i:120};
  const ascending=stateAtTrue(o,-o.arg),descending=stateAtTrue(o,180-o.arg);
  near(ascending.position[2],0);near(descending.position[2],0);
  assert.ok(ascending.velocity[2]>0);assert.ok(descending.velocity[2]<0);
});
test('canonical circular and equatorial representations preserve physical state',()=>{
  for(const i of [0,45,120,180])for(const e of [0,.2]){
    const o={a:12000,e,i,raan:135,arg:85,nu:250},c=canonicalize(o);
    vectorNear(stateAt(o,0).position,stateAt(c,0).position);
    vectorNear(stateAt(o,0).velocity,stateAt(c,0).velocity);
    if(isCircular(o))near(c.arg,0);
    if(isEquatorial(o))near(c.raan,0);
  }
});
test('retrograde-equatorial replacement longitudes have correct direction',()=>{
  const o={...ellipse,i:180,raan:50,arg:20,nu:10},a=anglesAt(o);
  near(a.pi,30);near(a.l,20);
  const s=stateAtTrue(o,10);near(groundPoint(s.position,0).lon,20);
});
test('RAAN changes geographic phase, not latitude or size',()=>{
  const a=stateAtTrue({...ellipse,raan:0},80),b=stateAtTrue({...ellipse,raan:40},80);
  near(a.r,b.r);near(groundPoint(a.position,0).lat,groundPoint(b.position,0).lat);
  near(groundPoint(b.position,0).lon-groundPoint(a.position,0).lon,40);
});
test('Earth rotation creates the expected successive-node westward displacement',()=>{
  const o={...PRESETS.lesson11a,nu:0},P=period(o.a);
  const a=groundPoint(stateAt(o,0).position,0),b=groundPoint(stateAt(o,P).position,EARTH_RATE*P);
  near(a.lon-b.lon,EARTH_RATE*P/DEG);
  near(groundPoint(stateAt(o,P).position,0).lon,a.lon);
});
test('lesson 11 circular fixture uses a 160-minute orbit and sidereal spacing',()=>{
  const o=PRESETS.lesson11a;near(period(o.a),9600,.02);near(EARTH_RATE*period(o.a)/DEG,40.1095,.001);
  near(groundPoint(stateAt(o,0).position,0).lat,0);
  assert.ok(stateAt(o,0).velocity[2]<0);
});
test('lesson 11 ellipse fixture starts on descending node with ten-hour period',()=>{
  const o=PRESETS.lesson11b;near(period(o.a),36000,.02);near(EARTH_RATE*period(o.a)/DEG,150.4107,.001);
  near(stateAt(o,0).position[2],0);assert.ok(stateAt(o,0).velocity[2]<0);
});
test('lesson 10 inspection fixture has R on +I and V along −K at perigee',()=>{
  const s=stateAt(PRESETS.lesson10,0);
  vectorNear(s.position,[9000,0,0],.01);vectorNear(s.velocity,[0,0,-7],.00001);
});
test('orbit validation rejects Earth intersections, NaNs and unbound cases',()=>{
  assert.equal(validateOrbit(ellipse),null);
  assert.ok(validateOrbit({...ellipse,a:7000,e:.2}));
  assert.ok(validateOrbit({...ellipse,a:NaN}));assert.ok(validateOrbit({...ellipse,e:1}));
  assert.ok(validateOrbit({...ellipse,i:181}));
  for(const p of Object.values(PRESETS))assert.equal(validateOrbit(p),null);
});
test('adaptive ground tracks remain finite near perigee and pole crossings',()=>{
  for(const o of [PRESETS.polar,PRESETS.geo,{...ellipse,a:50000,e:.85}]){
    const points=sampleGroundTrack(o,0,true,3);assert.ok(points.length>100);
    for(const p of points){assert.ok(Number.isFinite(p.lat));assert.ok(p.lon===null||Number.isFinite(p.lon));}
    for(const seg of trackSegments(points))for(let j=1;j<seg.length;j++)assert.ok(Math.abs(seg[j].lon-seg[j-1].lon)<=180);
  }
});
test('antimeridian crossing is split and interpolated to the two map edges',()=>{
  const segs=trackSegments([{lat:0,lon:170},{lat:5,lon:-170},{lat:10,lon:-160}]);
  assert.equal(segs.length,2);near(segs[0].at(-1).lon,180);near(segs[1][0].lon,-180);near(segs[0].at(-1).lat,2.5);
});
test('ground track does not draw through undefined polar longitudes',()=>{
  const segs=trackSegments([{lat:80,lon:10},{lat:89,lon:10},{lat:90,lon:null},{lat:89,lon:-170},{lat:80,lon:-170}]);
  assert.equal(segs.length,2);
});

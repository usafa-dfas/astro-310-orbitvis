import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {Line2} from 'three/addons/lines/Line2.js';
import {LineGeometry} from 'three/addons/lines/LineGeometry.js';
import {LineMaterial} from 'three/addons/lines/LineMaterial.js';
import earthImage from './assets/earth.jpg';
import {EARTH_RADIUS,DEG,TAU,stateAtTrue,rotateOrbital,isCircular,isEquatorial,nodeStates,anglesAt,cross,unit,norm} from './physics.js';

const xyz = a => new THREE.Vector3(a[0],a[2],-a[1]);
const eci = a => xyz(a).divideScalar(EARTH_RADIUS);
const color={orbit:0x73e1dc,selected:0xd4b3ff,orange:0xffbd75,reference:0x637f9a,axis:0x9eb5cb,node:0xd1dbef};

export class OrbitScene {
  constructor(container) {
    this.container=container;this.labelsEl=document.querySelector('#scene-labels');this.labels=[];
    this.calloutSides=new Map();this.orbitBounds=[];this.geometryBounds=[];this.angleBounds=[];
    this.labelLeaders=document.createElementNS('http://www.w3.org/2000/svg','svg');
    this.labelLeaders.classList.add('label-leaders');this.labelLeaders.setAttribute('aria-hidden','true');this.labelsEl.append(this.labelLeaders);
    this.width=1;this.height=1;this.theme='night';this.view='oblique';this.o=null;this.dirty=true;
    try{this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});}
    catch(e){document.querySelector('#webgl-error').hidden=false;this.error=e;return;}
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.setClearColor(0x000000,0);
    this.renderer.domElement.setAttribute('aria-hidden','true');
    container.prepend(this.renderer.domElement);
    this.scene=new THREE.Scene();
    this.camera=new THREE.PerspectiveCamera(39,1,.03,2000);this.camera.up.set(0,1,0);
    this.controls=new OrbitControls(this.camera,this.renderer.domElement);
    this.controls.enableDamping=true;this.controls.dampingFactor=.12;this.controls.enablePan=false;
    this.controls.minDistance=1.65;this.controls.maxDistance=250;
    this.controls.addEventListener('start',()=>this.container.dispatchEvent(new Event('camera-interaction')));
    this.controls.addEventListener('change',()=>this.dirty=true);
    this.scene.add(new THREE.AmbientLight(0xbdd8f3,1.05));
    const sun=new THREE.DirectionalLight(0xffffff,2.2);sun.position.set(3,4,5);this.scene.add(sun);
    const fill=new THREE.DirectionalLight(0x66aadd,.65);fill.position.set(-5,0,-2);this.scene.add(fill);
    const texture=new THREE.TextureLoader().load(earthImage,()=>this.dirty=true);texture.colorSpace=THREE.SRGBColorSpace;
    texture.anisotropy=Math.min(8,this.renderer.capabilities.getMaxAnisotropy());
    this.earth=new THREE.Mesh(new THREE.SphereGeometry(1,96,64),new THREE.MeshPhongMaterial({map:texture,shininess:5,specular:0x203845}));
    this.scene.add(this.earth);
    const atmosphere=new THREE.Mesh(new THREE.SphereGeometry(1.025,64,48),new THREE.ShaderMaterial({
      vertexShader:'varying vec3 vN; varying vec3 vP; void main(){vN=normalize(normalMatrix*normal);vec4 p=modelViewMatrix*vec4(position,1.0);vP=p.xyz;gl_Position=projectionMatrix*p;}',
      fragmentShader:'varying vec3 vN; varying vec3 vP; void main(){float rim=pow(1.0-max(0.0,dot(normalize(vN),normalize(-vP))),3.5);gl_FragColor=vec4(0.18,0.56,0.95,rim*0.48);}',
      transparent:true,depthWrite:false,side:THREE.FrontSide}));
    this.scene.add(atmosphere);
    const starPositions=[];let seed=310;
    const random=()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646;};
    for(let j=0;j<550;j++){const z=random()*2-1,a=random()*TAU,r=65;starPositions.push(r*Math.sqrt(1-z*z)*Math.cos(a),r*z,r*Math.sqrt(1-z*z)*Math.sin(a));}
    const starGeom=new THREE.BufferGeometry();starGeom.setAttribute('position',new THREE.Float32BufferAttribute(starPositions,3));
    this.stars=new THREE.Points(starGeom,new THREE.PointsMaterial({color:0xa4bfd4,size:.065,transparent:true,opacity:.36,sizeAttenuation:true,depthWrite:false}));this.scene.add(this.stars);
    this.orbitGroup=new THREE.Group();this.referenceGroup=new THREE.Group();this.angleGroup=new THREE.Group();
    this.scene.add(this.orbitGroup,this.referenceGroup,this.angleGroup);
    // A crisp orange ring matches the map marker; its scale is set in pixels.
    const pinCanvas=document.createElement('canvas');pinCanvas.width=pinCanvas.height=64;
    const pin=pinCanvas.getContext('2d');
    pin.fillStyle='#ffffff';pin.beginPath();pin.arc(32,32,27,0,TAU);pin.fill();
    pin.strokeStyle='#ae4900';pin.lineWidth=8;pin.stroke();
    pin.fillStyle='#ae4900';pin.beginPath();pin.arc(32,32,12,0,TAU);pin.fill();
    this.pinCanvas=pinCanvas;
    this.satPin=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(pinCanvas),depthWrite:false,depthTest:false}));this.scene.add(this.satPin);
    this.spacecraftLabel=document.createElement('span');this.spacecraftLabel.className='scene-label highlight';this.spacecraftLabel.textContent='Spacecraft';this.labelsEl.append(this.spacecraftLabel);
    this.subpoint=new THREE.Mesh(new THREE.SphereGeometry(.022,16,16),new THREE.MeshBasicMaterial({color:color.orange}));this.scene.add(this.subpoint);
    this.projection=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3(0,1,0)]),new THREE.LineDashedMaterial({color:color.orange,dashSize:.07,gapSize:.06,transparent:true,opacity:.45}));this.scene.add(this.projection);
    this.velocityArrow=this.arrow(color.selected);this.scene.add(this.velocityArrow);
    this.positionArrow=this.arrow(color.selected);this.scene.add(this.positionArrow);
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(container);
    this.resize();
  }
  resize(){
    if(this.error)return;
    this.dirty=true;

    this.width=Math.max(1,this.container.clientWidth);this.height=Math.max(1,this.container.clientHeight);
    this.camera.aspect=this.width/this.height;

    this.camera.updateProjectionMatrix();this.renderer.setSize(this.width,this.height);
    if(this.o)this.fitView();
    this.scene.traverse(o=>{if(o.material?.isLineMaterial)o.material.resolution.set(this.width,this.height);});
  }
  unitsPerPixel(position){
    const depth=-position.clone().applyMatrix4(this.camera.matrixWorldInverse).z;
    return 2*Math.max(.01,depth)*Math.tan(this.camera.fov*DEG/2)/this.height;
  }
  arrow(tint){
    const arrow=new THREE.ArrowHelper(new THREE.Vector3(0,1,0),new THREE.Vector3(),1,tint);
    arrow.line.visible=false;
    arrow.shaft=this.line([new THREE.Vector3(),new THREE.Vector3(0,1,0)],arrow,{color:tint,width:3.5});
    return arrow;
  }
  sizeArrow(arrow,length){
    const pixel=this.unitsPerPixel(arrow.position),head=Math.min(length*.25,11*pixel);
    arrow.setLength(length,head,8*pixel);arrow.shaft.scale.y=Math.max(.001,length-head*.6);
    arrow.shaft.material.color.set(color.selected);arrow.cone.material.color.set(color.selected);
  }
  clear(group){
    for(const child of [...group.children]){child.traverse(c=>{c.geometry?.dispose();if(c.material)for(const m of (Array.isArray(c.material)?c.material:[c.material]))m.dispose();});group.remove(child);}
  }
  line(points,group,options={}){
    if(group===this.referenceGroup){const step=Math.max(1,Math.floor(points.length/48));this.geometryBounds.push(...points.filter((_,i)=>i%step===0),points.at(-1));}
    const g=new LineGeometry();g.setPositions(points.flatMap(p=>p.toArray()));
    const m=new LineMaterial({color:options.color??color.orbit,linewidth:options.width??2,transparent:true,opacity:options.opacity??1,depthWrite:false,dashed:!!options.dashed,dashSize:.11,gapSize:.07});
    m.resolution.set(this.width,this.height);
    const line=new Line2(g,m);line.computeLineDistances();group.add(line);return line;
  }
  label(text,pos,type='',scope='reference',alwaysVisible=false){
    const el=document.createElement('span');el.className='scene-label '+type;el.textContent=text;this.labelsEl.append(el);
    this.labels.push({el,pos,scope,text,alwaysVisible});
  }
  clearLabels(scope){this.labels=this.labels.filter(l=>{if(l.scope===scope){l.el.remove();return false;}return true;});}
  circlePoints(radius,fn=([x,y])=>new THREE.Vector3(x,0,y),n=160){return Array.from({length:n+1},(_,j)=>fn([radius*Math.cos(j/n*TAU),radius*Math.sin(j/n*TAU),0]));}
  setOrbit(o,selected,options,fit=false){
    if(this.error)return;
    this.dirty=true;
    this.o={...o};this.selected=selected;this.options={...options};
    this.geometryBounds=[];this.angleBounds=[];
    this.clear(this.orbitGroup);this.clear(this.referenceGroup);this.clearLabels('reference');
    const points=Array.from({length:361},(_,j)=>eci(stateAtTrue(o,j).position));
    this.orbitBounds=points.filter((_,j)=>j%4===0);
    this.orbitLine=this.line(points,this.orbitGroup,{width:3.5,color:selected==='e'?color.selected:color.orbit});
    const a=o.a/EARTH_RADIUS,r=Math.max(1.28,a*.73);
    const eq=isEquatorial(o),circ=isCircular(o);
    const planes=options.planes||selected==='i';
    if(planes){
      const planeRadius=Math.max(1.35,a*1.04);
      const disc=new THREE.Mesh(new THREE.CircleGeometry(planeRadius,100),new THREE.MeshBasicMaterial({color:0x44769a,transparent:true,opacity:this.theme==='night'?.055:.09,side:THREE.DoubleSide,depthWrite:false}));disc.rotation.x=-Math.PI/2;this.referenceGroup.add(disc);
      this.line(this.circlePoints(planeRadius),this.referenceGroup,{color:color.reference,width:2,opacity:.65});
      if(selected==='i'||selected==='arg'){
        const geom=new THREE.BufferGeometry();const verts=[0,0,0];
        for(let j=0;j<=100;j++){const v=xyz(rotateOrbital([planeRadius*Math.cos(j/100*TAU),planeRadius*Math.sin(j/100*TAU),0],o));verts.push(...v.toArray());}
        const indices=[];for(let j=1;j<=100;j++)indices.push(0,j,j+1);
        geom.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geom.setIndex(indices);
        for(let j=3;j<verts.length;j+=15)this.geometryBounds.push(new THREE.Vector3(...verts.slice(j,j+3)));
        this.referenceGroup.add(new THREE.Mesh(geom,new THREE.MeshBasicMaterial({color:color.selected,transparent:true,opacity:.15,side:THREE.DoubleSide,depthWrite:false})));
        this.line(this.circlePoints(planeRadius,v=>xyz(rotateOrbital(v,o))),this.referenceGroup,{color:color.selected,width:3});
      }
    }
    const axes=options.axes||['i','raan'].includes(selected)||(eq&&['arg','nu'].includes(selected));
    if(axes){for(const [vec,name] of [[[1,0,0],'+I'],[[0,1,0],'+J'],[[0,0,1],'+K']]){
      const v=xyz(vec).multiplyScalar(Math.max(1.6,a*.9));this.line([v.clone().negate(),v],this.referenceGroup,{color:color.axis,width:2,opacity:.65,dashed:true});this.label(name,v.clone());
    }}
    if(!eq&&(options.markers||['raan','arg','nu'].includes(selected))){
      const nodes=nodeStates(o);nodes.forEach((s,j)=>{
        const p=eci(s.position);const marker=new THREE.Mesh(new THREE.SphereGeometry(.035,12,12),new THREE.MeshBasicMaterial({color:color.node}));marker.position.copy(p);this.referenceGroup.add(marker);this.label(j?'Descending node':'Ascending node',p.clone());
      });
      const n=xyz([Math.cos(o.raan*DEG),Math.sin(o.raan*DEG),0]).multiplyScalar(r);
      this.line([n.clone().negate(),n],this.referenceGroup,{color:color.node,width:1.5,opacity:.8,dashed:true});
    }
    if(!circ&&(options.markers||['a','e','arg','nu'].includes(selected))){
      for(const [nu,text] of [[0,'Perigee'],[180,'Apogee']]){
        const p=eci(stateAtTrue(o,nu).position);const m=new THREE.Mesh(new THREE.SphereGeometry(.033,12,12),new THREE.MeshBasicMaterial({color:color.orange}));m.position.copy(p);this.referenceGroup.add(m);this.label(text,p.clone(),['e','arg'].includes(selected)?'angle':'', 'reference',true);
      }
    }
    if(selected==='a'){
      const center=xyz(rotateOrbital([-a*o.e,0,0],o));const end=eci(stateAtTrue(o,0).position);
      const offset=xyz(rotateOrbital([0,-a*Math.sqrt(1-o.e*o.e)*1.22,0],o));
      const left=center.clone().add(offset),right=end.clone().add(offset);
      this.line([left,right],this.referenceGroup,{color:color.selected,width:3.5});
      this.line([center,left],this.referenceGroup,{color:color.orange,width:1,opacity:.3,dashed:true});
      this.line([end,right],this.referenceGroup,{color:color.orange,width:1,opacity:.3,dashed:true});
      this.label('Size, a',left.clone().lerp(right,.5),'angle','reference',true);
      if(!circ)this.label('Earth · focus',new THREE.Vector3(),'','reference',true);
    }
    if(selected==='e'&&!circ){
      const v=xyz(rotateOrbital([1.45,0,0],o));this.line([new THREE.Vector3(),v],this.referenceGroup,{color:color.selected,width:3.5});
    }
    if(options.vectors||selected==='i'){
      const h=xyz(rotateOrbital([0,0,1.8],o));const arrow=this.arrow(color.selected);arrow.setDirection(h.clone().normalize());arrow.userData.length=h.length();this.referenceGroup.add(arrow);this.geometryBounds.push(h);this.label('h',h,'angle');
    }
    if(options.vectors)for(const p of this.orbitBounds)for(const axis of [new THREE.Vector3(.7,0,0),new THREE.Vector3(0,.7,0),new THREE.Vector3(0,0,.7)])this.geometryBounds.push(p.clone().add(axis),p.clone().sub(axis));
    this.projection.visible=this.subpoint.visible=options.projection;
    this.positionArrow.visible=options.vectors||selected==='nu';this.velocityArrow.visible=options.vectors;
    this.updateAngle(o.nu);
    if(fit)this.setView(this.view,true);
    // Element edits deliberately retain camera position and target. Fit view is explicit.
  }

  updateAngle(nu){
    if(this.error||!this.o)return;
    this.dirty=true;
    const o=this.o,key=this.selected,a=o.a/EARTH_RADIUS;this.clear(this.angleGroup);this.clearLabels('angle');
    this.angleBounds=[];
    const r=Math.max(1.15,Math.min(a*.6,2.8));let points=[],symbol='',mid;
    const eq=isEquatorial(o),circ=isCircular(o),angles=anglesAt(o,nu);
    if(key==='i'){
      const h0=new THREE.Vector3(0,1,0),n=xyz([Math.cos(o.raan*DEG),Math.sin(o.raan*DEG),0]);
      points=Array.from({length:65},(_,j)=>h0.clone().applyAxisAngle(n,o.i*DEG*j/64).multiplyScalar(r));symbol='i';
    }else if(key==='raan'&&!eq){points=Array.from({length:81},(_,j)=>xyz([r*Math.cos(o.raan*DEG*j/80),r*Math.sin(o.raan*DEG*j/80),0]));symbol='Ω';
    }else if(key==='arg'&&!circ){
      if(eq){points=Array.from({length:81},(_,j)=>xyz([r*Math.cos(angles.pi*DEG*j/80),r*Math.sin(angles.pi*DEG*j/80),0]));symbol='Π';}
      else{points=Array.from({length:81},(_,j)=>xyz(rotateOrbital([r*Math.cos((-o.arg+o.arg*j/80)*DEG),r*Math.sin((-o.arg+o.arg*j/80)*DEG),0],o)));symbol='ω';}
    }else if(key==='nu'){
      if(eq&&circ){points=Array.from({length:81},(_,j)=>xyz([r*Math.cos(angles.l*DEG*j/80),r*Math.sin(angles.l*DEG*j/80),0]));symbol='ℓ';}
      else {const start=circ?-o.arg:0,span=circ?angles.u:nu;points=Array.from({length:81},(_,j)=>xyz(rotateOrbital([r*Math.cos((start+span*j/80)*DEG),r*Math.sin((start+span*j/80)*DEG),0],o)));symbol=circ?'u':'ν';}
    }
    if(points.length){
      this.line(points,this.angleGroup,{color:color.selected,width:3.5});
      this.line([new THREE.Vector3(),points[0]],this.angleGroup,{color:color.selected,width:2,opacity:.65,dashed:true});
      this.line([new THREE.Vector3(),points.at(-1)],this.angleGroup,{color:color.selected,width:2,opacity:.65,dashed:true});
      this.angleBounds=points.filter((_,j)=>j%4===0);
      mid=points[Math.floor(points.length/2)].clone();this.label(({i:'Inclination, i','Ω':'RAAN, Ω','ω':'Perigee angle, ω','ν':'Location, ν','u':'Latitude angle, u','Π':'Perigee longitude, Π','ℓ':'Longitude, ℓ'})[symbol]||symbol,mid,'angle','angle',true);
    }
  }
  setView(view,fit=true){
    if(this.error)return;
    this.dirty=true;
    this.view=view;const o=this.o||{a:12000,e:.25,i:45,raan:30,arg:45};
    let dir=new THREE.Vector3(5,3.4,5.8);
    if(view==='north')dir.set(.001,1,.001);
    if(view==='equator')dir.set(1,.001,1.5);
    if(view==='plane')dir=xyz(rotateOrbital([0,0,1],o));
    this.camera.up.set(0,1,0);if(view==='north')this.camera.up.set(0,0,-1);
    this.controls.target.set(0,0,0);this.camera.position.copy(dir.normalize().multiplyScalar(20));this.controls.update();this.fitView();
  }
  fitPoints(){
    const points=[...this.orbitBounds,...this.geometryBounds,...this.angleBounds];
    // Sample the sphere in 3D so no orientation can crop the Earth silhouette.
    for(let lat=-90;lat<=90;lat+=15)for(let lon=0;lon<360;lon+=15)
      points.push(new THREE.Vector3(Math.cos(lat*DEG)*Math.cos(lon*DEG),Math.sin(lat*DEG),Math.cos(lat*DEG)*Math.sin(lon*DEG)));
    return points;
  }
  fitView(){
    if(this.error||!this.o)return;
    this.controls.update();this.camera.updateMatrixWorld();
    const direction=this.camera.position.clone().sub(this.controls.target).normalize();
    const right=new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld,0),up=new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld,1);
    const points=this.fitPoints(),bounds={x:[Infinity,-Infinity],y:[Infinity,-Infinity]};
    for(const p of points){for(const [key,axis] of [['x',right],['y',up]]){const v=p.dot(axis);bounds[key][0]=Math.min(bounds[key][0],v);bounds[key][1]=Math.max(bounds[key][1],v);}}
    const target=right.clone().multiplyScalar((bounds.x[0]+bounds.x[1])/2).addScaledVector(up,(bounds.y[0]+bounds.y[1])/2);
    const tangent=Math.tan(this.camera.fov*DEG/2),safeX=.88,safeY=Math.max(.35,1-112/this.height);
    let distance=2;
    for(const point of points){const p=point.clone().sub(target),depth=p.dot(direction);distance=Math.max(distance,depth+Math.abs(p.dot(right))/(tangent*this.camera.aspect*safeX),depth+Math.abs(p.dot(up))/(tangent*safeY));}
    this.controls.target.copy(target);this.camera.position.copy(target).addScaledVector(direction,distance*1.04);
    this.controls.update();this.camera.updateMatrixWorld();this.calloutSides.clear();this.dirty=true;
  }
  diagnostics(){
    if(this.error)return null;
    const points=this.orbitBounds.map(p=>p.clone().project(this.camera));
    return {position:this.camera.position.toArray(),target:this.controls.target.toArray(),orbitWidth:(Math.max(...points.map(p=>p.x))-Math.min(...points.map(p=>p.x)))*this.width/2,orbitHeight:(Math.max(...points.map(p=>p.y))-Math.min(...points.map(p=>p.y)))*this.height/2,width:this.width,height:this.height,bounds:this.projectedGeometryBounds()};
  }
  setTheme(theme){
    this.theme=theme;
    Object.assign(color,theme==='day'?{orbit:0x006c70,selected:0x7132a8,orange:0xae4900,reference:0x648395,axis:0x496678,node:0x43587b}:{orbit:0x73e1dc,selected:0xd4b3ff,orange:0xffbd75,reference:0x637f9a,axis:0x9eb5cb,node:0xd1dbef});
    if(this.error)return;this.dirty=true;this.stars.visible=false;this.subpoint.material.color.set(color.orange);
    const pin=this.pinCanvas.getContext('2d');pin.clearRect(0,0,64,64);
    pin.fillStyle=theme==='day'?'#fafbfc':'#0d1828';pin.beginPath();pin.arc(32,32,27,0,TAU);pin.fill();
    pin.strokeStyle=theme==='day'?'#ae4900':'#ffbd75';pin.lineWidth=8;pin.stroke();pin.fillStyle=pin.strokeStyle;pin.beginPath();pin.arc(32,32,12,0,TAU);pin.fill();this.satPin.material.map.needsUpdate=true;
    this.positionArrow.setColor(color.orbit);this.velocityArrow.setColor(color.orange);this.projection.material.color.set(color.orange);
  }
  projectedGeometryBounds(spacecraftPosition){
    const points=[...this.orbitBounds,...this.geometryBounds,...this.angleBounds];
    const right=new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld,0);
    const up=new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld,1);
    // Include the globe silhouette, even in an edge-on equatorial orbit.
    for(let j=0;j<16;j++)points.push(right.clone().multiplyScalar(1.08*Math.cos(j/16*TAU)).addScaledVector(up,1.08*Math.sin(j/16*TAU)));
    let left=this.width/2,rightEdge=left,top=this.height/2,bottom=top;
    for(const point of points){
      const p=point.clone().project(this.camera);
      if(p.z< -1||p.z>1)continue;
      const x=(p.x*.5+.5)*this.width,y=(-p.y*.5+.5)*this.height;
      left=Math.min(left,x);rightEdge=Math.max(rightEdge,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
    }
    return {left:Math.max(0,left-7),right:Math.min(this.width,rightEdge+7),top:Math.max(0,top-7),bottom:Math.min(this.height,bottom+7)};
  }
  layoutLabels(spacecraftPosition){
    const all=[{el:this.spacecraftLabel,pos:spacecraftPosition,text:'Spacecraft',scope:'spacecraft',alwaysVisible:true},...this.labels];
    const rank=l=>l.scope==='angle'?100:l.scope==='spacecraft'?95:l.el.classList.contains('angle')?90:l.text==='Perigee'||l.text==='Apogee'?80:50;
    all.sort((a,b)=>rank(b)-rank(a));
    const rows={top:[],bottom:[]},leaders=[],gap=8,pad=8,bounds=this.projectedGeometryBounds(spacecraftPosition);
    const aliases={'Ascending node':'AN','Descending node':'DN','Earth · focus':'Earth focus','Perigee longitude, Π':'Perigee, Π','Latitude angle, u':'Location, u'};
    for(const l of all){
      const p=l.pos.clone().project(this.camera);l.el.dataset.feature=l.text;
      l.el.textContent=this.width<500?(aliases[l.text]||l.text):l.text;
      if(p.z>1||p.z< -1||Math.abs(p.x)>1||Math.abs(p.y)>1){l.el.style.display='none';continue;}
      l.el.style.display='';const w=l.el.offsetWidth,h=l.el.offsetHeight;
      const key=l.scope+':'+l.text;
      let side=this.calloutSides.get(key)||(l.scope==='spacecraft'?'bottom':p.y>0?'top':'bottom');
      const used=side=>rows[side].reduce((n,item)=>n+item.w+gap,0);
      if(used(side)+w>this.width-2*pad)side=side==='top'?'bottom':'top';
      if(used(side)+w>this.width-2*pad){l.el.style.display='none';continue;}
      this.calloutSides.set(key,side);rows[side].push({...l,w,h,x:(p.x*.5+.5)*this.width,y:(-p.y*.5+.5)*this.height});
    }
    // Stable ordering uses feature identity, never the moving attachment's x coordinate.
    for(const [side,entries] of Object.entries(rows)){
      entries.sort((a,b)=>a.text.localeCompare(b.text));
      const total=entries.reduce((n,l)=>n+l.w,0)+gap*Math.max(0,entries.length-1);let left=(this.width-total)/2;
      for(const l of entries){
        const cx=left+l.w/2,cy=side==='top'?Math.max(pad+l.h/2,bounds.top-12-l.h/2):Math.min(this.height-pad-l.h/2,bounds.bottom+12+l.h/2);left+=l.w+gap;
        l.el.style.left=cx+'px';l.el.style.top=cy+'px';l.el.dataset.dock=side;
        const edge=side==='top'?cy+l.h/2:cy-l.h/2;
        const cls=l.el.classList.contains('highlight')?'callout-highlight':l.el.classList.contains('angle')?'callout-angle':'callout-neutral';
        leaders.push(`<path data-feature="${l.text}" class="${cls}" d="M${cx.toFixed(2)},${edge.toFixed(2)}L${cx.toFixed(2)},${(edge+(side==='top'?6:-6)).toFixed(2)}L${l.x.toFixed(2)},${l.y.toFixed(2)}"/><circle data-feature="${l.text}" class="${cls}" cx="${l.x.toFixed(2)}" cy="${l.y.toFixed(2)}" r="2.5"/>`);
      }
    }
    this.labelLeaders.setAttribute('viewBox',`0 0 ${this.width} ${this.height}`);this.labelLeaders.innerHTML=leaders.join('');
  }
  render(s,earthAngle){
    if(this.error)return;
    this.controls.update();
    this.camera.updateMatrixWorld();
    if(!this.dirty&&this.lastNu===s.nu&&this.lastEarthAngle===earthAngle)return;
    this.dirty=false;this.lastNu=s.nu;this.lastEarthAngle=earthAngle;
    this.earth.rotation.y=earthAngle;
    const pos=eci(s.position),dir=eci(s.velocity).normalize();
    const pixel=this.unitsPerPixel(pos);
    this.satPin.position.copy(pos);this.satPin.scale.setScalar(pixel*18);
    this.subpoint.position.copy(pos).normalize().multiplyScalar(1.014);this.subpoint.scale.setScalar(7.5*this.unitsPerPixel(this.subpoint.position)/.022);
    const arr=this.projection.geometry.attributes.position;
    arr.setXYZ(0,...this.subpoint.position.toArray());arr.setXYZ(1,...pos.toArray());arr.needsUpdate=true;this.projection.computeLineDistances();
    this.positionArrow.setDirection(pos.clone().normalize());this.sizeArrow(this.positionArrow,pos.length());
    this.velocityArrow.position.copy(pos);this.velocityArrow.setDirection(dir);this.sizeArrow(this.velocityArrow,.7);
    this.referenceGroup.traverse(o=>{if(o.shaft)this.sizeArrow(o,o.userData.length);});
    this.layoutLabels(pos);
    this.renderer.render(this.scene,this.camera);
  }
}

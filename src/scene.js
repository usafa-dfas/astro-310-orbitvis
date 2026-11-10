import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {Line2} from 'three/addons/lines/Line2.js';
import {LineGeometry} from 'three/addons/lines/LineGeometry.js';
import {LineMaterial} from 'three/addons/lines/LineMaterial.js';
import earthImage from './assets/earth.jpg';
import {EARTH_RADIUS,DEG,TAU,stateAtTrue,rotateOrbital,isCircular,isEquatorial,nodeStates,anglesAt,cross,unit,norm} from './physics.js';

const xyz = a => new THREE.Vector3(a[0],a[2],-a[1]);
const eci = a => xyz(a).divideScalar(EARTH_RADIUS);
const color={orbit:0x77e2e6,orange:0xffbd75,reference:0x637f9a,axis:0x9eb5cb,node:0xd1dbef};

export class OrbitScene {
  constructor(container) {
    this.container=container;this.labelsEl=document.querySelector('#scene-labels');this.labels=[];
    this.labelSizes=new WeakMap();
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
    this.controls.minDistance=1.65;this.controls.maxDistance=70;
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
    this.satellite=new THREE.Group();
    const body=new THREE.Mesh(new THREE.BoxGeometry(.55,.55,.7),new THREE.MeshStandardMaterial({color:0xffd39c,metalness:.65,roughness:.3}));
    this.satellite.add(body);
    const solar=new THREE.MeshStandardMaterial({color:0x3981b5,metalness:.5,roughness:.35,side:THREE.DoubleSide});
    for(const side of [-1,1]){
      const panel=new THREE.Mesh(new THREE.BoxGeometry(1.15,.05,.68),solar);panel.position.x=side*.95;this.satellite.add(panel);
      const seams=new THREE.LineSegments(new THREE.EdgesGeometry(panel.geometry),new THREE.LineBasicMaterial({color:0xb1daf0,transparent:true,opacity:.8}));seams.position.copy(panel.position);this.satellite.add(seams);
    }
    const beacon=new THREE.Mesh(new THREE.SphereGeometry(.2,12,12),new THREE.MeshBasicMaterial({color:color.orange}));body.add(beacon);
    this.scene.add(this.satellite);
    const pinCanvas=document.createElement('canvas');pinCanvas.width=pinCanvas.height=128;
    const pin=pinCanvas.getContext('2d'),glow=pin.createRadialGradient(64,64,3,64,64,62);
    glow.addColorStop(0,'#ffbd7588');glow.addColorStop(1,'#ffbd7500');pin.fillStyle=glow;pin.fillRect(0,0,128,128);
    pin.strokeStyle='#ffbd75';pin.lineWidth=3;pin.beginPath();pin.arc(64,64,20,0,TAU);pin.stroke();
    pin.fillStyle='#ffe2bb';pin.beginPath();pin.arc(64,64,5,0,TAU);pin.fill();
    this.satPin=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(pinCanvas),transparent:true,depthWrite:false}));this.scene.add(this.satPin);
    this.spacecraftLabel=document.createElement('span');this.spacecraftLabel.className='scene-label highlight';this.spacecraftLabel.textContent='Spacecraft';this.labelsEl.append(this.spacecraftLabel);
    this.subpoint=new THREE.Mesh(new THREE.SphereGeometry(.022,16,16),new THREE.MeshBasicMaterial({color:color.orange}));this.scene.add(this.subpoint);
    this.projection=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3(0,1,0)]),new THREE.LineDashedMaterial({color:color.orange,dashSize:.07,gapSize:.06,transparent:true,opacity:.45}));this.scene.add(this.projection);
    this.velocityArrow=new THREE.ArrowHelper(new THREE.Vector3(1,0,0),new THREE.Vector3(),1,color.orange,.12,.07);this.scene.add(this.velocityArrow);
    this.positionArrow=new THREE.ArrowHelper(new THREE.Vector3(1,0,0),new THREE.Vector3(),1,color.orbit,.12,.07);this.scene.add(this.positionArrow);
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(container);
    this.resize();
  }
  resize(){
    if(this.error)return;
    this.dirty=true;
    this.width=Math.max(1,this.container.clientWidth);this.height=Math.max(1,this.container.clientHeight);
    const oldFit=Math.min(1,this.camera.aspect);
    this.camera.aspect=this.width/this.height;
    this.camera.position.sub(this.controls.target).multiplyScalar(oldFit/Math.min(1,this.camera.aspect)).add(this.controls.target);
    this.camera.updateProjectionMatrix();this.renderer.setSize(this.width,this.height);
    this.labelSizes=new WeakMap();
    this.scene.traverse(o=>{if(o.material?.isLineMaterial)o.material.resolution.set(this.width,this.height);});
  }
  clear(group){
    for(const child of [...group.children]){child.traverse(c=>{c.geometry?.dispose();if(c.material)for(const m of (Array.isArray(c.material)?c.material:[c.material]))m.dispose();});group.remove(child);}
  }
  line(points,group,options={}){
    const g=new LineGeometry();g.setPositions(points.flatMap(p=>p.toArray()));
    const m=new LineMaterial({color:options.color??color.orbit,linewidth:options.width??2,transparent:true,opacity:options.opacity??1,depthWrite:false,dashed:!!options.dashed,dashSize:.11,gapSize:.07});
    m.resolution.set(this.width,this.height);
    const line=new Line2(g,m);line.computeLineDistances();group.add(line);return line;
  }
  label(text,pos,type='',scope='reference'){
    const el=document.createElement('span');el.className='scene-label '+type;el.textContent=text;this.labelsEl.append(el);
    this.labels.push({el,pos,scope,text});
  }
  clearLabels(scope){this.labels=this.labels.filter(l=>{if(l.scope===scope){l.el.remove();return false;}return true;});}
  circlePoints(radius,fn=([x,y])=>new THREE.Vector3(x,0,y),n=160){return Array.from({length:n+1},(_,j)=>fn([radius*Math.cos(j/n*TAU),radius*Math.sin(j/n*TAU),0]));}
  setOrbit(o,selected,options,fit=false){
    if(this.error)return;
    this.dirty=true;
    this.o={...o};this.selected=selected;this.options={...options};
    this.clear(this.orbitGroup);this.clear(this.referenceGroup);this.clearLabels('reference');
    const points=Array.from({length:361},(_,j)=>eci(stateAtTrue(o,j).position));
    this.line(points,this.orbitGroup,{width:7,opacity:.08});
    this.orbitLine=this.line(points,this.orbitGroup,{width:2.8});
    const a=o.a/EARTH_RADIUS,extent=a*(1+o.e),r=Math.max(1.28,a*.73);
    const eq=isEquatorial(o),circ=isCircular(o);
    const planes=options.planes||selected==='i';
    if(planes){
      const planeRadius=Math.max(1.35,a*1.04);
      const disc=new THREE.Mesh(new THREE.CircleGeometry(planeRadius,100),new THREE.MeshBasicMaterial({color:0x44769a,transparent:true,opacity:this.theme==='night'?.055:.09,side:THREE.DoubleSide,depthWrite:false}));disc.rotation.x=-Math.PI/2;this.referenceGroup.add(disc);
      this.line(this.circlePoints(planeRadius),this.referenceGroup,{color:color.reference,width:1,opacity:.4});
      if(selected==='i'||selected==='arg'){
        const geom=new THREE.BufferGeometry();const verts=[0,0,0];
        for(let j=0;j<=100;j++){const v=xyz(rotateOrbital([planeRadius*Math.cos(j/100*TAU),planeRadius*Math.sin(j/100*TAU),0],o));verts.push(...v.toArray());}
        const indices=[];for(let j=1;j<=100;j++)indices.push(0,j,j+1);
        geom.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geom.setIndex(indices);
        this.referenceGroup.add(new THREE.Mesh(geom,new THREE.MeshBasicMaterial({color:color.orbit,transparent:true,opacity:.06,side:THREE.DoubleSide,depthWrite:false})));
      }
    }
    const axes=options.axes||['i','raan'].includes(selected)||(eq&&['arg','nu'].includes(selected));
    if(axes){for(const [vec,name] of [[[1,0,0],'+I'],[[0,1,0],'+J'],[[0,0,1],'+K']]){
      const v=xyz(vec).multiplyScalar(Math.max(1.6,a*.9));this.line([v.clone().negate(),v],this.referenceGroup,{color:color.axis,width:1.1,opacity:.48,dashed:true});this.label(name,v.clone().multiplyScalar(1.08));
    }}
    if(!eq&&(options.markers||['raan','arg','nu'].includes(selected))){
      const nodes=nodeStates(o);nodes.forEach((s,j)=>{
        const p=eci(s.position);const marker=new THREE.Mesh(new THREE.SphereGeometry(.035,12,12),new THREE.MeshBasicMaterial({color:color.node}));marker.position.copy(p);this.referenceGroup.add(marker);this.label(j?'Descending node':'Ascending node',p.clone().multiplyScalar(1.1));
      });
      const n=xyz([Math.cos(o.raan*DEG),Math.sin(o.raan*DEG),0]).multiplyScalar(r);
      this.line([n.clone().negate(),n],this.referenceGroup,{color:color.node,width:1.5,opacity:.8,dashed:true});
    }
    if(!circ&&(options.markers||['a','e','arg','nu'].includes(selected))){
      for(const [nu,text] of [[0,'Perigee'],[180,'Apogee']]){
        const p=eci(stateAtTrue(o,nu).position);const m=new THREE.Mesh(new THREE.SphereGeometry(.033,12,12),new THREE.MeshBasicMaterial({color:color.orange}));m.position.copy(p);this.referenceGroup.add(m);this.label(text,p.clone().multiplyScalar(1.09),'highlight');
      }
    }
    if(selected==='a'){
      const center=xyz(rotateOrbital([-a*o.e,0,0],o));const end=eci(stateAtTrue(o,0).position);
      const offset=xyz(rotateOrbital([0,-a*Math.sqrt(1-o.e*o.e)*1.22,0],o));
      const left=center.clone().add(offset),right=end.clone().add(offset);
      this.line([left,right],this.referenceGroup,{color:color.orange,width:1.7,opacity:.85});
      this.line([center,left],this.referenceGroup,{color:color.orange,width:1,opacity:.3,dashed:true});
      this.line([end,right],this.referenceGroup,{color:color.orange,width:1,opacity:.3,dashed:true});
      this.label('a',left.clone().lerp(right,.5).add(offset.clone().normalize().multiplyScalar(.15)),'angle');
      if(!circ)this.label('Earth · focus',new THREE.Vector3(0,-1.18,0));
    }
    if(selected==='e'&&!circ){
      const v=xyz(rotateOrbital([1.45,0,0],o));this.line([new THREE.Vector3(),v],this.referenceGroup,{color:color.orange,width:2,opacity:.8});
    }
    if(options.vectors||selected==='i'){
      const h=xyz(rotateOrbital([0,0,1.8],o));this.referenceGroup.add(new THREE.ArrowHelper(h.clone().normalize(),new THREE.Vector3(),h.length(),color.orbit,.14,.08));this.label('h',h.multiplyScalar(1.08),'angle');
    }
    this.projection.visible=this.subpoint.visible=options.projection;
    this.positionArrow.visible=options.vectors||selected==='nu';this.velocityArrow.visible=options.vectors;
    if(fit)this.setView(this.view,true);
    else {
      // Keep a stable scale until the actual projected orbit approaches an edge.
      // Expanding only as needed makes a's size change visible without clipping.
      for(let attempt=0;attempt<3;attempt++){
        this.controls.update();this.camera.updateMatrixWorld();let bound=0;
        for(let j=0;j<points.length;j+=5){const p=points[j].clone().project(this.camera);bound=Math.max(bound,Math.abs(p.x),Math.abs(p.y));}
        if(bound<.94)break;
        this.camera.position.sub(this.controls.target).multiplyScalar(bound/.87).add(this.controls.target);
      }
    }
    this.updateAngle(o.nu);
  }
  updateAngle(nu){
    if(this.error||!this.o)return;
    this.dirty=true;
    const o=this.o,key=this.selected,a=o.a/EARTH_RADIUS;this.clear(this.angleGroup);this.clearLabels('angle');
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
      this.line(points,this.angleGroup,{color:color.orbit,width:3});
      this.line([new THREE.Vector3(),points[0]],this.angleGroup,{color:color.orbit,width:1.1,opacity:.4,dashed:true});
      this.line([new THREE.Vector3(),points.at(-1)],this.angleGroup,{color:color.orbit,width:1.1,opacity:.4,dashed:true});
      mid=points[Math.floor(points.length/2)].clone().multiplyScalar(1.13);this.label(symbol,mid,'angle','angle');
    }
  }
  setView(view,fit=true){
    if(this.error)return;
    this.dirty=true;
    this.view=view;const o=this.o||{a:12000,e:.25,i:45,raan:30,arg:45};
    const extent=Math.max(1.2,o.a/EARTH_RADIUS*(1+o.e));
    // Fit to both dimensions. The globe and orbital ellipse retain the same scale.
    const d=extent/Math.sin(19.5*DEG)/Math.min(1,this.camera.aspect)*1.04;
    let dir=new THREE.Vector3(5,3.4,5.8);
    if(view==='north')dir.set(.001,1,.001);
    if(view==='equator')dir.set(1,.001,1.5);
    if(view==='plane')dir=xyz(rotateOrbital([0,0,1],o));
    this.camera.up.set(0,1,0);if(view==='north')this.camera.up.set(0,0,-1);
    this.camera.position.copy(dir.normalize().multiplyScalar(d));this.controls.target.set(0,0,0);this.controls.update();
  }
  setTheme(theme){
    this.theme=theme;
    Object.assign(color,theme==='day'?{orbit:0x087986,orange:0xab560c,reference:0x648395,axis:0x496678,node:0x43587b}:{orbit:0x77e2e6,orange:0xffbd75,reference:0x637f9a,axis:0x9eb5cb,node:0xd1dbef});
    if(this.error)return;this.dirty=true;this.stars.visible=theme==='night';
    this.positionArrow.setColor(color.orbit);this.velocityArrow.setColor(color.orange);this.projection.material.color.set(color.orange);
  }
  layoutLabels(spacecraftPosition){
    const aliases={'Ascending node':'AN','Descending node':'DN'};
    const labels=[{el:this.spacecraftLabel,pos:spacecraftPosition,text:'Spacecraft',scope:'spacecraft'},...this.labels];
    const priority=l=>l.scope==='angle'?100:l.scope==='spacecraft'?95:l.text==='h'?90:l.el.classList.contains('angle')?85:l.text.startsWith('+')?80:l.text.includes('node')?70:50;
    labels.sort((a,b)=>priority(b)-priority(a));
    const occupied=[],leaders=[];
    const hint=this.container.querySelector('.scene-hint');
    const bottom=hint&&getComputedStyle(hint).display!=='none'?25:5;
    for(const l of labels){
      const text=this.width<620?(aliases[l.text]||l.text):l.text;
      if(l.el.textContent!==text){l.el.textContent=text;this.labelSizes.delete(l.el);}
      const p=l.pos.clone().project(this.camera),ray=l.pos.clone().sub(this.camera.position),distance=ray.length(),rdir=ray.clone().normalize();
      const along=-this.camera.position.dot(rdir),closest=this.camera.position.clone().addScaledVector(rdir,along);
      const occluded=along>0&&along<distance&&closest.length()<.98;
      if(p.z>1||p.z< -1||Math.abs(p.x)>1||Math.abs(p.y)>1||occluded){l.el.style.display='none';continue;}
      l.el.style.display='';
      let size=this.labelSizes.get(l.el);
      if(!size){size={w:l.el.offsetWidth,h:l.el.offsetHeight};this.labelSizes.set(l.el,size);}
      const {w,h}=size,x=(p.x*.5+.5)*this.width,y=(-p.y*.5+.5)*this.height;
      const offsets=l.scope==='spacecraft'?[[0,-25],[w/2+14,0],[-w/2-14,0],[0,25]]:
        [[0,0],[0,-h-9],[0,h+9],[w/2+14,0],[-w/2-14,0],[w/2+10,-h-9],[-w/2-10,h+9]];
      let placed=null;
      for(const [dx,dy] of offsets){
        const cx=Math.max(w/2+6,Math.min(this.width-w/2-6,x+dx));
        const cy=Math.max(h/2+6,Math.min(this.height-h/2-bottom,y+dy));
        const box={left:cx-w/2,right:cx+w/2,top:cy-h/2,bottom:cy+h/2};
        if(w>this.width-12||h>this.height-bottom-12)continue;
        if(occupied.some(b=>box.left<b.right+5&&box.right>b.left-5&&box.top<b.bottom+4&&box.bottom>b.top-4))continue;
        placed={cx,cy,...box};break;
      }
      if(!placed){l.el.style.display='none';continue;}
      occupied.push(placed);l.el.style.left=placed.cx+'px';l.el.style.top=placed.cy+'px';
      const ex=Math.max(placed.left,Math.min(placed.right,x)),ey=Math.max(placed.top,Math.min(placed.bottom,y));
      if(Math.hypot(ex-x,ey-y)>7)leaders.push(`M${x.toFixed(1)},${y.toFixed(1)}L${ex.toFixed(1)},${ey.toFixed(1)}`);
    }
    this.labelLeaders.setAttribute('viewBox',`0 0 ${this.width} ${this.height}`);
    this.labelLeaders.innerHTML=leaders.length?`<path d="${leaders.join('')}"/>`:'';
  }
  render(s,earthAngle){
    if(this.error)return;
    this.controls.update();
    if(!this.dirty&&this.lastNu===s.nu&&this.lastEarthAngle===earthAngle)return;
    this.dirty=false;this.lastNu=s.nu;this.lastEarthAngle=earthAngle;
    this.earth.rotation.y=earthAngle;
    const pos=eci(s.position),dir=eci(s.velocity).normalize();this.satellite.position.copy(pos);
    const scale=Math.max(.045,this.camera.position.distanceTo(pos)*.009);this.satellite.scale.setScalar(scale);
    this.satPin.position.copy(pos);this.satPin.scale.setScalar(scale*5.5);
    this.satellite.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),dir);
    this.subpoint.position.copy(pos).normalize().multiplyScalar(1.014);
    const arr=this.projection.geometry.attributes.position;
    arr.setXYZ(0,...this.subpoint.position.toArray());arr.setXYZ(1,...pos.toArray());arr.needsUpdate=true;this.projection.computeLineDistances();
    this.positionArrow.setDirection(pos.clone().normalize());this.positionArrow.setLength(pos.length(),.12,.06);
    this.velocityArrow.position.copy(pos);this.velocityArrow.setDirection(dir);this.velocityArrow.setLength(.7,.12,.06);
    this.layoutLabels(pos);
    this.renderer.render(this.scene,this.camera);
  }
}

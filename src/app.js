import {OrbitScene} from './scene.js';
import landData from './assets/land.json';
import {MU,EARTH_RADIUS,SIDEREAL_DAY,EARTH_RATE,DEG,TAU,mod,clamp,norm,period,meanMotion,meanFromTrue,stateAt,stateAtTrue,groundPoint,anglesAt,canonicalize,isCircular,isEquatorial,maxLatitude,direction,validateOrbit,sampleGroundTrack,trackSegments,PRESETS} from './physics.js';

const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const svgNS='http://www.w3.org/2000/svg';
const compactQuery=matchMedia('(min-width: 801px) and (max-width: 1250px), (min-width: 801px) and (max-height: 820px)');
let compactOverride=null,mapScale=1;
document.body.classList.toggle('compact-controls',compactQuery.matches);
const guideSelected=document.createElement('section');guideSelected.className='guide-selected';
guideSelected.innerHTML='<h3 id="guide-element-title"></h3><p id="guide-element-text"></p><p id="guide-element-note"></p>';
$('#guide-dialog .dialog-lead').after(guideSelected);
const playIcon='<svg width="16" height="18" viewBox="0 0 16 18" aria-hidden="true"><path d="M2 1L15 9L2 17Z" fill="currentColor"/></svg>';
const pauseIcon='<svg width="16" height="18" viewBox="0 0 16 18" aria-hidden="true"><path d="M2 1H6V17H2ZM10 1H14V17H10Z" fill="currentColor"/></svg>';
const svg=(tag,attrs,parent)=>{const el=document.createElementNS(svgNS,tag);for(const [k,v]of Object.entries(attrs))el.setAttribute(k,v);if(parent)parent.append(el);return el;};
const number=(v,d=0)=>v.toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});
const mapX=lon=>40+(lon+180)/360*1000,mapY=lat=>32+(90-lat)/180*500;
const pathFor=points=>trackSegments(points).map(s=>s.map((p,j)=>`${j?'L':'M'}${mapX(p.lon).toFixed(2)},${mapY(p.lat).toFixed(2)}`).join('')).join('');
const definitions={
  a:{symbol:'a',name:'Size',full:'Semi-major axis',min:6600,max:50000,step:10,unit:'km',title:'Size & period',text:'A larger semi-major axis makes a larger orbit and a longer period. Earth sits at a focus, not at the ellipse’s center.'},
  e:{symbol:'e',name:'Shape',full:'Eccentricity',min:0,max:.85,step:.005,unit:'',title:'Shape & dwell',text:'Increasing eccentricity stretches the ellipse. The spacecraft moves faster near perigee and spends more time near apogee.'},
  i:{symbol:'i',name:'Tilt',full:'Inclination',min:0,max:180,step:1,unit:'°',title:'Tilt & latitude',text:'Inclination tilts the orbital plane. The latitude limit is min(i, 180° − i): 60° and 120° reach the same latitudes in different directions.'},
  raan:{symbol:'Ω',name:'Swivel',full:'RAAN',min:0,max:360,step:1,unit:'°',title:'Swivel of the orbital plane',text:'RAAN turns the plane around Earth’s north axis. It is measured from the inertial +I direction to the ascending node—not from Greenwich.'},
  arg:{symbol:'ω',name:'Perigee',full:'Argument of perigee',min:0,max:360,step:1,unit:'°',title:'Perigee’s place in the plane',text:'Argument of perigee moves the ellipse within its plane, from the ascending node to perigee. The orbital plane itself stays fixed.'},
  nu:{symbol:'ν',name:'Location',full:'True anomaly',min:0,max:360,step:1,unit:'°',title:'Where is the spacecraft?',text:'True anomaly locates the spacecraft from perigee, along the direction of motion. Relocating it leaves the orbital path unchanged; time scrubbing also turns Earth.'}
};
const state={o:canonicalize({...PRESETS.teaching}),preset:'teaching',t:0,orbitEpoch:0,earthPhase:0,earthEpoch:0,rotating:true,playing:false,speed:300,span:3,selected:'a',options:{axes:false,planes:true,markers:false,vectors:false,projection:true},layout:'both'};
const scene=new OrbitScene($('#orbit-canvas'));
let trackDirty=true,lastTrackUpdate=-Infinity,lastAngleUpdate=-Infinity,feedbackTimer;
let lastDisplayedTime=null,lastDisplayedOrbit=null,lastDisplayedEarth=null;
const current=()=>stateAt(state.o,state.t-state.orbitEpoch);
const earthAngle=()=>state.earthPhase+(state.rotating?EARTH_RATE:0)*(state.t-state.earthEpoch);

function descriptor(key){
  const d={...definitions[key]},o=state.o,circ=isCircular(o),eq=isEquatorial(o);
  if(key==='raan'&&eq){d.disabled=true;d.reason='No ascending node';}
  if(key==='arg'&&circ){d.disabled=true;d.reason='No unique perigee';}
  else if(key==='arg'&&eq){d.symbol='Π';d.full='Longitude of perigee';d.title='Perigee without a node';d.text='An equatorial orbit has no ascending node. Longitude of perigee locates perigee from the inertial +I direction.';}
  if(key==='nu'&&circ){
    d.symbol=eq?'ℓ':'u';d.full=eq?'True longitude':'Argument of latitude';d.title=eq?'Location without a node or perigee':'Location without perigee';
    d.text=eq?'This circular, equatorial orbit has no perigee or ascending node. True longitude locates the spacecraft from the inertial +I direction.':'A circle has no unique perigee. Argument of latitude locates the spacecraft from the ascending node, along the direction of motion.';
  }
  if(d.disabled){d.title=`${definitions[key].full} is undefined`;d.text=circ?'A circle has no unique perigee. Use the highlighted location control with its alternate angle to locate the spacecraft.':'An equatorial orbit has no ascending node. Use longitude of perigee (Π), or true longitude (ℓ) for a circle.';}
  return d;
}

function fieldValue(key,s=current()){
  if(key==='nu')return isCircular(state.o)?(isEquatorial(state.o)?anglesAt(state.o,s.nu).l:anglesAt(state.o,s.nu).u):s.nu;
  if(key==='arg'&&isEquatorial(state.o)&&!isCircular(state.o))return anglesAt(state.o,s.nu).pi;
  return state.o[key];
}
function makeControls(){
  const dock=$('#element-dock');dock.replaceChildren();
  for(const [index,key] of Object.keys(definitions).entries()){
    const d=descriptor(key),card=document.createElement('div');card.className='element-card';card.dataset.key=key;
    card.style.setProperty('--element-column',index+1);
    card.innerHTML=`<button class="element-select" aria-pressed="false" title="Explain ${d.full}"><span class="element-symbol">${d.symbol}</span><span class="element-name">${d.name}</span><span class="element-summary" aria-hidden="true"></span></button><div class="element-value"><input type="number" inputmode="decimal" aria-label="${d.full}" min="${d.min}" max="${d.max}" step="${key==='a'?'0.01':key==='e'?'0.001':'0.1'}"><span class="unit">${d.unit}</span><span class="undefined-label" hidden>Undefined</span></div><input type="range" min="${d.min}" max="${d.max}" step="${d.step}" aria-label="Adjust ${d.full}"><div class="element-description">${d.full.toUpperCase()}</div>`;
    card.querySelector('button').addEventListener('click',()=>selectElement(key));
    const input=card.querySelector('input[type=number]'),range=card.querySelector('input[type=range]');
    range.addEventListener('pointerdown',()=>{pause('PAUSED · ADJUSTING ELEMENT');selectElement(key);});
    range.addEventListener('input',()=>editElement(key,Number(range.value)));
    input.addEventListener('focus',()=>{pause('PAUSED · ADJUSTING ELEMENT');selectElement(key);});
    input.addEventListener('change',()=>editElement(key,input.value.trim()===''?NaN:Number(input.value)));
    input.addEventListener('keydown',e=>{if(e.key==='Enter'){input.blur();}if(e.key==='Escape'){input.value=formatInput(key,fieldValue(key));input.blur();}});
    dock.append(card);
  }
  updateControls(true);
}
function formatInput(key,value){return key==='a'?value.toFixed(2).replace(/\.00$/,''):key==='e'?value.toFixed(3):value.toFixed(1);}
function updateControls(force=false){
  const s=current();
  for(const card of $$('.element-card')){
    const key=card.dataset.key,d=descriptor(key),input=card.querySelector('input[type=number]'),range=card.querySelector('input[type=range]'),btn=card.querySelector('button');
    card.classList.toggle('active',state.selected===key);card.classList.toggle('disabled',!!d.disabled);btn.setAttribute('aria-pressed',String(state.selected===key));
    card.querySelector('.element-symbol').textContent=d.symbol;
    card.querySelector('.element-description').textContent=d.disabled?d.reason:d.full.toUpperCase();
    input.hidden=!!d.disabled;card.querySelector('.unit').hidden=!!d.disabled;card.querySelector('.undefined-label').hidden=!d.disabled;
    input.disabled=range.disabled=!!d.disabled;
    input.setAttribute('aria-label',d.full);range.setAttribute('aria-label','Adjust '+d.full);btn.title='Explain '+d.full;
    const summary=card.querySelector('.element-summary'),v=fieldValue(key,s);
    summary.innerHTML=d.disabled?'Undefined':`${number(v,key==='a'?0:key==='e'?3:1)}<small>${d.unit?' '+d.unit:''}</small>`;
    btn.setAttribute('aria-label',`${d.full}: ${d.disabled?'undefined':number(v,key==='e'?3:1)+' '+d.unit}`);
    if(!d.disabled){const v=fieldValue(key,s);if(force||document.activeElement!==input)input.value=formatInput(key,v);range.value=v;range.setAttribute('aria-valuetext',`${number(v,key==='e'?3:1)} ${d.unit}`);}
  }
  const o=state.o;
  $('#orbit-class').textContent=`${isCircular(o)?'CIRCULAR':'ELLIPTICAL'} · ${Math.abs(o.i-90)<1e-6?'POLAR':o.i>90?'RETROGRADE':'PROGRADE'}`;
}
function feedback(message,sticky=false){
  clearTimeout(feedbackTimer);$('#feedback').textContent=sticky?'':message;
  $('#element-error').hidden=!sticky;$('#element-error').textContent=sticky?message:'';
  for(const input of $$('.element-card input[type=number]'))input.removeAttribute('aria-invalid');
  if(sticky)$(`.element-card[data-key="${state.selected}"] input[type=number]`).setAttribute('aria-invalid','true');
  if(!sticky)feedbackTimer=setTimeout(()=>$('#feedback').textContent='',6000);
}
function pause(label='PAUSED · READY TO EXPLORE'){state.playing=false;$('#play-label').textContent='Play';$('#play .play-icon').innerHTML=playIcon;$('#play-state').textContent=label;}
function togglePlay(){
  if(state.playing){pause();return;}
  // Commit an unfinished numeric edit before advancing either visualization.
  document.activeElement?.blur();state.playing=true;$('#play-label').textContent='Pause';$('#play .play-icon').innerHTML=pauseIcon;$('#play-state').textContent='PLAYING · KEPLERIAN MOTION';
}
function selectElement(key){
  state.selected=key;updateControls();updateConcept();rebuildScene();trackDirty=true;
}
function editElement(key,value){
  pause('PAUSED · ELEMENT EDITED');state.selected=key;
  const s=current(),o={...state.o,nu:s.nu},d=descriptor(key);
  if(d.disabled)return;
  if(key==='arg'&&isEquatorial(o))o.arg=mod(direction(o)*(value-o.raan));
  else if(key==='nu'&&isCircular(o))o.nu=mod(isEquatorial(o)?direction(o)*(value-o.raan)-o.arg:value-o.arg);
  else o[key]=value;
  // Validate before normalization: NaN must never be hidden by angle wrapping.
  let error=validateOrbit(o);
  if(['raan','arg','nu'].includes(key)&&(!Number.isFinite(value)||value<0||value>360))error='Enter an angle between 0° and 360°.';
  if(error){feedback(error,true);updateControls(true);return;}
  state.o=canonicalize(o);state.orbitEpoch=state.t;
  feedback('');$('#preset').classList.add('modified');
  updateControls(true);updateConcept();updateMetrics();rebuildScene();trackDirty=true;
  setTimelineBounds();
}
function updateConcept(){
  const d=descriptor(state.selected),circ=isCircular(state.o),eq=isEquatorial(state.o);
  $('#concept-symbol').textContent=d.symbol;$('#concept-title').textContent=d.title;$('#concept-tag').textContent=d.full.toUpperCase();$('#concept-text').textContent=d.text;
  $('#quarter-turns').hidden=state.selected!=='arg'||d.disabled||eq;
  $('#prompt-button').hidden=!$('#quarter-turns').hidden;
  const note=circ&&eq?'Circular + equatorial: Ω, ω and ν are undefined. Use true longitude ℓ.':circ?'Circular orbit: ω and ν are undefined. Use argument of latitude u.':eq?'Equatorial orbit: Ω and ω are undefined. Use longitude of perigee Π.':'';
  $('#alternate-note').hidden=!note;$('#alternate-note').textContent=note;
  $('#guide-element-title').textContent=d.symbol+' · '+d.full;$('#guide-element-text').textContent=d.text;$('#guide-element-note').textContent=note;
  $('#guide-prompt').textContent=PRESETS[state.preset].prompt;
}
function updateMetrics(){
  const o=state.o,P=period(o.a);
  $('#stat-period').innerHTML=P>=36000?`${number(P/3600,2)} <small>h</small>`:`${number(P/60,1)} <small>min</small>`;
  $('#stat-perigee').innerHTML=`${number(o.a*(1-o.e)-EARTH_RADIUS)} <small>km</small>`;
  $('#stat-apogee').innerHTML=`${number(o.a*(1+o.e)-EARTH_RADIUS)} <small>km</small>`;
  $('#stat-maxlat').innerHTML=`±${number(maxLatitude(o.i),1)}<small>°</small>`;
  $('#earth-turn').textContent=number(state.rotating?EARTH_RATE*P/DEG:0,2)+'°';
}
function rebuildScene(fit=false){scene.setOrbit({...state.o,nu:current().nu},state.selected,state.options,fit);}
function setTimelineBounds(){
  const P=period(state.o.a),range=$('#time');
  range.min=Math.floor(Math.min(-P,Math.floor(state.t/P)*P-P));range.max=Math.ceil(Math.max(P*2,Math.ceil(state.t/P)*P+P));
  $('#time-min').textContent=`${number(Number(range.min)/P,0)} orbits`;$('#time-max').textContent=`+${number(Number(range.max)/P,0)} orbits`;
}
function loadPreset(key){
  state.o=canonicalize({...PRESETS[key]});state.preset=key;state.t=0;state.orbitEpoch=0;state.earthEpoch=0;state.earthPhase=0;state.rotating=true;
  $('#preset').value=key;$('#preset').classList.remove('modified');pause();
  $('#rotation').setAttribute('aria-pressed','true');$('#rotation span:last-child').textContent='Earth rotates';$('#rotation-notice').hidden=true;
  state.selected=isCircular(state.o)?'nu':'a';$('#camera').value='oblique';scene.view='oblique';
  updateControls(true);updateConcept();updateMetrics();setTimelineBounds();rebuildScene(true);trackDirty=true;
  feedback(PRESETS[key].prompt);
}

// Static cartography is embedded and uses the same longitude convention as Earth.
function buildMap(){
  const land=$('#land');
  for(const feature of landData.features){
    const polygons=feature.geometry.type==='Polygon'?[feature.geometry.coordinates]:feature.geometry.coordinates;
    for(const polygon of polygons){const d=polygon.map(ring=>ring.map(([lon,lat],j)=>`${j?'L':'M'}${mapX(lon).toFixed(2)},${mapY(lat).toFixed(2)}`).join('')+'Z').join('');svg('path',{d,class:'land-path','fill-rule':'evenodd'},land);}
  }
  const grid=$('#graticule'),labels=$('#map-axis-labels');
  for(let lon=-180;lon<=180;lon+=30){svg('line',{x1:mapX(lon),x2:mapX(lon),y1:32,y2:532,class:'graticule-line'},grid);if(lon%60===0){const t=svg('text',{x:mapX(lon),y:563,class:'map-axis-label'},labels);t.textContent=lon===0?'0°':`${Math.abs(lon)}°${lon<0?'W':'E'}`;}}
  for(let lat=-90;lat<=90;lat+=30){svg('line',{x1:40,x2:1040,y1:mapY(lat),y2:mapY(lat),class:'graticule-line'+(lat===0?' equator':'')},grid);const t=svg('text',{x:32,y:mapY(lat)+6,class:'map-axis-label lat'},labels);t.textContent=lat===0?'0°':`${Math.abs(lat)}°`;}
  // SVG typography otherwise becomes unreadably small when the map is letterboxed.
  const map=$('#ground-map');
  new ResizeObserver(()=>{
    const scale=Math.min(map.clientWidth/1170,map.clientHeight/620);
    if(scale<=0)return;
    mapScale=scale;
    const size=clamp((innerWidth>=1700?18:14)/scale,24,53);
    map.style.setProperty('--map-label-size',size+'px');map.style.setProperty('--map-lat-size',size*.9+'px');
    for(const label of $$('#map-axis-labels .map-axis-label:not(.lat)'))label.setAttribute('y',532+size*1.25);
    $('#ground-point .point-center').setAttribute('r',5/scale);
    $('#ground-point .point-ring').setAttribute('r',10/scale);
    $('#ground-point circle:first-child').setAttribute('r',21/scale);
    for(const node of $$('.map-node'))node.setAttribute('r',4/scale);
    trackDirty=true;
  }).observe(map);
}
function renderTrack(){
  const snapshot={...state.o,nu:current().nu},angle=earthAngle();
  const points=sampleGroundTrack(snapshot,angle,state.rotating,state.span);
  const past=points.filter(p=>p.t<=0),future=points.filter(p=>p.t>=0);
  // Ensure both styles meet exactly at the current sub-satellite point.
  const now={...groundPoint(current().position,angle),t:0};
  if(!past.length||past.at(-1).t<0)past.push(now);
  if(!future.length||future[0].t>0)future.unshift(now);
  $('#track-past').setAttribute('d',pathFor(past));$('#track-future').setAttribute('d',pathFor(future));
  const guides=$('#latitude-guides');guides.replaceChildren();
  if(state.selected==='i')for(const lat of [-maxLatitude(state.o.i),maxLatitude(state.o.i)])svg('line',{x1:40,x2:1040,y1:mapY(lat),y2:mapY(lat),class:'latitude-guide'},guides);
  const nodes=$('#map-nodes');nodes.replaceChildren();
  if(!isEquatorial(state.o)&&(state.options.markers||state.selected==='raan')){
    const o=snapshot,target=meanFromTrue(mod(-o.arg),o.e),M=meanFromTrue(o.nu,o.e),dt=mod(target-M,TAU)/meanMotion(o.a),P=period(o.a);
    for(let j=0;j<2;j++){
      const t=dt+j*P,g=groundPoint(stateAt(o,t).position,angle+(state.rotating?EARTH_RATE:0)*t);
      if(g.lon===null)continue;
      svg('circle',{cx:mapX(g.lon),cy:mapY(g.lat),r:4/mapScale,class:'map-node'},nodes);
      const text=svg('text',{x:mapX(g.lon)+10,y:mapY(g.lat)-11,class:'map-node-label'},nodes);text.textContent=`AN${j+1}`;
    }
  }
  const arrows=$('#track-arrows');arrows.replaceChildren();
  const step=Math.max(20,Math.floor(points.length/9));
  for(let j=step;j<points.length-1;j+=step){
    const a=points[j],b=points[j+1];if(a.lon===null||b.lon===null||Math.abs(a.lon-b.lon)>30||Math.abs(a.lat)>86)continue;
    const dx=mapX(b.lon)-mapX(a.lon),dy=mapY(b.lat)-mapY(a.lat);if(Math.hypot(dx,dy)<.01)continue;
    const g=svg('path',{d:'M-7,-4 L0,0 L-7,4',fill:'none',stroke:'var(--accent)','stroke-width':2.3,opacity:.8,transform:`translate(${mapX(a.lon)},${mapY(a.lat)}) rotate(${Math.atan2(dy,dx)/DEG}) scale(${Math.max(1,.8/mapScale)})`},arrows);
  }
  trackDirty=false;
}
function formatTime(t){const seconds=Math.floor(Math.abs(t));return `T ${t<0?'−':'+'} ${String(Math.floor(seconds/3600)).padStart(2,'0')}:${String(Math.floor(seconds/60)%60).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;}
function renderCurrent(){
  const s=current(),angle=earthAngle(),g=groundPoint(s.position,angle);
  if(lastDisplayedTime!==state.t||lastDisplayedOrbit!==state.o||lastDisplayedEarth!==angle){
    $('#stat-lat').innerHTML=`${number(Math.abs(g.lat),1)}<small>°${g.lat<-.0001?'S':'N'}</small>`;
    $('#stat-lon').innerHTML=g.lon===null?'At pole':`${number(Math.abs(g.lon),1)}<small>°${g.lon<0?'W':'E'}</small>`;
    const point=$('#ground-point');point.style.display=g.lon===null?'none':'';if(g.lon!==null)point.setAttribute('transform',`translate(${mapX(g.lon)},${mapY(g.lat)})`);
    $('#elapsed').textContent=formatTime(state.t);
    if(document.activeElement!==$('#time'))$('#time').value=state.t;
    lastDisplayedTime=state.t;lastDisplayedOrbit=state.o;lastDisplayedEarth=angle;
  }
  scene.render(s,angle);
}

$('#play').addEventListener('click',togglePlay);
$('#reset-time').addEventListener('click',()=>{pause('PAUSED · TIME RESET');state.t=0;trackDirty=true;updateControls();setTimelineBounds();});
$('#reset-scenario').addEventListener('click',()=>loadPreset(state.preset));
$('#preset').addEventListener('change',e=>loadPreset(e.target.value));
$('#speed').addEventListener('change',e=>state.speed=Number(e.target.value));
$('#time').addEventListener('input',e=>{pause('PAUSED · SCRUBBING TIME');state.t=Number(e.target.value);trackDirty=true;updateControls();scene.updateAngle(current().nu);});
$('#rotation').addEventListener('click',()=>{
  const phase=earthAngle();state.earthPhase=phase;state.earthEpoch=state.t;state.rotating=!state.rotating;
  $('#rotation').setAttribute('aria-pressed',String(state.rotating));$('#rotation span:last-child').textContent=state.rotating?'Earth rotates':'Rotation off';$('#rotation-notice').hidden=state.rotating;
  trackDirty=true;updateMetrics();feedback(state.rotating?'Earth rotation restored.':'Earth is fixed; the spacecraft continues around its inertial orbit.');
});
$('#track-span').addEventListener('change',e=>{state.span=Number(e.target.value);trackDirty=true;});
$('#camera').addEventListener('change',e=>scene.setView(e.target.value));
for(const key of Object.keys(state.options))$('#overlay-'+key).addEventListener('change',e=>{state.options[key]=e.target.checked;rebuildScene();trackDirty=true;});
$('#orbit-canvas').addEventListener('camera-interaction',()=>$('#camera').title='Custom camera · choose a viewpoint to reset');
for(const button of $$('#quarter-turns button'))button.addEventListener('click',()=>editElement('arg',Number(button.dataset.angle)));
function setLayout(layout){
  state.layout=layout;$('#workspace').dataset.layout=layout;
  for(const b of $$('.view-button')){b.classList.toggle('active',b.dataset.layout===layout);b.setAttribute('aria-pressed',String(b.dataset.layout===layout));}
  if(layout==='both')$('#workspace').style.setProperty('--split','52%');
  else $('#workspace').style.removeProperty('--split');
  $('#splitter').setAttribute('aria-valuenow',layout==='orbit'?'72':layout==='map'?'28':'52');
  requestAnimationFrame(()=>{scene.resize();scene.setView(scene.view);});
}
for(const button of $$('.view-button'))button.addEventListener('click',()=>setLayout(button.dataset.layout));
const splitter=$('#splitter');let dragging=false;
function resizeSplit(percent){
  percent=clamp(percent,30,70);state.layout='both';$('#workspace').dataset.layout='both';$('#workspace').style.setProperty('--split',percent+'%');splitter.setAttribute('aria-valuenow',Math.round(percent));
  for(const b of $$('.view-button')){b.classList.toggle('active',b.dataset.layout==='both');b.setAttribute('aria-pressed',String(b.dataset.layout==='both'));}
}
splitter.addEventListener('pointerdown',e=>{dragging=true;splitter.setPointerCapture(e.pointerId);});
splitter.addEventListener('pointermove',e=>{if(dragging){const r=$('#workspace').getBoundingClientRect();resizeSplit((e.clientX-r.left)/r.width*100);}});
splitter.addEventListener('pointerup',()=>{dragging=false;scene.resize();});
splitter.addEventListener('pointercancel',()=>dragging=false);
splitter.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home'].includes(e.key)){e.preventDefault();const n=Number(splitter.getAttribute('aria-valuenow'));resizeSplit(e.key==='Home'?52:n+(e.key==='ArrowLeft'?-2:2));}});
$('#theme').addEventListener('click',()=>{
  const day=document.documentElement.dataset.theme!=='day',theme=day?'day':'night';document.documentElement.dataset.theme=theme;scene.setTheme(theme);$('#theme .action-text').textContent=day?'Night':'Projector';$('#theme').title=day?'Switch to the night theme':'Switch to a bright projector theme';rebuildScene();
});
$('#fullscreen').addEventListener('click',async()=>{
  try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}
  catch{feedback('Fullscreen is unavailable here. Use your browser’s fullscreen command.');}
});
document.addEventListener('fullscreenchange',()=>$('#fullscreen').setAttribute('aria-label',document.fullscreenElement?'Exit fullscreen':'Enter fullscreen'));
const dialog=$('#guide-dialog');
for(const id of ['help','model-info','prompt-button','explain-element'])$('#'+id).addEventListener('click',()=>{dialog.showModal();dialog.scrollTop=0;});
$('#close-guide').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
document.addEventListener('keydown',e=>{if(e.code==='Space'&&!dialog.open&&!['INPUT','BUTTON','SELECT','SUMMARY','TEXTAREA'].includes(document.activeElement?.tagName)){e.preventDefault();togglePlay();}});
document.addEventListener('pointerdown',e=>{for(const d of $$('details.overlay-menu[open]'))if(!d.contains(e.target))d.open=false;});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.playing)pause('PAUSED · TAB WAS HIDDEN');});

function updateControlMode(){
  const compact=innerWidth>800&&(compactOverride??compactQuery.matches);
  document.body.classList.toggle('compact-controls',compact);
  const button=$('#controls-toggle');button.textContent=compact?'Full controls':'Larger views';
  button.setAttribute('aria-pressed',String(compact));
  button.title=compact?'Show all element editors. The views retain their minimum size.':'Use compact controls to give the visualizations more room';
}
$('#controls-toggle').addEventListener('click',()=>{
  compactOverride=!document.body.classList.contains('compact-controls');
  updateControlMode();if(compactOverride)window.scrollTo(0,0);
});
window.addEventListener('resize',updateControlMode);

updateControlMode();buildMap();makeControls();updateConcept();updateMetrics();setTimelineBounds();rebuildScene(true);renderTrack();renderCurrent();$('#play .play-icon').innerHTML=playIcon;
let previous=performance.now();
function animate(now){
  const dt=Math.max((now-previous)/1000,0);previous=now;
  if(state.playing){
    state.t+=dt*state.speed;
    if(state.t>Number($('#time').max))setTimelineBounds();
    if(now-lastTrackUpdate>180)trackDirty=true;
    if(now-lastAngleUpdate>180){updateControls();if(state.selected==='nu')scene.updateAngle(current().nu);lastAngleUpdate=now;}
  }
  if(trackDirty&&now-lastTrackUpdate>90){renderTrack();lastTrackUpdate=now;}
  renderCurrent();requestAnimationFrame(animate);
}
requestAnimationFrame(animate);

// A read-only diagnostic snapshot supports numerical/browser validation without UI internals.
Object.defineProperty(window,'orbitExplorer',{value:Object.freeze({snapshot:()=>({orbit:{...state.o},time:state.t,orbitEpoch:state.orbitEpoch,earthAngle:earthAngle(),rotating:state.rotating,playing:state.playing,state:current(),ground:groundPoint(current().position,earthAngle()),period:period(state.o.a),webgl:!scene.error}),constants:Object.freeze({MU,EARTH_RADIUS,SIDEREAL_DAY})})});

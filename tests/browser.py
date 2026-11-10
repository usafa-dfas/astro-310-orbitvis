"""Functional checks of the built HTML. Requires Python Playwright and Chromium.
Runs a temporary loopback server; all external browser requests are rejected.
"""
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from threading import Thread
import json
import math
import os
import shutil
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
RESULTS = ROOT / 'test-results'
RESULTS.mkdir(exist_ok=True)
class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *args): pass

server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Handler, directory=str(ROOT)))
Thread(target=server.serve_forever, daemon=True).start()
url = f'http://127.0.0.1:{server.server_port}/'
checks = []
def check(condition, name):
    assert condition, name
    checks.append(name)
    print('PASS', name, flush=True)
def near(a, b, tolerance=1e-6): return abs(a-b) < tolerance

try:
    with sync_playwright() as p:
        executable=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or shutil.which('google-chrome')
        browser=p.chromium.launch(executable_path=executable, headless=True,
            args=['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        context=browser.new_context(viewport={'width':1920, 'height':1080}, device_scale_factor=1)
        unexpected=[]
        def route_request(route):
            if route.request.url.startswith(url) or route.request.url.startswith('data:'):
                route.continue_()
            else:
                unexpected.append(route.request.url)
                route.abort()
        context.route('**/*', route_request)
        page=context.new_page()
        errors=[]
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto(url, wait_until='networkidle')
        page.wait_for_function('window.orbitExplorer !== undefined')
        snapshot=lambda: page.evaluate('window.orbitExplorer.snapshot()')
        set_time=lambda value: page.locator('#time').evaluate('(el,value)=>{el.value=value;el.dispatchEvent(new Event("input",{bubbles:true}));}', value)
        def edit(key,value):
            page.locator(f'.element-card[data-key="{key}"] button').click()
            field=page.locator(f'.element-card[data-key="{key}"] input[type="number"]')
            field.fill(str(value));field.press('Enter')
        def preset(key):
            page.locator('#preset').select_option(key)
            page.wait_for_timeout(200)
        def clean_layout():
            return page.evaluate('document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight')
        def callout_report():
            script='''() => {
              const scene=document.querySelector('.orbit-canvas'),area=scene.getBoundingClientRect();
              const labels=[...document.querySelectorAll('#scene-labels .scene-label')]
                .filter(el=>getComputedStyle(el).display!=='none');
              const paths=[...document.querySelectorAll('.label-leaders path')];
              let outside=true,connected=true,inside=true;
              const boxes=labels.map(el=>el.getBoundingClientRect());
              labels.forEach((label,i)=>{
                const b=boxes[i],feature=label.dataset.feature;
                // This central drawing strip is independent of the layout's own
                // geometry bounds, and catches the former over-the-globe tags.
                outside &&= b.right-area.left<=area.width*.3 || b.left-area.left>=area.width*.7;
                inside &&= b.left>=area.left-1 && b.right<=area.right+1 && b.top>=area.top-1 && b.bottom<=area.bottom+1;
                const path=paths.find(p=>p.dataset.feature===feature);
                const dot=[...document.querySelectorAll('.label-leaders circle')].find(p=>p.dataset.feature===feature);
                if(!path||!dot){connected=false;return;}
                const values=path.getAttribute('d').match(/-?\\d+(?:\\.\\d+)?/g).map(Number);
                const edge=label.dataset.dock==='left'?b.right-area.left:b.left-area.left;
                connected &&= Math.abs(values[0]-edge)<1.5 && Math.abs(values[1]-(b.top+b.height/2-area.top))<1.5;
                connected &&= Math.abs(values.at(-2)-Number(dot.getAttribute('cx')))<.02 && Math.abs(values.at(-1)-Number(dot.getAttribute('cy')))<.02;
                connected &&= parseFloat(getComputedStyle(path).strokeWidth)<=1.2;
              });
              const overlaps=boxes.some((a,i)=>boxes.slice(i+1).some(b=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top));
              return {count:labels.length,outside,connected,inside,overlaps,paths:paths.length};
            }'''
            # Resizing the pane updates CSS before the renderer's next frame.
            # Wait for the actual callouts, rather than an arbitrary delay that
            # can sample the old frame under software WebGL.
            page.wait_for_function(f'()=>{{const r=({script})();return r.count>=2&&r.outside&&r.connected&&r.inside&&!r.overlaps;}}')
            return page.evaluate(script)

        check(snapshot()['webgl'], 'real WebGL 3D initialized')
        check(not snapshot()['playing'], 'starts paused on teaching ellipse')
        check(clean_layout(), '1920×1080 layout fits without scrolling')
        check(page.locator('#track-past').get_attribute('d').startswith('M'), 'past ground track is drawn')
        check(page.locator('#track-future').get_attribute('d').startswith('M'), 'predicted ground track is drawn')
        ground=snapshot()['ground']
        point=page.locator('#ground-point').get_attribute('transform')
        check(str(40+(ground['lon']+180)/360*1000)[:8] in point, 'map marker follows computed ground longitude')
        page.screenshot(path=str(RESULTS/'orbit-explorer-1920.png'))

        page.locator('.element-card[data-key="i"] button').click()
        page.wait_for_function("document.querySelectorAll('.latitude-guide').length === 2")
        check(page.locator('.latitude-guide').count()==2, 'inclination selection reveals latitude limits')
        callouts=callout_report()
        check(callouts['count']>=4 and callouts['outside'], 'inertial labels stay in outer columns away from the animated drawing')
        check(callouts['connected'] and callouts['paths']==callouts['count'], 'every visible label has a thin leader line attached to its feature')
        check(callouts['inside'] and not callouts['overlaps'], 'callouts stay inside the canvas without overlapping one another')
        for viewpoint in ['north','equator','plane']:
            page.locator('#camera').select_option(viewpoint);page.wait_for_timeout(180)
            report=callout_report()
            check(report['count']>=2 and report['outside'] and report['connected'] and not report['overlaps'], f'callouts remain clear and connected in the {viewpoint} camera view')
        page.locator('#camera').select_option('plane');page.wait_for_timeout(100)
        target=page.locator('.label-leaders circle[data-feature="Spacecraft"]')
        page.wait_for_function('document.querySelector(\'.label-leaders circle[data-feature="Spacecraft"]\') !== null')
        before=(float(target.get_attribute('cx')),float(target.get_attribute('cy')))
        page.locator('#play').click();page.wait_for_timeout(450);page.locator('#play').click()
        after=(float(target.get_attribute('cx')),float(target.get_attribute('cy')))
        report=callout_report()
        check(math.hypot(after[0]-before[0],after[1]-before[1])>1 and report['connected'] and report['outside'], 'spacecraft leader follows playback while its label stays off the orbit')
        page.locator('#reset-scenario').click()
        page.locator('.element-card[data-key="i"] button').click()
        edit('i',120)
        check(near(snapshot()['orbit']['i'],120), 'numeric element edit updates orbit')
        check('60.0' in page.locator('#stat-maxlat').inner_text(), 'retrograde latitude limit is 60°')
        check('RETROGRADE' in page.locator('#orbit-class').inner_text(), 'retrograde classification is visible')
        old=snapshot()['orbit']['e'];edit('e',.9)
        check(snapshot()['orbit']['e']==old and 'between 0 and 0.85' in page.locator('#element-error').inner_text(), 'invalid eccentricity rejected with explanation')
        edit('a',7000)
        check(snapshot()['orbit']['a']==12000 and 'enters Earth' in page.locator('#element-error').inner_text(), 'Earth-intersecting combination rejected')

        preset('leo')
        check(page.get_by_role('spinbutton',name='Argument of latitude',exact=True).is_visible(), 'circular inclined orbit exposes u')
        check(page.locator('.element-card[data-key="arg"] input[type="number"]').is_disabled(), 'circular orbit does not invent argument of perigee')
        set_time(1234)
        before=snapshot();edit('a',9000);after=snapshot()
        check(near(before['state']['nu'],after['state']['nu']), 'size edit at nonzero time preserves current location angle')
        check(near(before['earthAngle'],after['earthAngle']), 'orbit editing preserves current Earth orientation')
        check(near(after['time'],1234), 'orbit editing preserves simulation instant')

        phase=snapshot()['earthAngle'];page.locator('#rotation').click();set_time(1834)
        check(not snapshot()['rotating'] and near(snapshot()['earthAngle'],phase), 'rotation-off freezes Earth while scrubbing orbital time')
        check(page.locator('#rotation-notice').is_visible(), 'nonrotating teaching model is labeled')
        before=snapshot();page.locator('#rotation').click();after=snapshot()
        check(near(before['earthAngle'],after['earthAngle']), 'resuming rotation has no Earth phase jump')
        set_time(2434)
        check(near(snapshot()['earthAngle']-phase,600*2*math.pi/86164.0905), 'rotation resumes at sidereal rate')

        preset('geo')
        check(page.get_by_role('spinbutton',name='True longitude',exact=True).is_visible(), 'circular equatorial orbit exposes true longitude')
        check(page.locator('.element-card[data-key="raan"] input[type="number"]').is_disabled(), 'equatorial orbit does not invent RAAN')
        start=snapshot()['ground'];set_time(86164)
        end=snapshot()['ground']
        check(near(start['lat'],end['lat']) and near(start['lon'],end['lon']), 'geostationary map point stays fixed through a sidereal day')
        page.screenshot(path=str(RESULTS/'geostationary.png'))

        preset('teaching');edit('i',0)
        check(page.get_by_role('spinbutton',name='Longitude of perigee',exact=True).is_visible(), 'eccentric equatorial orbit exposes longitude of perigee')
        edit('i',180);edit('arg',40);edit('nu',10)
        check(near(snapshot()['ground']['lon'],30,1e-5), 'retrograde equatorial Π and ν use correct direction')

        preset('lesson10')
        s=snapshot()['state']
        check(near(s['position'][0],9000,.01) and near(s['velocity'][2],-7,.00001), 'lesson 10 inspection example reproduced')
        for key in ['teaching','leo','polar','retro','geo','sync','lesson11a','lesson11b','lesson10']:
            preset(key)
            check(math.isfinite(snapshot()['state']['r']), f'{key} preset produces finite state')
        preset('polar');set_time(snapshot()['period']/4)
        check('NaN' not in page.locator('#track-past').get_attribute('d'), 'polar map paths contain no NaNs')

        preset('teaching');page.locator('#play').click();page.wait_for_timeout(750)
        check(snapshot()['playing'] and snapshot()['time']>0, 'playback advances the shared simulation clock')
        page.locator('#play').click();paused=snapshot()['time'];page.wait_for_timeout(150)
        check(near(paused,snapshot()['time']), 'pause stops simulation time')
        page.locator('#reset-time').click()
        check(snapshot()['time']==0, 'reset time returns to time zero')

        page.locator('#theme').click()
        check(page.locator('html').get_attribute('data-theme')=='day', 'bright projector theme switches correctly')
        page.screenshot(path=str(RESULTS/'projector-theme-1920.png'))
        page.locator('#theme').click()
        for layout in ['orbit','map','both']:
            page.locator(f'[data-layout="{layout}"].view-button').click()
            check(clean_layout(), f'{layout} panel layout fits display')
        page.locator('#splitter').focus();page.keyboard.press('ArrowLeft')
        check(page.locator('#splitter').get_attribute('aria-valuenow')=='50', 'divider can be resized with keyboard')
        page.locator('[data-layout="both"].view-button').click()
        page.locator('#camera').select_option('north')
        page.locator('#camera').select_option('plane')
        page.locator('#reset-scenario').click()
        check(page.locator('#camera').input_value()=='oblique' and snapshot()['time']==0, 'scenario reset restores camera and time')
        page.locator('#help').click()
        check(page.locator('#guide-dialog').is_visible(), 'teaching guide opens')
        page.keyboard.press('Escape')
        check(not page.locator('#guide-dialog').is_visible(), 'Escape closes teaching guide')

        page.set_viewport_size({'width':1280,'height':720});page.wait_for_timeout(500)
        check(clean_layout(), '1280×720 layout fits without scrolling')
        check(page.locator('#controls-pane').is_visible(), 'COE sliders are grouped in the left pane')
        page.screenshot(path=str(RESULTS/'orbit-explorer-1280.png'))

        # Match the instructor's annotated large screenshot. The visualizations
        # should use most of the available height, with controls beside them.
        page.set_viewport_size({'width':1718,'height':975});page.wait_for_timeout(250)
        preset('teaching');edit('i',34);edit('raan',0);edit('arg',75);edit('nu',19.8)
        page.locator('.element-card[data-key="i"] button').click()
        geometry=page.evaluate('''()=>{
          const box=s=>document.querySelector(s).getBoundingClientRect().toJSON();
          return {pane:box('#controls-pane'),workspace:box('.workspace'),canvas:box('.orbit-canvas'),world:box('.ocean'),
            headings:[...document.querySelectorAll('.panel-heading')].map(e=>e.getBoundingClientRect().height),
            stats:[...document.querySelectorAll('.panel-stats')].map(e=>e.getBoundingClientRect().height)};
        }''')
        check(clean_layout(), 'annotated 1718×975 layout fits the screen')
        check(geometry['pane']['right']<=geometry['workspace']['left'] and geometry['pane']['height']>700, 'COE pane sits beside the animations instead of below them')
        check(geometry['canvas']['height']>=650, 'inertial drawing uses at least 650 px of height at the annotated viewport')
        check(geometry['world']['width']>=540 and geometry['world']['height']>=270, 'ground map grows to at least 540×270 px at the annotated viewport')
        check(max(geometry['headings'])<=62 and max(geometry['stats'])<=52, 'single-line headings and readouts leave the height for the animations')
        page.screenshot(path=str(RESULTS/'sidebar-1718.png'))
        page.locator('#theme').click();page.screenshot(path=str(RESULTS/'sidebar-projector-1718.png'));page.locator('#theme').click()

        # Reproduce the instructor's screenshot. Checking only page overflow
        # misses the original failure: both drawing areas fit but were tiny.
        page.set_viewport_size({'width':931,'height':650})
        preset('teaching');page.locator('#theme').click()
        edit('e',0);edit('i',81);set_time(2814);edit('nu',166.9)
        page.locator('.element-card[data-key="i"] button').click()
        if page.locator('#controls-toggle').get_attribute('aria-expanded')=='true':
            page.locator('#controls-toggle').click()
        page.wait_for_timeout(300)
        dimensions=lambda: page.evaluate("({orbit:document.querySelector('.orbit-canvas').clientHeight,map:document.querySelector('#ground-map').clientHeight,world:document.querySelector('.ocean').getBoundingClientRect().toJSON()})")
        dims=dimensions()
        check(clean_layout(), '931×650 projector layout fits without scrolling')
        check(dims['orbit']>=380, 'projector 3D drawing area remains at least 380 px tall')
        check(dims['world']['width']>=300 and dims['world']['height']>=150, 'projector world map remains large enough to read')
        check(page.locator('.element-summary:visible').count()==6, 'collapsed sidebar retains all six element values')
        check(page.locator('.element-card input[type="number"]:visible').count()==0, 'collapsed pane gives its width back to the animations')
        report=callout_report()
        check(report['count']>=3 and report['outside'] and report['connected'], 'projector labels stay off the orbit and keep their leader lines')
        page.screenshot(path=str(RESULTS/'projector-after-931.png'))

        snapshot_before=snapshot()
        page.locator('.element-card[data-key="i"] button').click()
        check(page.locator('#controls-toggle').get_attribute('aria-expanded')=='true', 'selecting an element reopens the left pane')
        check(page.get_by_role('spinbutton',name='Inclination',exact=True).is_visible(), 'selected element is directly editable in the left pane')
        check(page.locator('.element-card input[type="range"]').count()==6, 'all six sliders remain in the pane')
        check(dimensions()['orbit']>=380, 'opening controls preserves animation height')
        page.locator('#explain-element').click()
        check('Inclination' in page.locator('#guide-element-title').inner_text(), 'Explain preserves the selected concept in a readable dialog')
        check('latitude limit' in page.locator('#guide-element-text').inner_text(), 'sidebar layout keeps the full teaching explanation available')
        page.keyboard.press('Escape')
        page.locator('#controls-toggle').click()
        check(page.locator('body').evaluate("el=>el.classList.contains('controls-collapsed')"), 'chevron collapses the controls back to the value rail')
        check(clean_layout(), 'collapsed control pane keeps a complete projector layout')
        check(snapshot()['orbit']==snapshot_before['orbit'] and snapshot()['time']==snapshot_before['time'], 'changing control layout preserves orbit and simulation time')

        page.locator('details.overlay-menu summary').click()
        for overlay in ['axes','markers','vectors']:
            page.locator('#overlay-'+overlay).check()
        page.locator('.element-card[data-key="i"] button').click()
        page.locator('#controls-toggle').click()
        page.wait_for_timeout(200)
        boxes=page.locator('#scene-labels .scene-label:visible').evaluate_all('(els)=>els.map(e=>e.getBoundingClientRect().toJSON())')
        overlaps=any(a['left']<b['right'] and a['right']>b['left'] and a['top']<b['bottom'] and a['bottom']>b['top'] for i,a in enumerate(boxes) for b in boxes[i+1:])
        check(len(boxes)>2 and not overlaps, '3D labels stay separated even with all geometry overlays enabled')
        report=callout_report()
        check(report['outside'] and report['connected'] and report['inside'], 'all-geometry callouts stay outside the drawing on the small projector layout')
        page.screenshot(path=str(RESULTS/'projector-all-geometry-931.png'))
        for width,height in [(1024,768),(960,600)]:
            page.set_viewport_size({'width':width,'height':height});page.wait_for_timeout(150)
            check(dimensions()['orbit']>=240, f'{width}×{height} viewport protects drawing height instead of shrinking the views')
            check(page.evaluate('document.documentElement.scrollWidth <= innerWidth'), f'{width}×{height} viewport has no horizontal overflow')

        page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(250)
        check(page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'narrow-screen layout has no horizontal overflow')
        page.screenshot(path=str(RESULTS/'narrow-screen.png'),full_page=True)

        # Run the exact deliverable with the browser offline. No server, CDN,
        # map tiles, texture downloads, or font requests may be needed.
        offline=browser.new_context(offline=True,viewport={'width':1280,'height':720})
        offline_page=offline.new_page();offline_errors=[]
        offline_page.on('pageerror',lambda e:offline_errors.append(str(e)))
        offline_page.set_content((ROOT/'index.html').read_text(),wait_until='load')
        offline_page.wait_for_function('window.orbitExplorer !== undefined')
        check(offline_page.evaluate('window.orbitExplorer.snapshot().webgl') and not offline_errors, 'exact HTML initializes 3D and controls with browser offline')
        offline_page.locator('#preset').select_option('geo')
        check(near(offline_page.evaluate('window.orbitExplorer.snapshot().period'),86164.0905), 'offline preset computation works')
        offline.close()

        fallback=browser.new_page(viewport={'width':1280,'height':720})
        fallback.add_init_script("const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(kind,...args){if(kind.startsWith('webgl'))return null;return get.call(this,kind,...args)}")
        fallback.goto(url,wait_until='networkidle')
        check(fallback.locator('#webgl-error').is_visible(), 'WebGL-unavailable explanation appears')
        check(fallback.evaluate('window.orbitExplorer.snapshot().webgl === false'), 'fallback keeps the app initialized')
        fallback.locator('#preset').select_option('polar')
        check(fallback.locator('#track-future').get_attribute('d').startswith('M'), 'ground-track controls still work without WebGL')

        check(not errors, 'no JavaScript errors during interactions')
        check(not unexpected, 'no external browser network requests')
        report={'passed':len(checks),'checks':checks,'browser_errors':errors,'unexpected_requests':unexpected}
        (RESULTS/'browser-results.json').write_text(json.dumps(report,indent=2))
        browser.close()
finally:
    server.shutdown()
print(f'\n{len(checks)} browser checks passed. Screenshots: {RESULTS}')

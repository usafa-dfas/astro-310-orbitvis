"""Measure callout crossings, proximity, geometry clearance and motion in real WebGL."""
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from threading import Thread
from pathlib import Path
import json
import os
import shutil
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
RESULTS=ROOT/'test-results'/'labels'
RESULTS.mkdir(parents=True,exist_ok=True)
class Handler(SimpleHTTPRequestHandler):
    def log_message(self,*args): pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Handler,directory=str(ROOT)))
Thread(target=server.serve_forever,daemon=True).start()
reports=[]
try:
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium'),
            args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        page=browser.new_page(viewport={'width':1920,'height':1080});errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(f'http://127.0.0.1:{server.server_port}/',wait_until='networkidle')
        page.wait_for_function('window.orbitExplorer')
        script=(ROOT/'tests/callouts.js').read_text()
        def report(case):
            # Wait for render completion after camera or layout changes.
            page.wait_for_function('''() => {
                const c=orbitExplorer.snapshot().camera,el=document.querySelector('.orbit-canvas');
                return c.labelsReady&&c.width===el.clientWidth&&c.height===el.clientHeight;
            }''')
            result=page.evaluate(script);reports.append({'case':case,**result})
            assert result['count']>=2 and result['clear'] and result['inside'] and result['connected'] and not result['overlaps'] and not result['throughLabels'], (case,result)
            print(case,json.dumps(result),flush=True)
            return result
        for width,height in [(1920,1080),(1718,975),(931,650)]:
            page.set_viewport_size({'width':width,'height':height})
            for element in ['raan','i','a','e','arg','nu']:
                page.locator('#preset').select_option('teaching')
                page.locator(f'.element-card[data-key="{element}"] button').click()
                if width<1000 and page.locator('#controls-toggle').get_attribute('aria-expanded')=='true':page.locator('#controls-toggle').click()
                for view in ['oblique','north','equator','plane']:
                    page.locator('#camera').select_option(view);page.wait_for_timeout(180)
                    case=f'{width}-{element}-{view}'
                    r=report(case)
                    assert r['crossings']==0,(case,r)
                    if view=='oblique' and element=='raan':
                        assert r['count']>=6 and r['meanLength']<100 and r['maxLength']<180,(case,r)
                        page.locator('#orbit-canvas').screenshot(path=str(RESULTS/(case+'.png')))
                # Inspect successive playback frames, not just the paused layout.
                page.locator('#camera').select_option('oblique');page.locator('#play').click()
                for frame in range(3):
                    page.wait_for_timeout(180);r=report(f'{width}-{element}-playing-{frame}')
                    assert r['crossings']==0,(element,frame,r)
                page.locator('#play').click()
            page.locator('details.overlay-menu summary').click()
            page.locator('#geometry-mode').select_option('all')
            page.locator('details.overlay-menu summary').click()
            page.locator('#fit-view').click();page.wait_for_timeout(180)
            report(f'{width}-all-geometry')
            page.locator('#orbit-canvas').screenshot(path=str(RESULTS/f'{width}-all-geometry.png'))
            page.locator('details.overlay-menu summary').click();page.locator('#geometry-mode').select_option('selected');page.locator('details.overlay-menu summary').click()
        assert not errors,errors
        (RESULTS/'results.json').write_text(json.dumps({'cases':len(reports),'reports':reports,'errors':errors},indent=2))
        browser.close()
finally:
    server.shutdown()
print(f'{len(reports)} label cases passed.')

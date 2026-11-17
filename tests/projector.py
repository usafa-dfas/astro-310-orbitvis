"""Classroom redesign checks: actual dimensions, interaction invariants and washout captures."""
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
RESULTS = ROOT / 'test-results' / 'projector'
RESULTS.mkdir(parents=True, exist_ok=True)
class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *args): pass
server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Handler, directory=str(ROOT)))
Thread(target=server.serve_forever, daemon=True).start()
checks, dimensions, errors = [], [], []
def check(condition, name):
    assert condition, name
    checks.append(name)
    print('PASS', name, flush=True)
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium'),
            args=['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        page = browser.new_page(viewport={'width':1920,'height':1080})
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto(f'http://127.0.0.1:{server.server_port}/', wait_until='networkidle')
        page.wait_for_function('window.orbitExplorer !== undefined')
        snapshot = lambda: page.evaluate('orbitExplorer.snapshot()')
        def edit_a(value):
            page.locator('.element-card[data-key="a"] button').click()
            field=page.get_by_role('spinbutton',name='Semi-major axis',exact=True)
            field.fill(str(value)); field.press('Enter')
        def geometry(mode):
            menu=page.locator('details.overlay-menu')
            if not menu.get_attribute('open'): menu.locator('summary').click()
            page.locator('#geometry-mode').select_option(mode)
            menu.locator('summary').click()
        # Fit is explicit: element edits preserve the camera scale and simulation instant.
        before=snapshot();edit_a(18000);after=snapshot()
        check(before['camera']['position']==after['camera']['position'] and before['camera']['target']==after['camera']['target'], 'size edits retain camera scale and target')
        check(after['camera']['orbitWidth']>before['camera']['orbitWidth']*1.2, 'increasing size visibly enlarges the orbit at a stable scale')
        page.locator('#fit-view').click();fitted=snapshot()
        check(fitted['camera']['position']!=after['camera']['position'] and fitted['time']==after['time'] and fitted['orbit']==after['orbit'], 'Fit view reframes without changing orbit or clock')
        for seconds in (30,60,120):
            page.locator('#speed').select_option(f'orbit:{seconds}')
            check(math.isclose(snapshot()['speed']*seconds,snapshot()['period']), f'teaching pace completes one orbit in {seconds} seconds')
        edit_a(22000)
        check(math.isclose(snapshot()['speed']*120,snapshot()['period']), 'teaching pace follows period changes')
        page.locator('#speed').select_option('300')
        check(snapshot()['speed']==300, 'explicit time multiplier is retained')
        page.locator('#preset').select_option('geo')
        page.locator('#speed').select_option('orbit:60')
        check(math.isclose(snapshot()['speed']*60,86164.0905), 'geostationary teaching pace uses the sidereal period')
        page.locator('#preset').select_option('teaching')
        page.locator('.element-card[data-key="i"] button').click()
        geometry('essential');page.wait_for_timeout(200)
        check(page.locator('.latitude-guide').count()==0, 'Essential hides selected geometry')
        geometry('selected');page.wait_for_timeout(200)
        check(page.locator('.latitude-guide').count()==2, 'Selected element emphasizes inclination latitude limits')
        geometry('all')
        check(all(snapshot()['geometry'].values()), 'All geometry enables every reference overlay')
        geometry('selected')
        for width,height in [(1920,1080),(1280,720),(1024,768),(931,650)]:
            page.set_viewport_size({'width':width,'height':height})
            for theme in ('day','night'):
                if page.locator('html').get_attribute('data-theme')!=theme: page.locator('#theme').click()
                for preset in ('teaching','polar','leo','geo','lesson11b'):
                    page.locator('#preset').select_option(preset)
                    page.locator('#fit-view').click();page.wait_for_timeout(150)
                    tag=f'{width}x{height}-{theme}-{preset}'
                    report=page.evaluate('''() => {
                      const rect=s=>document.querySelector(s).getBoundingClientRect();
                      const world=rect('.ocean'),canvas=rect('.orbit-canvas'),map=rect('#ground-map');
                      const labels=[...document.querySelectorAll('.scene-label')].filter(e=>getComputedStyle(e).display!=='none').map(e=>e.getBoundingClientRect());
                      const overlap=labels.some((a,i)=>labels.slice(i+1).some(b=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top));
                      const axes=[...document.querySelectorAll('.map-axis-label')].filter(e=>getComputedStyle(e).display!=='none').map(e=>e.getBoundingClientRect());
                      const ring=rect('.point-ring');
                      return {world:[world.width,world.height],canvas:[canvas.width,canvas.height],
                        overflow:document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight,
                        overlap,labelsInside:labels.every(b=>b.left>=canvas.left&&b.right<=canvas.right&&b.top>=canvas.top&&b.bottom<=canvas.bottom),
                        axesOverlap:axes.some((a,i)=>axes.slice(i+1).some(b=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top)),
                        axesInside:axes.every(b=>b.left>=map.left-1&&b.right<=map.right+1&&b.top>=map.top-1&&b.bottom<=map.bottom+1),
                        labelSize:parseFloat(getComputedStyle(document.querySelector('.scene-label')).fontSize),marker:ring.width};
                    }''')
                    dimensions.append({'case':tag,**report})
                    check(not report['overflow'] and not report['overlap'] and report['labelsInside'] and report['axesInside'] and not report['axesOverlap'], tag+' fits without clipping or label collisions')
                    check(abs(report['world'][0]/report['world'][1]-2)<.001 and report['world'][0]>=300 and report['canvas'][1]>=320, tag+' preserves large diagrams and 2:1 world geometry')
                    check(report['labelSize']>=20 and 15<=report['marker']<=17, tag+' retains readable labels and a fixed-size position marker')
                    if preset=='teaching':
                        page.screenshot(path=str(RESULTS/(tag+'.png')))
                        page.evaluate("document.querySelector('.app').style.filter='contrast(.65) brightness(1.12)'")
                        page.screenshot(path=str(RESULTS/(tag+'-washout.png')))
                        page.evaluate("document.querySelector('.app').style.filter=''")
            # Explicit camera and playback checks at every classroom size.
            page.locator('#preset').select_option('teaching')
            for view in ('north','equator','plane'):
                page.locator('#camera').select_option(view)
                page.locator('#play').click();page.wait_for_timeout(250);page.locator('#play').click()
                check(snapshot()['time']>0, f'{width}x{height} playback works in {view} camera')
            page.locator('#reset-time').click()
            check(snapshot()['time']==0 and not snapshot()['playing'], f'{width}x{height} Restart pauses at time zero')
        check(not errors, 'no JavaScript errors during classroom matrix')
        (RESULTS/'results.json').write_text(json.dumps({'passed':len(checks),'checks':checks,'dimensions':dimensions,'errors':errors},indent=2))
        browser.close()
finally:
    server.shutdown()
print(f'{len(checks)} classroom checks passed; screenshots and dimensions in {RESULTS}')

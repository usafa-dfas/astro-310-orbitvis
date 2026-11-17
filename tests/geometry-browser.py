"""Rendered checks for axis emphasis, independent reference planes and the stationary key."""
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from threading import Thread
from pathlib import Path
from io import BytesIO
import json
import math
import os
import shutil
from PIL import Image, ImageChops
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
RESULTS=ROOT/'test-results'/'geometry'
RESULTS.mkdir(parents=True,exist_ok=True)
class Handler(SimpleHTTPRequestHandler):
    def log_message(self,*args): pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Handler,directory=str(ROOT)))
Thread(target=server.serve_forever,daemon=True).start()
checks=[]
def check(condition,name):
    assert condition,name
    checks.append(name);print('PASS',name,flush=True)
try:
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium'),args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        page=browser.new_page(viewport={'width':1920,'height':1080});errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
        page.goto(f'http://127.0.0.1:{server.server_port}/',wait_until='networkidle')
        page.wait_for_function('window.orbitExplorer')
        snapshot=lambda:page.evaluate('orbitExplorer.snapshot()')
        def settled(): page.wait_for_function('orbitExplorer.snapshot().camera.labelsReady')
        def menu(action):
            details=page.locator('details.overlay-menu')
            if details.get_attribute('open') is None: details.locator('summary').click()
            action();details.locator('summary').click();settled()
        def mode(value): menu(lambda:page.locator('#geometry-mode').select_option(value))
        def overlay(name,value): menu(lambda:page.locator('#overlay-'+name).set_checked(value))
        def capture(): return Image.open(BytesIO(page.locator('#orbit-canvas').screenshot())).convert('RGB')
        def changed(image):
            pixels=image.load()
            return sum(max(pixels[x,y])>=3 for y in range(image.height) for x in range(image.width))
        # In a north view of a circular equatorial orbit, compare actual pixels
        # along the positive and negative I halves, away from Earth and labels.
        page.locator('#preset').select_option('geo');mode('essential')
        page.locator('#camera').select_option('north');settled();before=capture()
        overlay('axes',True);after=capture();delta=ImageChops.difference(before,after)
        geometry=snapshot()['camera']['annotationGeometry'];earth=geometry['earth']
        segment=next((a,b) for a,b in geometry['segments'] if abs(a['x']-earth['x'])<3 and abs(a['y']-earth['y'])<3 and b['x']-a['x']>50 and abs(b['y']-a['y'])<2)
        a,b=segment;length=b['x']-a['x'];y=round((a['y']+b['y'])/2)
        positive=delta.crop((round(a['x']+.4*length),y-6,round(a['x']+.8*length),y+7))
        negative=delta.crop((round(a['x']-.8*length),y-6,round(a['x']-.4*length),y+7))
        check(changed(positive)>1.8*changed(negative),'positive I axis renders substantially bolder than its negative half')
        columns=[any(max(positive.getpixel((x,y)))>=3 for y in range(positive.height)) for x in range(positive.width)]
        check(sum(columns)>=.95*len(columns),'positive axis renders a continuous solid stroke')
        for width,height in [(1920,1080),(931,650)]:
            page.set_viewport_size({'width':width,'height':height})
            for theme in ['day','night']:
                if page.locator('html').get_attribute('data-theme')!=theme:page.locator('#theme').click()
                page.locator('#preset').select_option('teaching');mode('essential')
                for view in ['oblique','north','equator','plane']:
                    page.locator('#camera').select_option(view);overlay('equatorialPlane',False)
                    page.locator('#fit-view').click();settled();before=capture();camera=snapshot()['camera']
                    overlay('equatorialPlane',True);after=capture()
                    page.locator('#fit-view').click();settled();fitted=snapshot()['camera']
                    check(math.dist(camera['position'],fitted['position'])<.001,f'{width} {theme} {view}: equatorial plane does not shrink the orbit fit')
                    delta=ImageChops.difference(before,after);w,h=delta.size
                    strips=[delta.crop((0,0,6,h)),delta.crop((w-6,0,w,h)),delta.crop((0,0,w,6)),delta.crop((0,h-6,w,h))]
                    fractions=[changed(strip)/(strip.width*strip.height) for strip in strips]
                    check(sum(f>0 for f in fractions)>=2,f'{width} {theme} {view}: equatorial plane continues to viewport edges')
                # The orbital plane is a bounded square around a circle and a
                # rectangle around an ellipse, including equatorial orbits.
                for eccentricity in [0,.6]:
                    page.locator('#preset').select_option('geo');mode('essential')
                    if eccentricity:
                        page.locator('.element-card[data-key="e"] button').click()
                        field=page.locator('.element-card[data-key="e"] input[type="number"]')
                        field.fill(str(eccentricity));field.press('Enter')
                    if width<1000 and page.locator('#controls-toggle').get_attribute('aria-expanded')=='true':page.locator('#controls-toggle').click()
                    overlay('orbitalPlane',True);page.locator('#camera').select_option('north');settled()
                    camera=snapshot()['camera'];after=capture()
                    after.save(RESULTS/f'{width}-{theme}-rectangle-e{eccentricity}.png')
                    overlay('orbitalPlane',False);before=capture()
                    delta=ImageChops.difference(before,after)
                    left,top,right,bottom=delta.point(lambda p:255 if p>=3 else 0).getbbox()
                    w,h=delta.size;rw,rh=right-left,bottom-top
                    check(left>8 and top>8 and right<w-8 and bottom<h-8,f'{width} {theme} e={eccentricity}: orbital plane ends inside the viewport')
                    corners=[delta.crop((x,y,x+6,y+6)) for x in [left+4,right-10] for y in [top+4,bottom-10]]
                    check(all(changed(crop)>25 for crop in corners),f'{width} {theme} e={eccentricity}: all four rectangular corners are shaded')
                    check(1.05<rw/camera['orbitWidth']<1.2 and 1.05<rh/camera['orbitHeight']<1.2,f'{width} {theme} e={eccentricity}: rectangle extends only slightly beyond the orbit')
                    earth=camera['annotationGeometry']['earth']
                    center=(left+right)/2
                    expected_shift=-eccentricity*camera['orbitWidth']/2
                    check(abs(center-earth['x']-expected_shift)<4,f'{width} {theme} e={eccentricity}: rectangle is centered on the ellipse')
                page.locator('#preset').select_option('teaching')
                # The selected orbital plane gets its own purple treatment.
                mode('selected');page.locator('.element-card[data-key="i"] button').click()
                if width<1000 and page.locator('#controls-toggle').get_attribute('aria-expanded')=='true':page.locator('#controls-toggle').click()
                page.locator('#camera').select_option('oblique');settled()
                check(page.locator('#overlay-orbitalPlane').is_checked() and not page.locator('#overlay-equatorialPlane').is_checked(),f'{width} {theme}: selecting inclination enables only the orbital plane')
                page.locator('#orbit-panel').screenshot(path=str(RESULTS/f'{width}-{theme}-inclination.png'))
                legend=page.locator('#spacecraft-key');box=legend.bounding_box();position=snapshot()['state']['position']
                page.locator('#play').click()
                for frame in range(4):
                    page.wait_for_timeout(150)
                    check(legend.bounding_box()==box,f'{width} {theme}: spacecraft legend stays fixed during playback frame {frame}')
                page.locator('#play').click()
                check(math.dist(position,snapshot()['state']['position'])>1,f'{width} {theme}: spacecraft continues to move')
                check(page.locator('.scene-label[data-feature="Spacecraft"], .label-leaders [data-feature="Spacecraft"]').count()==0,f'{width} {theme}: no spacecraft tracking label or connector')
                canvas=page.locator('#orbit-canvas').bounding_box()
                check(box['y']+box['height']<=canvas['y'],f'{width} {theme}: legend leaves the drawing unobscured')
                check(page.evaluate('document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight'),f'{width} {theme}: controls still fit the classroom viewport')
        # A manual choice must override automatic selected-element geometry.
        overlay('orbitalPlane',False);settled();hidden=capture()
        overlay('orbitalPlane',True);shown=capture()
        check(changed(ImageChops.difference(hidden,shown))>100,'orbital switch changes rendered inclination geometry')
        overlay('orbitalPlane',False)
        page.locator('.element-card[data-key="arg"] button').click()
        check(not snapshot()['geometry']['orbitalPlane'] and not snapshot()['geometry']['equatorialPlane'],'selecting another element preserves manual plane choices')
        overlay('equatorialPlane',True)
        field=page.locator('.element-card[data-key="arg"] input[type="number"]')
        field.fill('90');field.press('Enter');page.locator('#camera').select_option('plane')
        check(snapshot()['geometry']['equatorialPlane'] and not snapshot()['geometry']['orbitalPlane'],'element edits and camera changes preserve the independent switches')
        mode('all')
        check(page.locator('#overlay-equatorialPlane').is_checked() and page.locator('#overlay-orbitalPlane').is_checked(),'All geometry enables both planes')
        overlay('equatorialPlane',False)
        check(snapshot()['geometry']['orbitalPlane'] and not snapshot()['geometry']['equatorialPlane'],'turning off the equatorial plane leaves the orbital plane enabled')
        mode('essential')
        check(not page.locator('#overlay-equatorialPlane').is_checked() and not page.locator('#overlay-orbitalPlane').is_checked(),'Essential disables both planes')
        # Coincident planes must remain usable in the equatorial case too.
        page.locator('#preset').select_option('geo');mode('all');page.locator('#camera').select_option('north');settled()
        check(snapshot()['webgl'], 'equatorial preset renders with all geometry enabled')
        check(not errors,'no JavaScript or shader compilation errors')
        (RESULTS/'results.json').write_text(json.dumps({'passed':len(checks),'checks':checks,'errors':errors},indent=2))
        browser.close()
finally:
    server.shutdown()
print(f'{len(checks)} geometry checks passed.')

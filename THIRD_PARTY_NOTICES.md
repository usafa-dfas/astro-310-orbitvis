# Third-party notices and asset sources

The distributed `index.html` embeds these components and assets. It makes no runtime CDN or map-service requests.

## Three.js 0.170.0

Includes OrbitControls and the wide-line utilities from the same version.

Source: https://github.com/mrdoob/three.js/tree/r170

The MIT License

Copyright © 2010-2024 three.js authors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.


## Earth image

`src/assets/earth.jpg` is the `earth_atmos_2048.jpg` example image from the Three.js r160 repository:

https://github.com/mrdoob/three.js/blob/r160/examples/textures/planets/earth_atmos_2048.jpg

The source repository is distributed under the MIT license above. The image is used for visual context; the actual ground-point calculations use a spherical Earth and the app's explicit rotation model.

## Natural Earth coastlines

`src/assets/land.json` is the 1:110 million land GeoJSON from Natural Earth:

https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_land.geojson

Natural Earth data is public domain: https://www.naturalearthdata.com/about/terms-of-use/

## USAFA Astro emblem

`src/assets/usafa-astro.png` is the original transparent emblem embedded in the supplied Astro 310 lesson slides (`ppt/media/image2.png`). It is included for the requested USAFA course branding. The third-party software licenses above do not describe or relicense the emblem.

## Build tool

esbuild 0.25.0 is a development dependency, distributed under the MIT license. It is not required to run the published application. Its license is retained in the installed package; the exact dependency and platform binary integrity hashes are recorded in `package-lock.json`.

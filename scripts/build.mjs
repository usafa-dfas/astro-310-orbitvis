import {build} from 'esbuild';
import {readFile,writeFile} from 'node:fs/promises';
const result=await build({entryPoints:['src/app.js'],bundle:true,write:false,minify:true,format:'iife',target:['es2020'],legalComments:'inline',loader:{'.jpg':'dataurl','.png':'dataurl'}});
const template=await readFile('src/shell.html','utf8');
const css=await readFile('src/style.css','utf8');
const logo='data:image/png;base64,'+(await readFile('src/assets/usafa-astro.png')).toString('base64');
const html=template.replace('__CSS__',()=>css).replace('__LOGO__',()=>logo).replace('__JS__',()=>result.outputFiles[0].text.replace(/<\/script/gi,'<\\/script'));
await writeFile('index.html',html);
console.log(`Built index.html (${(Buffer.byteLength(html)/1024).toFixed(0)} KiB), all dependencies and assets embedded.`);

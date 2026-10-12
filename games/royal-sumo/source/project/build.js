// Compile the ES-module sources in src/ into ONE offline HTML file.   usage:  node build.js [--check] [--out dir]
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
import {bundle} from './tools/bundler.mjs';
import {VERSIONS} from './src/core/versions.js';
const ROOT=path.dirname(new URL(import.meta.url).pathname);
const args=process.argv.slice(2),check=args.includes('--check'),outDir=args.includes('--out')?args[args.indexOf('--out')+1]:path.join(ROOT,'dist');
const r=bundle({root:ROOT});
if(r.errors.length){console.error('BUILD FAILED ('+r.errors.length+' problem'+(r.errors.length===1?'':'s')+'):\n  '+r.errors.join('\n  '));process.exit(1)}
if(check){console.log('ok: '+r.order.length+' modules, '+r.code.length+' bytes of script');process.exit(0)}
const read=f=>fs.readFileSync(path.join(ROOT,'src/app',f),'utf8');
const css=read('shell.css').replace(/\n+$/,'\n')+read('style.css').replace(/\n+$/,'\n');
const gen='Royal Sumo: Crownfall '+VERSIONS.build+' (sim '+VERSIONS.sim+', protocol '+VERSIONS.protocol+')';
const html='<!doctype html>\n<html lang="en"><head><meta charset="utf-8">\n'+
'<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">\n'+
'<meta name="theme-color" content="#1b1030"><meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-capable" content="yes">\n'+
'<meta name="generator" content="'+gen+'">\n<title>Royal Sumo: Crownfall</title>\n<style>'+css+'</style></head><body>\n'+
'<canvas id="game" tabindex="-1"></canvas><div id="ui"></div><div id="flash"></div>\n<script>\n'+r.code+'</script></body></html>\n';
fs.mkdirSync(outDir,{recursive:true});
const name='royal_sumo_crownfall_v'+VERSIONS.build+'.html';
fs.writeFileSync(path.join(outDir,name),html);fs.writeFileSync(path.join(outDir,'index.html'),html);
const info={versions:VERSIONS,file:name,bytes:Buffer.byteLength(html),sha256:crypto.createHash('sha256').update(html).digest('hex'),modules:r.modules};
fs.writeFileSync(path.join(outDir,'build-info.json'),JSON.stringify(info,null,1));
console.log('built '+name+'  '+(info.bytes/1024).toFixed(1)+' KB  ('+r.order.length+' modules)  sim '+VERSIONS.sim+'  sha256 '+info.sha256.slice(0,12));

import {readdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {validateCards} from '../src/deck.js';
import {VOCABULARIES} from '../src/game.js';
const root=fileURLToPath(new URL('../',import.meta.url)),dist=path.join(root,'dist');
validateCards((await Promise.all(VOCABULARIES.map(async id=>JSON.parse(await readFile(path.join(root,'src/data',id+'.json'),'utf8'))))).flat());
async function walk(folder='') {
  const files=[];
  for(const entry of await readdir(path.join(dist,folder),{withFileTypes:true})){
    const relative=path.posix.join(folder,entry.name);
    if(entry.isDirectory())files.push(...await walk(relative));else if(entry.name!=='sw.js')files.push(relative);
  }
  return files;
}
const files=(await walk()).sort(),hash=createHash('sha256');
const template=await readFile(path.join(root,'scripts/sw-template.js'),'utf8');
hash.update(template);
for(const file of files)hash.update(file).update('\0').update(await readFile(path.join(dist,file))).update('\0');
const version=hash.digest('hex').slice(0,16);
const worker=template.replace("'__VERSION__'",`'${version}'`).replace('const ASSETS = [];',`const ASSETS = ${JSON.stringify(files.map(file=>'./'+file))};`);
await writeFile(path.join(dist,'sw.js'),worker);
console.log(`PWA: ${files.length} recursos offline · caché ${version}`);

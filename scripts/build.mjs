import {mkdir,copyFile,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import './build-anatomy.mjs';
const site=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const from=path.join(site,'node_modules/three'),to=path.join(site,'dist/vendor');
await mkdir(to,{recursive:true});
for(const name of ['three.module.js','three.core.js'])await copyFile(path.join(from,'build',name),path.join(to,name));
await copyFile(path.join(from,'LICENSE'),path.join(to,'THREE-LICENSE.txt'));
for(const module of ['controls/OrbitControls.js','loaders/STLLoader.js','exporters/STLExporter.js','objects/MarchingCubes.js']){
 const target=path.join(to,'addons',module);await mkdir(path.dirname(target),{recursive:true});
 const source=await readFile(path.join(from,'examples/jsm',module),'utf8');
 // Relative imports work both in the main page and in module workers, where
 // document import maps are not inherited.
 await writeFile(target,source.replaceAll("from 'three';","from '../../three.module.js';"));
}
console.log('Vendored Three.js 0.180.0 and required addons; runtime is CDN-independent.');

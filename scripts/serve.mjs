import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../dist');
const port=Number(process.env.PORT||4317);
const basePath=process.env.BASE_PATH?'/'+process.env.BASE_PATH.replace(/^\/+|\/+$/g,''):'';
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.stl':'application/octet-stream','.gz':'application/octet-stream','.txt':'text/plain; charset=utf-8'};
const server=http.createServer(async(req,res)=>{
 try{
  let pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(basePath&&pathname===basePath){res.writeHead(301,{Location:basePath+'/'}).end();return;}
  if(basePath&&!pathname.startsWith(basePath+'/')){res.writeHead(404).end('Not found');return;}
  pathname=pathname.slice(basePath.length);
  const file=path.resolve(root,'.'+pathname+(pathname.endsWith('/')?'index.html':''));
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end('Forbidden');return;}
  const info=await stat(file);if(!info.isFile()){res.writeHead(404).end('Not found');return;}
  res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','no-cache');res.setHeader('Content-Length',info.size);
  res.writeHead(200);if(req.method==='HEAD')res.end();else res.end(await readFile(file));
 }catch{res.writeHead(404).end('Not found');}
});
server.listen(port,'127.0.0.1',()=>console.log(`SonoBox preview: http://127.0.0.1:${port}${basePath}/`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));

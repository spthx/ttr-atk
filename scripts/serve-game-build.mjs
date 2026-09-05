import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
const root=resolve(process.argv[2]??'public');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.webp':'image/webp','.mp3':'audio/mpeg','.svg':'image/svg+xml','.json':'application/json','.webmanifest':'application/manifest+json'};
createServer(async(req,res)=>{
 try{
  const path=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
  const relative=path==='/'?'game/index.html':path.startsWith('/assets/')?'game'+path:path;
  const file=resolve(root,'.'+sep+relative.replace(/^\//,''));
  if(!file.startsWith(root+sep))throw new Error('Invalid path');
  const bytes=await readFile(file);res.writeHead(200,{'Content-Type':types[extname(file)]??'application/octet-stream','Cache-Control':'no-store'});res.end(bytes);
 }catch{res.writeHead(404);res.end('Not found')}
}).listen(4140,'127.0.0.1',()=>console.log('Built game QA at http://127.0.0.1:4140'));

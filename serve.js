import {createServer} from 'node:http';
import {readFile,realpath} from 'node:fs/promises';
import {extname,join,normalize,sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=await realpath(fileURLToPath(new URL('.',import.meta.url)));
const PORT=8000;
const MIME={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json'};

createServer(async(req,res)=>{
  let pathname;
  try{pathname=new URL(req.url??'/',`http://localhost`).pathname;}
  catch{res.writeHead(400);return res.end('Bad request');}
  const relative=normalize(pathname==='/'?'index.html':pathname.slice(1));
  if(relative.startsWith('..'+sep)||relative.startsWith('/')||relative.includes('\0')){
    res.writeHead(403);return res.end('Forbidden');
  }
  const candidate=join(ROOT,relative);
  try{
    const file=await realpath(candidate);
    const rootWithSep=ROOT.endsWith(sep)?ROOT:ROOT+sep;
    if(!file.startsWith(rootWithSep)){res.writeHead(403);return res.end('Forbidden');}
    const data=await readFile(file);
    res.writeHead(200,{'Content-Type':MIME[extname(file)]||'application/octet-stream'});
    res.end(data);
  }catch(err){
    if(err.code==='ENOENT'||err.code==='ENOTDIR'){res.writeHead(404);return res.end('Not found');}
    res.writeHead(403);res.end('Forbidden');
  }
}).listen(PORT,()=>console.log(`Serving on http://localhost:${PORT}`));

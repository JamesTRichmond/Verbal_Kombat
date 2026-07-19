import {createServer} from 'node:http';
import {readFile,realpath} from 'node:fs/promises';
import {extname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=await realpath(fileURLToPath(new URL('.',import.meta.url)));
const PORT=8000;
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'};

createServer(async(req,res)=>{
  const safePath=req.url==='/'?'/index.html':req.url;
  const candidate=resolve(ROOT,safePath.slice(1));
  try{
    const file=await realpath(candidate);
    if(!file.startsWith(ROOT+'/') && file!==ROOT){res.writeHead(403);return res.end('Forbidden');}
    const data=await readFile(file);
    res.writeHead(200,{'Content-Type':MIME[extname(file)]||'application/octet-stream'});
    res.end(data);
  }catch(err){
    if(err.code==='ENOENT'||err.code==='ENOTDIR'){res.writeHead(404);return res.end('Not found');}
    res.writeHead(403);res.end('Forbidden');
  }
}).listen(PORT,()=>console.log(`Serving on http://localhost:${PORT}`));

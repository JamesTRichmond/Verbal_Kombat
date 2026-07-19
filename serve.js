import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {extname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=fileURLToPath(new URL('.',import.meta.url));
const PORT=8000;
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'};

createServer(async(req,res)=>{
  const safePath=req.url==='/'?'/index.html':req.url;
  const file=resolve(ROOT,safePath.slice(1));
  if(!file.startsWith(ROOT)){res.writeHead(403);return res.end('Forbidden');}
  try{
    const data=await readFile(file);
    res.writeHead(200,{'Content-Type':MIME[extname(file)]||'application/octet-stream'});
    res.end(data);
  }catch{
    res.writeHead(404);res.end('Not found');
  }
}).listen(PORT,()=>console.log(`Serving on http://localhost:${PORT}`));

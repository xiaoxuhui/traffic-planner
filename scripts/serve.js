const http=require('node:http'); const fs=require('node:fs'); const path=require('node:path');
const root=path.resolve(__dirname,'../dist'); const port=4267;
http.createServer((req,res)=>{
 let file;
 try { const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname); file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname)); } catch {res.writeHead(400).end();return;}
 if (!file.startsWith(root+path.sep)) {res.writeHead(403).end();return;}
 fs.readFile(file,(err,data)=>{
  if(err){res.writeHead(404).end('Not found');return;}
  res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8'})[path.extname(file)]||'application/octet-stream');
  res.end(data);
 });
}).listen(port,'127.0.0.1',()=>console.log('路流 Local: http://127.0.0.1:'+port));

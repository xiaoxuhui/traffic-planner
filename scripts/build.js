const fs=require('node:fs'); const path=require('node:path');
const root=path.resolve(__dirname,'..');
for(const f of ['index.html','styles.css','src/core.js','src/examples.js','src/simulation.js','src/app.js']) {
 const target=path.join(root,'dist',f); fs.mkdirSync(path.dirname(target),{recursive:true}); fs.copyFileSync(path.join(root,f),target);
}
console.log('构建成功：dist/（6 个文件）');

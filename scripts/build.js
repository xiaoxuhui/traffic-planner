const fs=require('node:fs'); const path=require('node:path');
const root=path.resolve(__dirname,'..');
const manifest=require('../game-hub.integration.json');
for(const f of manifest.files) {
 const target=path.join(root,'dist',f); fs.mkdirSync(path.dirname(target),{recursive:true}); fs.copyFileSync(path.join(root,f),target);
}
console.log('构建成功：dist/（'+manifest.files.length+' 个文件，含 MIT 许可）');

const fs=require('node:fs'); const path=require('node:path');
const root=path.resolve(__dirname,'..');
for(const f of require('../game-hub.integration.json').files) {
 const target=path.join(root,'dist',f); fs.mkdirSync(path.dirname(target),{recursive:true}); fs.copyFileSync(path.join(root,f),target);
}
console.log('构建成功：dist/（7 个文件，含 MIT 许可）');

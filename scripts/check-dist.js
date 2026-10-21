const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),manifest=require('../game-hub.integration.json'),pkg=require('../package.json');
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.relative(path.join(root,'dist'),path.join(dir,e.name)).split(path.sep).join('/')]);}
assert.deepEqual(walk(path.join(root,'dist')).sort(),[...manifest.files].sort());
for(const file of manifest.files)assert.ok(fs.readFileSync(path.join(root,file)).equals(fs.readFileSync(path.join(root,'dist',file))),file+' differs from source');
assert.equal(pkg.version,manifest.version);assert.equal(pkg.license,manifest.license);assert.match(fs.readFileSync(path.join(root,'dist/LICENSE'),'utf8'),/^MIT License\n/);
console.log('Verified seven offline runtime files against source, version and license');

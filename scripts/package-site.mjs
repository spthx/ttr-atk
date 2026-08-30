import {execFileSync} from 'node:child_process';
import {existsSync,mkdirSync,readFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';

// Portable Windows fallback when the Sites hosting shell helper is unavailable.
// Call ONLY after building the exact committed/pushed source. No source files,
// node_modules, credentials, browser profiles or QA captures enter this archive.
const project=resolve(process.argv[2]??'.');
const archive=resolve(process.argv[3]??'tmp/site-build.tar');
const hosting=resolve(project,'.openai/hosting.json');
for(const file of [hosting,resolve(project,'dist/server/index.js')]){
  if(!existsSync(file))throw new Error(`Missing production artifact: ${file}`);
}
if(!existsSync(resolve(project,'dist/client')))throw new Error('Missing vinext client output');
const config=JSON.parse(readFileSync(hosting,'utf8'));
if(typeof config.project_id!=='string'||!config.project_id)throw new Error('Missing exact Sites project id');
if(archive.startsWith(resolve(project,'dist')+'/')||archive.startsWith(resolve(project,'dist')+'\\'))throw new Error('Archive must be outside dist');
mkdirSync(dirname(archive),{recursive:true});
const artifactPaths=['dist/server','dist/client','.openai/hosting.json'];
if(existsSync(resolve(project,'dist/.openai')))artifactPaths.push('dist/.openai');
execFileSync('tar',['-cf',archive,'-C',project,...artifactPaths],{stdio:'inherit'});
console.log(JSON.stringify({archive,project_id:config.project_id,entry:'dist/server/index.js'}));

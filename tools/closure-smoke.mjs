import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {randomBytes} from 'node:crypto';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
const execute=promisify(execFile),id=`fbr-closure-${randomBytes(5).toString('hex')}`,label=`fbr.closure=${id}`,containers=[];
const directory=await mkdtemp(join(tmpdir(),'fbr-closure-smoke-'));
const environment={...process.env,POSTGRES_PASSWORD:randomBytes(24).toString('hex'),POSTGRES_USER:'fbr',POSTGRES_DB:'fbrtest',FBR_OPERATOR_ACCESS_TOKEN:randomBytes(32).toString('hex')};
const runtimeImage='fbrvideos-runtime:closure-verified',webImage='fbrvideos-web:closure-verified';
const docker=(args,options={})=>execute('docker',args,{windowsHide:true,timeout:300000,maxBuffer:20_000_000,env:environment,...options});
const log=message=>console.log(message);
async function run(name,args){containers.push(name);return docker(['run','-d','--name',name,'--label',label,...args]);}
async function waitUntil(check){for(let attempt=0;attempt<60;attempt++){try{if(await check())return;}catch{}await new Promise(done=>setTimeout(done,500));}throw new Error('smoke_readiness_timeout');}
try{
 for(const [target,image] of [['runtime',runtimeImage],['web',webImage]]){
  log(`Building ${target} image`);const result=await docker(['build','--target',target,'-t',image,'.']);await writeFile(join(directory,`build-${target}.log`),result.stdout+result.stderr);
 }
 await docker(['network','create','--label',label,id]);
 const database=`${id}-db`;await run(database,['--network',id,'--network-alias','database','--tmpfs','/var/lib/postgresql','-p','127.0.0.1::5432','-e','POSTGRES_PASSWORD','-e','POSTGRES_USER','-e','POSTGRES_DB','postgres:18']);
 await waitUntil(async()=>{await docker(['exec',database,'pg_isready','-U','fbr','-d','fbrtest']);return true;});
 const port=(await docker(['port',database,'5432/tcp'])).stdout.trim().split(':').at(-1);
 const localUrl=`postgresql://fbr:${environment.POSTGRES_PASSWORD}@127.0.0.1:${port}/fbrtest`;
 log('Running native PostgreSQL queue, recovery and public pipeline tests');
 const native=await execute(process.execPath,['--import','tsx','--test','--test-concurrency=1','packages/infra/test/generation-queue.test.ts','packages/infra/test/database-recovery.test.ts','packages/infra/test/production-pipeline.test.ts'],{windowsHide:true,timeout:240000,maxBuffer:5_000_000,env:{...environment,TEST_DATABASE_URL:localUrl}});
 await writeFile(join(directory,'native-tests.log'),native.stdout+native.stderr);log(native.stdout.split('\n').filter(line=>/ℹ (tests|pass|fail|skipped)/.test(line)).join('\n'));
 // A separate empty database is used for the installation smoke, preserving native-test data.
 await docker(['exec',database,'psql','-U','fbr','-d','fbrtest','-c','CREATE DATABASE fbrsmoke']);
 environment.DATABASE_URL=`postgresql://fbr:${environment.POSTGRES_PASSWORD}@database:5432/fbrsmoke`;
 environment.FBR_GENERATION_MODE='synthetic';environment.FBR_PLANNER='extractive';environment.API_HOST='0.0.0.0';environment.FBR_ALLOWED_HOSTS='localhost,127.0.0.1';environment.FBR_ALLOWED_ORIGINS='https://localhost:8443';
 const envFlags=['DATABASE_URL','FBR_GENERATION_MODE','FBR_PLANNER','API_HOST','FBR_OPERATOR_ACCESS_TOKEN','FBR_ALLOWED_HOSTS','FBR_ALLOWED_ORIGINS'].flatMap(name=>['-e',name]);
 await docker(['run','--rm','--network',id,...envFlags,runtimeImage,'node','--import','tsx','packages/infra/src/migrate.ts']);
 const apiName=`${id}-api`;await run(apiName,['--network',id,'--network-alias','api','-p','127.0.0.1::3001',...envFlags,runtimeImage]);
 const apiPort=(await docker(['port',apiName,'3001/tcp'])).stdout.trim().split(':').at(-1);
 const headers={authorization:`Bearer ${environment.FBR_OPERATOR_ACCESS_TOKEN}`};
 await waitUntil(async()=>{const response=await fetch(`http://127.0.0.1:${apiPort}/api/readiness`,{headers});return response.ok&&(await response.json()).ready;});
 const settings=await fetch(`http://127.0.0.1:${apiPort}/api/settings`,{headers});if(!settings.ok||(await settings.json()).version!==0)throw new Error('smoke_settings_failed');
 const protectedResponse=await fetch(`http://127.0.0.1:${apiPort}/api/settings`);if(protectedResponse.status!==401)throw new Error('smoke_private_api_failed');
 log('Container API: migrations, FFmpeg/FFprobe readiness, settings and authentication passed');
 const worker=`${id}-worker`;await run(worker,['--network',id,...envFlags,runtimeImage,'node','--import','tsx','apps/worker/src/server.ts']);
 await waitUntil(async()=>{const status=JSON.parse((await docker(['inspect',worker,'--format','{{json .State}}'])).stdout);const logs=await docker(['logs',worker]);return status.Running&&logs.stdout.includes('Worker provisionado');});
 // Compile/serve the frontend under a temporary TLS certificate, entirely inside the isolated network.
 await docker(['run','--rm','--mount',`type=bind,source=${resolve(directory)},target=/certs`,runtimeImage,'openssl','req','-x509','-newkey','rsa:2048','-nodes','-keyout','/certs/privkey.pem','-out','/certs/fullchain.pem','-days','1','-subj','/CN=localhost']);
 const web=`${id}-web`;await run(web,['--network',id,'--network-alias','web','--mount',`type=bind,source=${resolve(directory)},target=/etc/nginx/certs,readonly`,webImage]);
 await waitUntil(async()=>{const result=await docker(['run','--rm','--network',id,runtimeImage,'node','-e',"const https=require('https');https.get('https://web/',{rejectUnauthorized:false},r=>{let body='';r.on('data',c=>body+=c);r.on('end',()=>process.exit(r.statusCode===200&&body.includes('id=\"root\"')?0:1));}).on('error',()=>process.exit(1))"]);return !result.stderr;});
 log('Worker startup and compiled frontend over isolated TLS passed');
 log(`Evidence directory: ${directory}`);
}catch(error){
 if(error.stdout||error.stderr)await writeFile(join(directory,'failure.log'),String(error.stdout??'')+String(error.stderr??''));
 log(`Smoke failed (${error.code??error.message}); evidence: ${directory}`);process.exitCode=1;
}finally{
 for(const name of containers.reverse()){try{const value=(await docker(['inspect',name,'--format','{{index .Config.Labels "fbr.closure"}}'])).stdout.trim();if(value===id)await docker(['rm','-f',name]);}catch{}}
 try{const value=(await docker(['network','inspect',id,'--format','{{index .Labels "fbr.closure"}}'])).stdout.trim();if(value===id)await docker(['network','rm',id]);}catch{}
 // Evidence is retained; only the temporary private key is removed from this run's own directory.
 await rm(join(directory,'privkey.pem'),{force:true});
}

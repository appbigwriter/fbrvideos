import {resolve,relative,isAbsolute,sep} from 'node:path';
import {PostgresDatabase} from './configuration-store.js';
import {LocalImmutableAssetStore} from './asset-store.js';
import {captureFullBackup} from './full-backup.js';
import {loadProviderRuntime} from './provider-runtime.js';
if(!process.env.DATABASE_URL)throw new Error('Defina DATABASE_URL antes do backup completo.');
const liveRoot=resolve(process.env.FBR_ASSET_ROOT||'var/assets'),backupRoot=resolve(process.env.FBR_BACKUP_ROOT||`var/full-backups/${new Date().toISOString().replace(/[:.]/g,'-')}`);
const fragment=relative(liveRoot,backupRoot);
if(fragment===''||(!isAbsolute(fragment)&&fragment!=='..'&&!fragment.startsWith(`..${sep}`)))throw new Error('Backup exige destino fora da pasta de mídia ativa.');
const db=new PostgresDatabase(process.env.DATABASE_URL);
try{const defaultFiles=new LocalImmutableAssetStore(liveRoot),runtime=await loadProviderRuntime(process.env.FBR_PROVIDER_BINDINGS_MODULE,{db,files:defaultFiles});
  const result=await captureFullBackup(db,runtime?.files??defaultFiles,new LocalImmutableAssetStore(backupRoot));
  console.log(JSON.stringify({destination:backupRoot,...result}));}finally{await db.close();}

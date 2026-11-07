import {resolve,relative,isAbsolute,sep} from 'node:path';
import {mkdir,readdir} from 'node:fs/promises';
import {PostgresDatabase,migrateConfiguration} from '../packages/infra/src/configuration-store.js';
import {LocalImmutableAssetStore} from '../packages/infra/src/asset-store.js';
import {restoreFullBackup} from '../packages/infra/src/full-backup.js';

function required(name:string){const value=process.env[name]?.trim();if(!value)throw new Error(`restore_missing_${name}`);return value;}
function contains(root:string,path:string){const fragment=relative(root,path);return fragment===''||!isAbsolute(fragment)&&fragment!=='..'&&!fragment.startsWith(`..${sep}`);}
async function restore(){
  const connection=required('FBR_RESTORE_DATABASE_URL'),destination=resolve(required('FBR_RESTORE_ASSET_ROOT')),source=resolve(required('FBR_RESTORE_BACKUP_ROOT'));
  const key=required('FBR_RESTORE_METADATA_KEY'),hash=required('FBR_RESTORE_METADATA_HASH');
  if(!/^[a-f0-9]{64}$/.test(hash)||key!==`metadata/${hash}.json`)throw new Error('restore_metadata_reference_invalid');
  if(connection===process.env.DATABASE_URL||contains(source,destination)||contains(destination,source))throw new Error('restore_requires_isolated_destination');
  if(process.env.FBR_ASSET_ROOT&&contains(resolve(process.env.FBR_ASSET_ROOT),destination))throw new Error('restore_destination_is_live_storage');
  await mkdir(destination,{recursive:true});
  if((await readdir(destination)).length)throw new Error('restore_requires_empty_asset_directory');
  const database=new PostgresDatabase(connection);
  try{
    await migrateConfiguration(database);
    // Pré-checagem; restoreFullBackup revalida todas as tabelas sob locks antes do commit.
    for(const table of ['configuration_heads','production_heads','media_heads'])if((await database.query(`SELECT 1 FROM ${table} LIMIT 1`)).rows.length)throw new Error('restore_requires_empty_database');
    const result=await restoreFullBackup(database,new LocalImmutableAssetStore(source),new LocalImmutableAssetStore(destination),key,hash);
    console.log(JSON.stringify({status:'restored',...result,requires_manual_start:true}));
  }finally{await database.close();}
}
restore().catch(()=>{console.error('Restauração recusada ou incompleta. Confira destino isolado/vazio, manifesto e integridade do backup. Nenhum serviço foi iniciado.');process.exitCode=1;});

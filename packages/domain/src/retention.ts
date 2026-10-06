import {z} from 'zod';
import {TimestampSchema} from '@fbr/contracts';
export const RetentionPolicySchema=z.strictObject({keep_referenced:z.literal(true),orphan_grace_days:z.int().min(1).max(3650)});
/** Plano provisionável, sem remoção automática. Revisões históricas e backups também contam como referência. */
export function planRetention(files:{storage_key:string;modified_at:string}[],referencedKeys:ReadonlySet<string>,rawPolicy:unknown,now:string){
  const policy=RetentionPolicySchema.parse(rawPolicy),time=new Date(TimestampSchema.parse(now)).getTime();
  if(new Set(files.map(file=>file.storage_key)).size!==files.length)throw new Error('retention_duplicate_file');
  return files.map(file=>{const age=time-new Date(TimestampSchema.parse(file.modified_at)).getTime();
    const reason=referencedKeys.has(file.storage_key)?'referenced':age<policy.orphan_grace_days*86400000?'grace_period':'orphan_after_grace';
    return {...file,action:reason==='orphan_after_grace'?'eligible_for_removal':'keep',reason};
  });
}

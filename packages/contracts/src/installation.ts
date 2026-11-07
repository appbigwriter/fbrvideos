import {z} from 'zod';
import {IdSchema,VersionRefSchema,CurrencySchema} from './schemas.js';
const instant=z.iso.datetime({offset:true}).transform(value=>new Date(value).toISOString());
const timezone=z.string().min(1).refine(value=>{try{new Intl.DateTimeFormat('pt-BR',{timeZone:value});return true;}catch{return false;}},'Fuso horário inválido');
export const InstallationSettingsSchema=z.strictObject({version:z.int().nonnegative(),ui_language:z.literal('pt-BR'),timezone,
 blogs:z.array(z.strictObject({id:IdSchema,name:z.string().trim().min(1).max(300),url:z.url(),authors:z.array(z.strictObject({name:z.string().trim().min(1).max(300),character:VersionRefSchema})).max(100)})).max(100),
 period_budget:z.strictObject({currency:CurrencySchema,ceiling_minor:z.int().nonnegative(),starts_at:instant,ends_at:instant}).refine(value=>value.ends_at>value.starts_at,'Fim deve ser posterior ao início').nullable(),
}).refine(value=>new Set(value.blogs.map(b=>b.id)).size===value.blogs.length,'Identificadores de blogs duplicados');
export const InstallationInputSchema=z.strictObject(InstallationSettingsSchema.shape).omit({version:true});
export const SaveInstallationSchema=z.strictObject({command_id:IdSchema,expected_version:z.int().nonnegative(),reason:z.string().trim().min(1).max(2000),data:InstallationInputSchema});
export type InstallationSettings=z.infer<typeof InstallationSettingsSchema>;

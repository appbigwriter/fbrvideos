import {InstallationSettingsSchema,SaveInstallationSchema,GenerationExecutionSchema,CharacterSchema,type InstallationSettings} from '@fbr/contracts';
import {ApplicationError,canonical,sha256} from '@fbr/domain';
import type {SqlDatabase,SqlClient} from './configuration-store.js';
export async function installationSettings(client:SqlClient):Promise<InstallationSettings>{
 const row=(await client.query('SELECT record FROM installation_settings ORDER BY version DESC LIMIT 1')).rows[0];
 return row?InstallationSettingsSchema.parse(row.record):{version:0,ui_language:'pt-BR',timezone:'America/Sao_Paulo',blogs:[],period_budget:null};
}
export async function installationConsumption(client:SqlClient,settings:InstallationSettings){
 const budget=settings.period_budget;
 const rows=(await client.query('SELECT r.record,t.admitted_at FROM generation_revisions r JOIN generation_heads h USING(id,version) LEFT JOIN generation_admission_times t ON t.execution_id=h.id')).rows;
 const totals=new Map<string,{currency:string;confirmed_minor:number;reserved_minor:number;unknown:boolean}>();
 for(const row of rows){const job=GenerationExecutionSchema.parse(row.record),at=row.admitted_at?new Date(String(row.admitted_at)).toISOString():null;
  if(budget&&at&&(at<budget.starts_at||at>=budget.ends_at)&&job.reserved_minor===0)continue;
  const currency=job.intent.request.currency,total=totals.get(currency)??{currency,confirmed_minor:0,reserved_minor:0,unknown:false};
  total.confirmed_minor+=job.confirmed_minor;total.reserved_minor+=job.reserved_minor;
  if(!at||job.provider_job?.costs.confirmed_minor===null&&job.reserved_minor===0)total.unknown=true;
  totals.set(currency,total);
 }
 return{window:budget?{starts_at:budget.starts_at,ends_at:budget.ends_at}:null,totals:[...totals.values()]};
}
/** Global admission lock serializes reservations across productions; queries/reconciliation remain allowed. */
export async function assertInstallationBudget(client:SqlClient,currency:string,additionalMinor:number,enforceExisting=false){
 await client.query('SELECT pg_advisory_xact_lock(6401216)');
 const settings=await installationSettings(client),budget=settings.period_budget;if(!budget||additionalMinor===0&&!enforceExisting)return;
 const now=new Date().toISOString();if(now<budget.starts_at||now>=budget.ends_at)throw new ApplicationError('budget_exceeded','Atualize o período de orçamento da instalação antes de iniciar novos gastos.');
 if(currency!==budget.currency)throw new ApplicationError('budget_exceeded','Moeda incompatível com o orçamento do período; conversão não configurada.');
 const consumption=await installationConsumption(client,settings);
 if(consumption.totals.some(total=>total.unknown))throw new ApplicationError('budget_exceeded','Consumo do período possui evidências incompletas; reconciliar antes de novos gastos.');
 const total=consumption.totals.find(t=>t.currency===currency);
 if((total?.confirmed_minor??0)+(total?.reserved_minor??0)+additionalMinor>budget.ceiling_minor)throw new ApplicationError('budget_exceeded','Reserva excede o teto da instalação para o período configurado.');
}
export class InstallationService{
 constructor(private db:SqlDatabase){}
 get(){return installationSettings(this.db);}
 async consumption(){const settings=await this.get();return installationConsumption(this.db,settings);}
 async save(raw:unknown){const request=SaveInstallationSchema.parse(raw),fingerprint=sha256(canonical(request));
  return this.db.transaction(async client=>{
   await client.query('SELECT pg_advisory_xact_lock(6401216)');const key=`installation:${request.command_id}`;
   await client.query('INSERT INTO configuration_commands(command_id,fingerprint) VALUES($1,$2) ON CONFLICT DO NOTHING',[key,fingerprint]);
   const oldCommand=(await client.query('SELECT fingerprint,result FROM configuration_commands WHERE command_id=$1 FOR UPDATE',[key])).rows[0]!;
   if(oldCommand.fingerprint!==fingerprint)throw new ApplicationError('conflict','Comando reutilizado para outra configuração.');
   if(oldCommand.result)return InstallationSettingsSchema.parse(oldCommand.result);
   const current=await installationSettings(client);if(current.version!==request.expected_version)throw new ApplicationError('conflict','Configuração alterada; recarregue antes de salvar.');
   for(const blog of request.data.blogs){const url=new URL(blog.url);if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw new ApplicationError('validation','Informe URL HTTP(S) pública sem credenciais.');
    for(const author of blog.authors){const row=(await client.query("SELECT record FROM configuration_revisions WHERE kind='characters' AND id=$1 AND version=$2",[author.character.id,author.character.version])).rows[0];if(!row||CharacterSchema.parse(row.record).status!=='confirmed')throw new ApplicationError('ineligible','Associe autores a versões confirmadas de personagens.');}}
   const next=InstallationSettingsSchema.parse({...request.data,version:current.version+1});
   await client.query('INSERT INTO installation_settings(version,record) VALUES($1,$2::jsonb)',[next.version,JSON.stringify(next)]);
   await client.query('UPDATE configuration_commands SET result=$2::jsonb WHERE command_id=$1',[key,JSON.stringify(next)]);return next;
  });
 }
}

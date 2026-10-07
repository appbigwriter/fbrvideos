import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {ProductionSchema,VersionRefSchema,IdSchema,type Production} from '@fbr/contracts';
import {canonical,sha256,sameRef,ApplicationError} from '@fbr/domain';
import type {SqlDatabase} from './configuration-store.js';
export const BudgetRevisionSchema=z.strictObject({command_id:IdSchema,production:VersionRefSchema,currency:z.string().regex(/^[A-Z]{3}$/),
  ceiling_minor:z.int().nonnegative(),reason:z.string().trim().min(1).max(2000),source:z.string().trim().min(1).max(2000),
  evidence:z.string().trim().min(1).max(4000),reviewed:z.literal(true)});
/** Operator increases the permitted ceiling; only provider queries can change actual charges/refunds. */
export class PostgresBudgetWorkflow {
  constructor(private readonly db:SqlDatabase){}
  async revise(raw:unknown):Promise<Production>{
    const command=BudgetRevisionSchema.parse(raw),fingerprint=sha256(canonical(command));
    return this.db.transaction(async client=>{
      const head=(await client.query('SELECT version FROM production_heads WHERE id=$1 FOR UPDATE',[command.production.id])).rows[0];
      if(!head)throw new ApplicationError('not_found','Produção não encontrada.');
      const old=(await client.query('SELECT fingerprint,result FROM production_budget_commands WHERE command_id=$1',[command.command_id])).rows[0];
      if(old){if(old.fingerprint!==fingerprint)throw new ApplicationError('conflict','Comando de orçamento reutilizado.');return ProductionSchema.parse(old.result);}
      const production=ProductionSchema.parse((await client.query('SELECT record FROM production_revisions WHERE id=$1 AND version=$2',[command.production.id,head.version])).rows[0]?.record);
      if(!sameRef(production,command.production))throw new ApplicationError('conflict','Produção alterada; confira o saldo atualizado.');
      if(command.currency!==production.costs.currency)throw new ApplicationError('validation','Moeda do limite difere do orçamento; conversão não é presumida.');
      if(command.ceiling_minor<=production.costs.ceiling_minor)throw new ApplicationError('validation','Revisão exige aumento explícito do teto.');
      const costs={...production.costs,ceiling_minor:command.ceiling_minor};
      const overrun=costs.confirmed_minor+costs.committed_minor+costs.safety_margin_minor>costs.ceiling_minor;
      const issues=production.pending_issues.filter(i=>i.code!=='budget_reconciliation_overrun');
      if(overrun)issues.push({code:'budget_reconciliation_overrun',message:'Saldo confirmado e reservas ainda ultrapassam o teto com margem de segurança.',next_action:'Conferir o limite e os lançamentos; não gerar nem exportar enquanto persistir.',required:true});
      const at=new Date().toISOString(),message=`Teto autorizado: ${command.currency} ${command.ceiling_minor} unidades mínimas. ${command.reason}`;
      const record=ProductionSchema.parse({...production,costs,pending_issues:issues,version:production.version+1,created_at:at,
        ...(!issues.length&&production.status==='awaiting_decision'&&production.pending_issues.some(i=>i.code==='budget_reconciliation_overrun')?
          {status:production.current_render?'ready_for_review':production.stage==='generation'?'producing':'preparing',...(production.current_render?{stage:'review'}:{})}:{}),
        changes:[...production.changes,{at,author:'local_operator',reason:message}]});
      await client.query('INSERT INTO production_revisions(id,version,record) VALUES($1,$2,$3::jsonb)',[record.id,record.version,JSON.stringify(record)]);
      await client.query('UPDATE production_heads SET version=$2 WHERE id=$1',[record.id,record.version]);
      const eventId=randomUUID();
      await client.query('INSERT INTO production_events(id,production_id,version,record) VALUES($1,$2,$3,$4::jsonb)',[eventId,record.id,record.version,
        JSON.stringify({id:eventId,production:{id:record.id,version:record.version},at,type:'costs_updated',message})]);
      await client.query('INSERT INTO production_budget_commands(command_id,production_id,fingerprint,record,result) VALUES($1,$2,$3,$4::jsonb,$5::jsonb)',
        [command.command_id,record.id,fingerprint,JSON.stringify({...command,at,previous_ceiling_minor:production.costs.ceiling_minor}),JSON.stringify(record)]);
      return record;
    });
  }
}

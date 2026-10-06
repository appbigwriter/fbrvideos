import { createHash } from 'node:crypto';
import { AdapterRequestSchema, AdapterResultSchema, AdapterCapabilitiesSchema, JobSchema,
  type AdapterRequest, type AdapterResult, type GenerationAdapter, type Job, type ModelOperation } from '@fbr/contracts';
import { validateModelRequest } from './validation.js';
import { getPipelineCatalog } from './catalog.js';

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') return `{${Object.entries(value).sort(([a],[b]) => a.localeCompare(b)).map(([key,item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  return JSON.stringify(value);
}
const fingerprint = (request: AdapterRequest) => createHash('sha256').update(canonical(request)).digest('hex');
const field = (name: string, type: 'string'|'integer'|'boolean', required = true) =>
  ({ name,type,required,nullable:false,minimum:null,maximum:null,choices:[] });

export function simulatedModel(operation: AdapterRequest['operation']): ModelOperation {
  const documented = getPipelineCatalog().models.find(m => m.id === ({ image:'hf_soul_standard_image', animation:'hf_seedance2_image_animation', avatar:'heygen_audio_avatar', audio:'heygen_official_voice', render:'' }[operation]));
  return { id: `sim_${operation}`, provider:'simulation', model:`fixture_${operation}`, operation,
    route: operation === 'image' ? 'still_image' : operation === 'animation' ? 'animated_scene' : operation === 'avatar' ? 'avatar' : null,
    documentation:'schema_reviewed', documentation_url:null, reviewed_on:'2026-10-04', account_access:'unverified', runtime:'simulated',
    official_audio: operation === 'avatar' ? 'supported' : 'unsupported', references: operation === 'image' ? 'unsupported' : 'supported', composition:'unsupported',
    minimum_seconds: documented?.minimum_seconds ?? null, maximum_seconds: documented?.maximum_seconds ?? null,
    parameters: operation === 'audio' ? [field('text','string'),field('voice_reference','string')]
      : operation === 'render' ? [field('timeline_id','string')] : documented?.parameters ?? [],
    required_inputs: operation === 'audio' ? [] : operation === 'render' ? ['timeline'] : documented?.required_inputs ?? [],
    evidence_refs: [], notes:['Simulação em memória; não produz arquivo, aprovação, custo nem evidência audiovisual.'],
  };
}

/** Exercita o ciclo do port sem SDK/rede, armazenamento de mídia ou efeitos externos. */
export class SimulatedGenerationAdapter implements GenerationAdapter {
  private readonly jobs = new Map<string,{ job: Job; fingerprint: string }>();
  private readonly executions = new Map<string,string>();
  private readonly model: ModelOperation;
  constructor(operation: AdapterRequest['operation']) { this.model = simulatedModel(operation); }
  async capabilities() {
    return AdapterCapabilitiesSchema.parse({ adapter_id:this.model.id,mode:'simulated',version:'0.1.0',operations:[this.model.operation],
      routes:this.model.route ? [this.model.route] : [], accepts_official_audio:this.model.official_audio === 'supported', produces_audio:this.model.operation === 'audio',
      accepts_references:this.model.references === 'supported',accepts_composition:false,can_query_job:true,can_cancel_job:true,
      max_clip_seconds:this.model.maximum_seconds,supported_fields:this.model.parameters.map(r => r.name),evidence_refs:[] });
  }
  private blocked(code: 'validation'|'conflict'|'not_found'|'capability_missing', message: string, issues: ReturnType<typeof validateModelRequest> = []): AdapterResult {
    return AdapterResultSchema.parse({outcome:'blocked',error:{code,message,retryable:false,correlation_id:'simulation',issues}});
  }
  private result(job: Job): AdapterResult { return AdapterResultSchema.parse({ outcome:'accepted',job }); }
  async submit(raw: AdapterRequest): Promise<AdapterResult> {
    const parsed = AdapterRequestSchema.safeParse(raw);
    if (!parsed.success) return this.blocked('validation','Requisição inválida.');
    const request = parsed.data;
    const issues = validateModelRequest(this.model,request);
    if (issues.length) return this.blocked('capability_missing','A simulação não aceita esta configuração.',issues);
    const key = `${request.execution_key}:${request.attempt}`;
    const digest = fingerprint(request);
    const existingId = this.executions.get(key);
    const existing = existingId && this.jobs.get(existingId);
    if (existing) return existing.fingerprint === digest ? this.result(existing.job) : this.blocked('conflict','Chave de execução reutilizada com requisição diferente.');
    const id = `sim_${this.model.operation}_${createHash('sha256').update(key).digest('hex').slice(0,24)}`;
    const at = new Date().toISOString();
    const job = JobSchema.parse({id,version:1,created_at:at,author:'simulator',changes:[{at,author:'simulator',reason:'Simulação sem mídia nem custo.'}],
      status:'queued',production:request.production,stage:request.operation,provider:'simulation',model:this.model.model,external_job_id:id,
      execution_key:request.execution_key,attempt:request.attempt,inputs:request.input_assets,configuration_hash:request.configuration_hash,
      sent_parameters:request.parameters,unsupported_fields:[],output_assets:[],costs:{currency:request.currency,estimated_minor:0,committed_minor:0,confirmed_minor:0},error:null });
    this.executions.set(key,id); this.jobs.set(id,{ job,fingerprint:digest });
    return this.result(job);
  }
  async query(id: string): Promise<AdapterResult> {
    const entry = this.jobs.get(id);
    if (!entry) return this.blocked('not_found','Job simulado não encontrado.');
    if (entry.job.status === 'queued' || entry.job.status === 'running') this.transition(entry,entry.job.status === 'queued' ? 'running' : 'succeeded');
    return this.result(entry.job);
  }
  async cancel(id: string): Promise<AdapterResult> {
    const entry = this.jobs.get(id);
    if (!entry) return this.blocked('not_found','Job simulado não encontrado.');
    if (entry.job.status === 'cancelled') return this.result(entry.job);
    if (entry.job.status !== 'queued') return this.blocked('conflict','Cancelamento somente enquanto o job está na fila.');
    this.transition(entry,'cancelled');
    return this.result(entry.job);
  }
  private transition(entry: {job: Job}, status: Job['status']) {
    const at = new Date().toISOString();
    entry.job = JobSchema.parse({...entry.job,version:entry.job.version+1,status,created_at:at,
      changes:[...entry.job.changes,{at,author:'simulator',reason:`Simulação: ${status}; nenhum arquivo gerado.`}]});
  }
}

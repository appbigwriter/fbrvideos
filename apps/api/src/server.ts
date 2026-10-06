import { PostgresDatabase, PostgresConfigurationStore, PostgresProductionStore, PostgresGenerationQueue, CodexOAuthInference,PostgresInferenceJournal, LocalImmutableAssetStore, PostgresReviewWorkflow,operationalState,loadProviderRuntime } from '@fbr/infra';
import { ConfigurationService, ProductionService } from '@fbr/domain';
import { buildApp } from './app.js';
import { getPipelineCatalog, AutomaticPlanner,SemanticPlanner } from '@fbr/pipeline';

const host = process.env.API_HOST ?? '127.0.0.1';
const local=['127.0.0.1','localhost'].includes(host),accessToken=process.env.FBR_OPERATOR_ACCESS_TOKEN;
const allowedHosts=process.env.FBR_ALLOWED_HOSTS?.split(',').map(value=>value.trim()).filter(Boolean);
const allowedOrigins=process.env.FBR_ALLOWED_ORIGINS?.split(',').map(value=>value.trim()).filter(Boolean);
if(!local&&(!accessToken||accessToken.length<32||!allowedHosts?.length||!allowedOrigins?.length||allowedOrigins.some(value=>!value.startsWith('https://'))))
  throw new Error('Acesso remoto exige chave de operador, hosts/origens explícitos e proxy HTTPS.');
if (!process.env.DATABASE_URL) throw new Error('Defina DATABASE_URL no servidor e execute db:migrate antes de iniciar a API.');
const database = new PostgresDatabase(process.env.DATABASE_URL);
await database.query('SELECT 1 FROM configuration_heads LIMIT 1');
const productions=new ProductionService(new PostgresProductionStore(database),getPipelineCatalog());
const mode=process.env.FBR_PLANNER??'extractive';
if(!['extractive','codex_oauth'].includes(mode))throw new Error('FBR_PLANNER inválido.');
if(mode==='codex_oauth'&&!process.env.FBR_CODEX_EXECUTABLE)throw new Error('Defina FBR_CODEX_EXECUTABLE para o executável nativo Codex com login ChatGPT.');
if(mode==='codex_oauth')await database.query('SELECT 1 FROM planning_inferences LIMIT 1');
const inference=mode==='codex_oauth'?new CodexOAuthInference(process.env.FBR_CODEX_EXECUTABLE!):null;
const planner=new AutomaticPlanner(productions,inference
  ?new SemanticPlanner(inference,new PostgresInferenceJournal(database),async ref=>{
    const current=await productions.store.get(ref.id);return current?.status==='preparing'&&current.version===ref.version;
  }):null);
const defaultFiles=new LocalImmutableAssetStore(process.env.FBR_ASSET_ROOT??'var/assets');
const providers=await loadProviderRuntime(process.env.FBR_PROVIDER_BINDINGS_MODULE,{db:database,files:defaultFiles}),files=providers?.files??defaultFiles;
const app = buildApp(new ConfigurationService(new PostgresConfigurationStore(database)), {productions,planner,generation:new PostgresGenerationQueue(database,providers?.admission.bind(providers)),review:new PostgresReviewWorkflow(database,files,providers?.admission.bind(providers)),operationalState:()=>operationalState(database),
  ...(providers?.prepareCorrection?{prepareCorrection:providers.prepareCorrection.bind(providers)}:{}),
  ...(accessToken?{accessToken,secureCookie:!local}:{}),...(allowedHosts?.length?{allowedHosts}:{}),...(allowedOrigins?.length?{allowedOrigins}:{})});
let recovering=false;
const recover=async()=>{if(recovering)return;recovering=true;try{await planner.recover();}catch{app.log.error('Recuperação de planejamento pendente.');}finally{recovering=false;}};
const recoveryTimer=setInterval(()=>void recover(),5000);recoveryTimer.unref();
app.addHook('onClose', async () => {clearInterval(recoveryTimer);inference?.close();await planner.waitForIdle();await database.close();});
await app.listen({ host, port: Number(process.env.API_PORT ?? 3001) });
console.log('API FBR disponível localmente na porta ' + (process.env.API_PORT ?? 3001));
void recover();
for (const signal of ['SIGINT','SIGTERM'] as const) process.once(signal, () => { void app.close(); });

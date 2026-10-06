import { PostgresDatabase, PostgresGenerationQueue, GenerationTransport,LocalImmutableAssetStore,loadProviderRuntime } from '@fbr/infra';
import { SimulatedGenerationAdapter } from '@fbr/pipeline';
import type { GenerationAdapter } from '@fbr/contracts';

if (!process.env.DATABASE_URL) throw new Error('Defina DATABASE_URL e execute db:migrate antes de iniciar o worker.');
const mode=process.env.FBR_GENERATION_MODE;
if (!['simulated','provisioned'].includes(mode??'')) throw new Error('Selecione FBR_GENERATION_MODE=simulated ou provisioned com bindings explícitos.');
const db = new PostgresDatabase(process.env.DATABASE_URL),defaultFiles=new LocalImmutableAssetStore(process.env.FBR_ASSET_ROOT??'var/assets');
const providers=mode==='provisioned'?await loadProviderRuntime(process.env.FBR_PROVIDER_BINDINGS_MODULE,{db,files:defaultFiles}):null;
if(mode==='provisioned'&&!providers)throw new Error('Modo provisioned exige FBR_PROVIDER_BINDINGS_MODULE.');
const queue=new PostgresGenerationQueue(db,providers?.admission.bind(providers));
const adapters = new Map<string, GenerationAdapter>();
if(providers)for(const [id,adapter]of providers.adapters)adapters.set(id,adapter);
else for (const operation of ['audio', 'image', 'animation', 'avatar', 'render'] as const)adapters.set(`sim_${operation}`, new SimulatedGenerationAdapter(operation));
const transport = new GenerationTransport(process.env.DATABASE_URL, db, queue, adapters,'pgboss',undefined,providers?.admitReal.bind(providers),providers?.advance?.bind(providers));
await transport.start();
let dispatching = false;
const dispatch = async () => {
  if (dispatching) return;
  dispatching = true;
  try { await transport.dispatchPending(); }
  catch { console.error('Despacho pendente; nenhuma intenção foi descartada.'); }
  finally { dispatching = false; }
};
const timer = setInterval(() => void dispatch(), 5000);
void dispatch();
let closing = false;
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => {
  if (closing) return; closing = true; clearInterval(timer);
  void transport.stop().finally(() => db.close());
});
console.log(mode==='simulated'?'Worker pg-boss iniciado em simulação; nenhum fornecedor pago habilitado.':'Worker provisionado; execução condicionada às políticas server-side.');

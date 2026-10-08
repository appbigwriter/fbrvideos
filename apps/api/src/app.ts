import Fastify,{type FastifyReply} from 'fastify';
import { z } from 'zod';
import {OperatorAccess} from './access.js';
import { CONTRACT_VERSION, EntityKindSchema, IdSchema, ArticleSchema, CharacterSchema, ReferenceSchema, ProfileSchema,
  ArticleListSchema, ArticleFilterOptionsSchema, UniverseSchema, ProfilesSchema, ErrorSchema, type Article, type EntityKind } from '@fbr/contracts';
import { ApplicationError, ConfigurationService, articleEligibility, ProductionService } from '@fbr/domain';
import { captureArticle,OperationalTelemetry,parseMediaRange, type PostgresReviewWorkflow,type ProductionPipeline,type CalibrationService,type PostgresBudgetWorkflow } from '@fbr/infra';
import { getPipelineCatalog, checkAudiovisualConfiguration, AutomaticPlanner } from '@fbr/pipeline';
import { AudiovisualCheckRequestSchema, ProductionsListSchema, ProductionSchema, GenerationListSchema,
  ReviewViewSchema, ReviewPointSchema, DeliveryViewSchema, CorrectionSchema, RenderHistorySchema,SpeechEditViewSchema,
  type GenerationQueue, type Character, type Profile, type Reference } from '@fbr/contracts';

const pagination = z.strictObject({ q: z.string().max(300).optional(), source_author: z.string().max(300).optional(),
  character_id: IdSchema.optional(), status: ArticleSchema.shape.status.optional(),
  offset: z.coerce.number().int().min(0).default(0), limit: z.coerce.number().int().min(1).max(100).default(25) });
const versionQuery = z.strictObject({ version: z.coerce.number().int().positive().optional() });
const routeParams = z.strictObject({ id: IdSchema });
const schemas = { articles: ArticleSchema, characters: CharacterSchema, references: ReferenceSchema, profiles: ProfileSchema };

export function buildApp(service: ConfigurationService, options: { capture?: typeof captureArticle; allowedOrigins?: string[];allowedHosts?:string[];accessToken?:string;secureCookie?:boolean; productions?: ProductionService; planner?: AutomaticPlanner; generation?: GenerationQueue; review?: PostgresReviewWorkflow;operationalState?:()=>Promise<unknown>;prepareCorrection?:(id:string)=>Promise<void>;pipeline?:ProductionPipeline;calibration?:CalibrationService;readiness?:()=>Promise<unknown>;retentionPlan?:()=>Promise<unknown>;budget?:PostgresBudgetWorkflow;providerCallback?:import('@fbr/infra').ProviderRuntime['receiveCallback'];recordTelemetry?:(snapshot:ReturnType<OperationalTelemetry['snapshot']>)=>Promise<unknown>;operationalHistory?:()=>Promise<unknown> } = {}) {
  const app = Fastify({ logger: false, bodyLimit: 1_000_000 });
  const allowedOrigins = options.allowedOrigins ?? ['http://127.0.0.1:5173','http://localhost:5173'];
  const telemetry=new OperationalTelemetry();
  if(options.recordTelemetry){const metricsTimer=setInterval(()=>{void options.recordTelemetry!(telemetry.snapshot()).catch(()=>{});},60000);metricsTimer.unref();app.addHook('onClose',async()=>{clearInterval(metricsTimer);});}
  if(options.operationalHistory)app.get('/api/operations/history',async()=>options.operationalHistory!());
  const access=options.accessToken?new OperatorAccess(options.accessToken,options.secureCookie??true):null;
  const allowedHosts=options.allowedHosts??['localhost','127.0.0.1'];
  app.addHook('onResponse',async(request,reply)=>{telemetry.observe(request.method,request.routeOptions.url??'unmatched',reply.statusCode,reply.elapsedTime);});
  app.get('/api/operations',async()=>({http:telemetry.snapshot(),...(options.operationalState?{runtime:await options.operationalState()}: {})}));
  app.addHook('onRequest', async (request, reply) => {
    const host = request.headers.host?.split(':')[0]?.toLowerCase();
    if (!host||!allowedHosts.includes(host)) return reply.code(403).send({ message: 'Host não permitido.' });
    if (request.headers.origin && !allowedOrigins.includes(request.headers.origin)) return reply.code(403).send({ message: 'Origem não permitida.' });
    if (request.headers.origin) reply.header('Access-Control-Allow-Origin', request.headers.origin).header('Access-Control-Allow-Credentials','true').header('Vary', 'Origin');
    if (request.method === 'OPTIONS') return reply.header('Access-Control-Allow-Methods','GET,POST,OPTIONS')
      .header('Access-Control-Allow-Headers','Content-Type,Authorization').code(204).send();
    if(request.headers['sec-fetch-site']==='cross-site'&&request.method!=='GET')return reply.code(403).send({message:'Origem não permitida.'});
    const publicSession=request.url==='/api/session'&&['GET','POST'].includes(request.method);
    const callback=options.providerCallback&&request.method==='POST'&&/^\/api\/provider-callbacks\/[\w.:-]+$/.test(request.url);
    if(access&&!publicSession&&!callback&&request.url!=='/health'&&!access.authenticated(request.headers.authorization,request.headers.cookie))
      return reply.code(401).header('Cache-Control','no-store').send({message:'Autentique-se para acessar esta instalação.'});
  });
  app.get('/api/session',async(request,reply)=>reply.header('Cache-Control','no-store').send({required:!!access,authenticated:!access||access.authenticated(request.headers.authorization,request.headers.cookie)}));
  app.post('/api/session',async(request,reply)=>{
    const {token}=z.strictObject({token:z.string().min(1).max(1024)}).parse(request.body);
    if(!access)return reply.code(400).send({message:'Esta instalação local não exige autenticação.'});
    const cookie=access.login(token,request.ip);if(!cookie)return reply.code(401).send({message:'Acesso não autorizado. Confira a chave ou aguarde antes de tentar novamente.'});
    return reply.header('Cache-Control','no-store').header('Set-Cookie',cookie).send({authenticated:true});
  });
  app.post('/api/session/logout',async(request,reply)=>reply.header('Cache-Control','no-store').header('Set-Cookie',access?.logout(request.headers.cookie)??'').send({authenticated:false}));
  app.setErrorHandler((error, request, reply) => {
    const parserError = error instanceof Error && 'code' in error && typeof error.code === 'string'
      && ['FST_ERR_CTP_INVALID_JSON_BODY','FST_ERR_CTP_INVALID_MEDIA_TYPE','FST_ERR_CTP_EMPTY_JSON_BODY','FST_ERR_CTP_BODY_TOO_LARGE'].includes(error.code);
    const code = error instanceof z.ZodError || parserError ? 'validation' : error instanceof ApplicationError ? error.code : 'internal';
    const status = parserError && error.code === 'FST_ERR_CTP_BODY_TOO_LARGE' ? 413
      : { validation: 400, not_found: 404, conflict: 409, ineligible: 422, attempts_exceeded: 422,
        provider_unknown: 409, budget_exceeded: 422, internal: 500 }[code];
    const message = error instanceof z.ZodError || parserError ? 'Dados inválidos. Confira os campos e o tamanho do conteúdo.'
      : error instanceof ApplicationError ? error.message : 'Não foi possível concluir a operação.';
    reply.code(status).send(ErrorSchema.parse({ code, message, retryable: false, correlation_id: `request_${request.id}`, issues: [] }));
  });
  app.get('/health', async () => ({ status: 'ok', contract_version: CONTRACT_VERSION }));
  if(options.readiness)app.get('/api/readiness',async()=>options.readiness!());
  app.get('/api/productions/:id/generation/status',async request=>{const{id}=routeParams.parse(request.params);if(options.productions)await options.productions.detail(id);return{configured:!!options.pipeline,reason:options.pipeline?null:'Conexões de geração não configuradas nesta instalação.'};});
  if(!options.pipeline)app.post('/api/productions/:id/generation/start',async()=>{throw new ApplicationError('ineligible','Conexões de geração não configuradas. Conferir a configuração da instalação antes de iniciar mídia.');});
  if(options.providerCallback)app.post('/api/provider-callbacks/:adapterId',async(request,reply)=>{const{adapterId}=z.strictObject({adapterId:IdSchema}).parse(request.params);try{return await options.providerCallback!(adapterId,request.body,request.headers);}catch{return reply.code(401).send({message:'Callback não autenticado ou incompatível.'});}});
  if(options.budget)app.post('/api/productions/:id/budget',async request=>{const{id}=routeParams.parse(request.params);const body=z.object({production:routeParams.passthrough()}).passthrough().parse(request.body);if(body.production.id!==id)throw new ApplicationError('validation','Orçamento aponta para outra produção.');return options.budget!.revise(request.body);});
  if(options.retentionPlan)app.get('/api/retention/plan',async()=>options.retentionPlan!());
  if(options.calibration){const calibration=options.calibration;
    const evidenceAction=async<T>(run:()=>Promise<T>)=>{try{return await run();}catch(error){if(error instanceof z.ZodError)throw error;throw new ApplicationError('ineligible','Evidência de calibração incompatível, insuficiente ou alterada.');}};
    app.get('/api/calibration/reports',async request=>{const query=z.strictObject({profile_id:IdSchema,profile_version:z.coerce.number().int().positive(),minimum_samples:z.coerce.number().int().min(1).max(10000),approval_rate:z.coerce.number().min(0).max(1)}).parse(request.query);
      return evidenceAction(()=>calibration.report({id:query.profile_id,version:query.profile_version},{minimum_samples:query.minimum_samples,approval_rate:query.approval_rate}));});
    app.post('/api/calibration/observations',async request=>evidenceAction(()=>calibration.append(request.body)));
    app.post('/api/calibration/decisions',async request=>evidenceAction(()=>calibration.decide(request.body)));
  }
  if(options.pipeline){const pipeline=options.pipeline;
    const pipelineCommand=(id:string,raw:unknown)=>{const parsed=z.object({production:z.object({id:IdSchema})}).passthrough().parse(raw);if(parsed.production.id!==id)throw new ApplicationError('validation','Comando aponta para outra produção.');return raw;};
    app.post('/api/productions/:id/generation/start',async request=>{const{id}=routeParams.parse(request.params);return pipeline.start(pipelineCommand(id,request.body));});
    app.get('/api/productions/:id/candidates',async request=>pipeline.candidates(routeParams.parse(request.params).id));
    app.get('/api/productions/:id/assembly',async request=>pipeline.assemblyStatus(routeParams.parse(request.params).id));
    app.post('/api/productions/:id/candidates/evaluate',async request=>{const{id}=routeParams.parse(request.params);return pipeline.evaluate(pipelineCommand(id,request.body));});
    app.post('/api/productions/:id/candidates/retry',async request=>{const{id}=routeParams.parse(request.params);return pipeline.retry(pipelineCommand(id,request.body));});
    app.post('/api/productions/:id/jobs/retry',async request=>{const{id}=routeParams.parse(request.params);return pipeline.retry(pipelineCommand(id,request.body));});
    app.post('/api/productions/:id/jobs/cancel-pending',async request=>{const{id}=routeParams.parse(request.params);return pipeline.cancelPending(pipelineCommand(id,request.body));});
    app.post('/api/productions/:id/jobs/refresh-quote',async request=>{const{id}=routeParams.parse(request.params);return pipeline.refreshQuote(pipelineCommand(id,request.body));});
    app.get('/api/productions/:id/candidates/:assetId',async(request,reply)=>{
      const{id,assetId}=z.strictObject({id:IdSchema,assetId:IdSchema}).parse(request.params),query=z.strictObject({version:z.coerce.number().int().positive()}).parse(request.query);
      const asset=await pipeline.candidateFile(id,{id:assetId,version:query.version});reply.header('Cache-Control','private, no-store').header('X-Content-Type-Options','nosniff').type(asset.mime_type).header('Accept-Ranges','bytes');
      let range;try{range=parseMediaRange(request.headers.range,asset.bytes.length);}catch{return reply.code(416).header('Content-Range',`bytes */${asset.bytes.length}`).send();}
      return range?reply.code(206).header('Content-Range',`bytes ${range.start}-${range.end}/${asset.bytes.length}`).send(Buffer.from(asset.bytes.subarray(range.start,range.end+1))):reply.send(Buffer.from(asset.bytes));
    });
  }
  if(options.review) {
    const review=options.review;
    const sendMedia=async(reply:FastifyReply,open:()=>ReturnType<PostgresReviewWorkflow['openCurrentAsset']>,downloadName?:string)=>{
      try{const file=await open();reply.header('Cache-Control','private, no-store').header('X-Content-Type-Options','nosniff').header('Accept-Ranges','bytes').type(file.mime_type);
        if(downloadName){const extension=file.mime_type==='text/vtt'?'vtt':file.mime_type==='application/x-subrip'?'srt':'mp4';reply.header('Content-Disposition',`attachment; filename="${downloadName}.${extension}"`);}
        if(file.range)reply.code(206).header('Content-Range',`bytes ${file.range.start}-${file.range.end}/${file.total_bytes}`);
        reply.header('Content-Length',file.range?file.range.end-file.range.start+1:file.total_bytes);
        return reply.send('stream' in file?file.stream:Buffer.from(file.bytes));
      }catch(error){if(error instanceof Error&&error.message==='media_range_unsatisfiable'&&'total_bytes' in error)return reply.code(416).header('Content-Range',`bytes */${error.total_bytes}`).send();throw error;}
    };
    const ownCommand=(id:string,raw:unknown)=>{
      const parsed=z.object({production:z.object({id:IdSchema})}).passthrough().parse(raw);
      if(parsed.production.id!==id) throw new ApplicationError('validation','Comando aponta para outra produção.');
      return raw;
    };
    app.get('/api/productions/:id/review',async request=>ReviewViewSchema.parse(await review.review(routeParams.parse(request.params).id)));
    app.post('/api/productions/:id/planning/approve',async request=>{
      const {id}=routeParams.parse(request.params);return ProductionSchema.parse(await review.approvePlanning(ownCommand(id,request.body)));
    });
    app.get('/api/productions/:id/review/history',async request=>RenderHistorySchema.parse(await review.history(routeParams.parse(request.params).id)));
    app.get('/api/productions/:id/review/speeches',async request=>SpeechEditViewSchema.parse(await review.speechEditView(routeParams.parse(request.params).id)));
    app.post('/api/productions/:id/review/speeches',async request=>{
      const {id}=routeParams.parse(request.params);const edited=ProductionSchema.parse(await review.editSpeech(ownCommand(id,request.body)));
      if(options.prepareCorrection)void options.prepareCorrection(id).catch(()=>app.log.error('Estimativa da correção pendente; plano não executado.'));return edited;
    });
    app.get('/api/productions/:id/review/history/:version/video',async(request,reply)=>{
      const {id,version}=z.strictObject({id:IdSchema,version:z.coerce.number().int().positive()}).parse(request.params);
      return sendMedia(reply,()=>review.openHistoricalAsset(id,version,request.headers.range));
    });
    app.post('/api/productions/:id/review/points',async request=>{
      const {id}=routeParams.parse(request.params); return ReviewPointSchema.parse(await review.addPoint(ownCommand(id,request.body)));
    });
    app.post('/api/productions/:id/review/resolve',async request=>{
      const {id}=routeParams.parse(request.params); return ReviewPointSchema.parse(await review.resolvePoint(ownCommand(id,request.body)));
    });
    app.post('/api/productions/:id/review/approve',async request=>{
      const {id}=routeParams.parse(request.params); return ProductionSchema.parse(await review.approve(ownCommand(id,request.body)));
    });
    app.post('/api/productions/:id/review/corrections',async request=>{
      const {id}=routeParams.parse(request.params);const correction=CorrectionSchema.parse(await review.proposeCorrection(ownCommand(id,request.body)));
      if(options.prepareCorrection)void options.prepareCorrection(id).catch(()=>app.log.error('Estimativa da correção pendente; plano não executado.'));return correction;
    });
    app.post('/api/productions/:id/review/corrections/cancel',async request=>{
      const {id}=routeParams.parse(request.params);return CorrectionSchema.parse(await review.cancelCorrection(ownCommand(id,request.body)));
    });
    app.post('/api/productions/:id/review/corrections/authorize',async request=>{
      const {id}=routeParams.parse(request.params);return CorrectionSchema.parse(await review.authorizeCorrection(ownCommand(id,request.body)));
    });
    app.post('/api/productions/:id/review/corrections/execute',async request=>{
      const {id}=routeParams.parse(request.params);const result=CorrectionSchema.parse(await review.executeCorrection(ownCommand(id,request.body)));
      if(options.pipeline)await options.pipeline.advance(id);return result;
    });
    app.get('/api/productions/:id/delivery',async request=>DeliveryViewSchema.parse(await review.delivery(routeParams.parse(request.params).id)));
    app.post('/api/productions/:id/delivery/export',async request=>{
      const {id}=routeParams.parse(request.params); return ProductionSchema.parse(await review.export(ownCommand(id,request.body)));
    });
    app.get('/api/productions/:id/assets/:assetId',async(request,reply)=>{
      const {id,assetId}=z.strictObject({id:IdSchema,assetId:IdSchema}).parse(request.params);
      const query=z.strictObject({version:z.coerce.number().int().positive(),download:z.literal('1').optional()}).parse(request.query);
      return sendMedia(reply,()=>review.openCurrentAsset(id,{id:assetId,version:query.version},request.headers.range),query.download?`${assetId}-v${query.version}`:undefined);
    });
    app.get('/api/productions/:id/manifests/:manifestId',async(request,reply)=>{
      const {id,manifestId}=z.strictObject({id:IdSchema,manifestId:IdSchema}).parse(request.params);
      const bytes=await review.manifest(id,manifestId);
      return reply.header('Cache-Control','private, no-store').header('X-Content-Type-Options','nosniff')
        .header('Content-Disposition',`attachment; filename="${manifestId}.json"`).type('application/json').send(Buffer.from(bytes));
    });
  }
  if (options.productions) {
    const productions = options.productions;
    app.get('/api/productions/:id/jobs', async request => {
      const { id } = routeParams.parse(request.params);
      await productions.detail(id);
      const jobs = options.generation ? await options.generation.list(id) : [];
      return GenerationListSchema.parse({ items: jobs.map(job => ({ ref: { id: job.id, version: job.version },
        production: job.intent.request.production, operation: job.intent.request.operation, state: job.state,
        attempt: job.intent.request.attempt, simulated: job.intent.adapter_id.startsWith('sim_'),
        costs: { currency: job.intent.request.currency, estimated_minor: job.intent.estimate.upper_minor,
          committed_minor: job.reserved_minor, confirmed_minor: job.confirmed_minor },
        message: job.state === 'unknown' ? 'Resultado ou custo incerto; a reserva foi conservada. Reconciliar antes de novos gastos.' : null })) });
    });
    const schedule=async(id:string)=>{
      if(!options.planner)return;
      if(options.planner.background){void options.planner.run(id).catch(()=>app.log.error('Falha técnica no planejamento; verificar estado persistido.'));}
      else await options.planner.run(id);
    };
    app.get('/api/productions',async () => ProductionsListSchema.parse({items:await productions.store.list()}));
    app.post('/api/productions',async (request,reply) => {
      const created=await productions.create(request.body);
      await schedule(created.id);
      return reply.code(201).send(ProductionSchema.parse((await productions.detail(created.id)).production));
    });
    app.get('/api/productions/:id',async request => { const {id} = routeParams.parse(request.params); const {version} = versionQuery.parse(request.query); return productions.detail(id,version); });
    app.post('/api/productions/:id/commands',async request => {
      const {id} = routeParams.parse(request.params);
      const body = z.object({production:z.object({id:IdSchema})}).passthrough().parse(request.body);
      if (body.production.id !== id) throw new ApplicationError('validation','Comando aponta para outra produção.');
      const changed=await productions.command(request.body);
      if(changed.status==='cancelled'&&options.generation) {
        for(const job of await options.generation.list(id)) if(job.state==='prepared') await options.generation.cancelPrepared(job.id);
      }
      if(changed.status==='preparing')await schedule(id);
      return ProductionSchema.parse((await productions.detail(id)).production);
    });
  }
  app.get('/api/pipeline/catalog', async () => getPipelineCatalog());
  app.post('/api/profiles/:id/audiovisual-check', async request => {
    const { id } = routeParams.parse(request.params);
    const input = AudiovisualCheckRequestSchema.parse(request.body);
    const profile = await service.store.get('profiles', id,input.profile_version) as Profile | null;
    const article = await service.store.get('articles',input.article.id,input.article.version) as Article | null;
    if (!profile || !article) throw new ApplicationError('not_found','Artigo ou perfil na revisão solicitada não encontrado.');
    const character = await service.store.get('characters',profile.character.id,profile.character.version) as Character | null;
    const refs = [...profile.permitted_references,...(profile.voice ? [profile.voice] : []),...(character?.references ?? [])];
    const references = (await Promise.all(refs.map(ref => service.store.get('references',ref.id,ref.version))))
      .filter((ref): ref is Reference => ref !== null && 'kind' in ref);
    return checkAudiovisualConfiguration({article,profile,character,references,mode:input.mode,article_class:input.article_class,
      format:input.format,model_operations:input.model_operations},getPipelineCatalog());
  });
  app.get('/api/articles', async request => {
    const query = pagination.parse(request.query);
    const items = (await service.store.list('articles') as Article[]).filter(article =>
      (!query.q || `${article.title} ${article.content}`.toLocaleLowerCase().includes(query.q.toLocaleLowerCase()))
      && (!query.source_author || article.source_author === query.source_author)
      && (!query.character_id || article.character?.id === query.character_id)
      && (!query.status || article.status === query.status))
      .sort((a,b) => b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id));
    return ArticleListSchema.parse({ total: items.length, offset: query.offset, limit: query.limit,
      items: items.slice(query.offset, query.offset + query.limit).map(article => ({ article, eligibility: articleEligibility(article), needs_capture_review: !article.complete })) });
  });
  app.get('/api/articles/filter-options',async()=>ArticleFilterOptionsSchema.parse({authors:[...new Set((await service.store.list('articles') as Article[]).map(a=>a.source_author))].sort((a,b)=>a.localeCompare(b))}));
  app.get('/api/universe', async () => UniverseSchema.parse({ characters: await service.store.list('characters'), references: await service.store.list('references') }));
  app.get('/api/profiles', async () => ProfilesSchema.parse({ items: await service.store.list('profiles') }));
  app.get('/api/profiles/:id/universe',async request=>{
    const {id}=routeParams.parse(request.params);const {version}=versionQuery.parse(request.query);
    const profile=await service.store.get('profiles',id,version) as Profile|null;
    if(!profile)throw new ApplicationError('not_found','Perfil na revisão solicitada não encontrado.');
    const characters=await service.store.list('characters') as Character[];
    const references=await service.store.list('references') as Reference[];
    const character=await service.store.get('characters',profile.character.id,profile.character.version) as Character|null;
    if(character&&!characters.some(c=>c.id===character.id&&c.version===character.version))characters.push(character);
    for(const ref of [...profile.permitted_references,...(profile.voice?[profile.voice]:[])]){
      const record=await service.store.get('references',ref.id,ref.version) as Reference|null;
      if(record&&!references.some(r=>r.id===record.id&&r.version===record.version))references.push(record);
    }
    return UniverseSchema.parse({characters,references});
  });
  app.get('/api/characters', async () => ({ items: (await service.store.list('characters')).map(record => CharacterSchema.parse(record)) }));
  app.get('/api/references', async () => ({ items: (await service.store.list('references')).map(record => ReferenceSchema.parse(record)) }));
  app.post('/api/articles/import-url', async (request,reply) => reply.code(201).send(ArticleSchema.parse(await service.importUrl(request.body, options.capture ?? captureArticle))));
  app.post('/api/articles/:id/refresh', async request => {
    const { id } = routeParams.parse(request.params);
    return ArticleSchema.parse(await service.importUrl(request.body, options.capture ?? captureArticle, id));
  });
  app.get('/api/bibles/:hash', async (request,reply) => {
    const { hash } = z.strictObject({ hash: z.string().regex(/^[a-f0-9]{64}$/) }).parse(request.params);
    const original = await service.store.bible(hash);
    if (original === null) throw new ApplicationError('not_found', 'Bible não encontrado.');
    return reply.header('Content-Type', 'text/plain; charset=utf-8').header('X-Content-Type-Options', 'nosniff').send(original);
  });
  for (const kind of EntityKindSchema.options) {
    app.get(`/api/${kind}/:id`, async request => {
      const { id } = routeParams.parse(request.params);
      const { version } = versionQuery.parse(request.query);
      const record = await service.store.get(kind, id, version);
      if (!record) throw new ApplicationError('not_found', 'Registro ou revisão não encontrado.');
      return schemas[kind].parse(record);
    });
    app.post(`/api/${kind}`, async (request,reply) => reply.code(201).send(schemas[kind].parse(await service.save(kind,request.body))));
    app.post(`/api/${kind}/:id/revisions`, async request => {
      const { id } = routeParams.parse(request.params);
      return schemas[kind].parse(await service.save(kind as EntityKind,request.body,id));
    });
  }
  return app;
}

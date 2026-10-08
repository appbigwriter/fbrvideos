import { AdapterResultSchema, type GenerationAdapter, type GenerationQueue } from '@fbr/contracts';

export class GenerationWorker {
  constructor(private readonly queue: GenerationQueue, private readonly adapters: ReadonlyMap<string, GenerationAdapter>,
    private readonly admitReal?:(execution:NonNullable<Awaited<ReturnType<GenerationQueue['get']>>>)=>Promise<boolean>) {}
  async run(id: string) {
    const current = await this.queue.get(id);
    if (!current) throw new Error('generation_execution_not_found');
    const adapter = this.adapters.get(current.intent.adapter_id);
    if (!adapter) throw new Error('generation_adapter_missing');
    const capabilities = await adapter.capabilities();
    if (capabilities.adapter_id !== current.intent.adapter_id || (capabilities.mode==='real'&&(!capabilities.evidence_refs.length||!this.admitReal||!await this.admitReal(current))))
      throw new Error('generation_real_gate_pending');
    if (!capabilities.operations.includes(current.intent.request.operation) || !capabilities.can_query_job)
      throw new Error('generation_capability_missing');
    const found=current.state==='unknown'&&!current.provider_job?.external_job_id&&adapter.lookupReceipt
      ?await adapter.lookupReceipt(current.intent.request):null;
    const receipt=found?AdapterResultSchema.parse(found):null;
    if(receipt&&(receipt.outcome!=='accepted'||!receipt.job.external_job_id))throw new Error('generation_receipt_lookup_invalid');
    const recovery=current.state==='unknown'&&!current.provider_job?.external_job_id&&capabilities.supports_idempotent_recovery&&!!adapter.recover;
    const claimed = await this.queue.claim(id,60,recovery||!!receipt);
    if (!claimed?.lease_token) return claimed ?? current;
    const token = claimed.lease_token;
    try {
      const response = AdapterResultSchema.parse(receipt??(claimed.state === 'submitting'
        ? await adapter.submit(claimed.intent.request)
        : claimed.provider_job?.external_job_id ? await adapter.query(claimed.provider_job.external_job_id)
          : recovery&&adapter.recover?await adapter.recover(claimed.intent.request)
          : (() => { throw new Error('generation_external_id_missing'); })()));
      if (response.outcome === 'blocked') return await this.queue.uncertain(id, token, response.error.code);
      return await this.queue.complete(id, token, response.job);
    } catch (error) {
      // Não liberar reserva nem reenviar após exceção, timeout ou resultado incompatível.
      try { return await this.queue.uncertain(id, token, 'generation_provider_result_unknown'); }
      catch { throw error; }
    }
  }
  async reconcileCallback(id: string) {
    // Callback é apenas um sinal: a aplicação do resultado sempre usa consulta do adapter.
    return this.run(id);
  }
  async cancel(id: string) {
    const current = await this.queue.get(id);
    if (!current) throw new Error('generation_execution_not_found');
    if (current.state === 'prepared') return this.queue.cancelPrepared(id);
    // Consulta antes de cancelar: in_progress nunca recebe cancelamento queued fictício.
    const reconciled = await this.run(id);
    if (reconciled.provider_job?.status !== 'queued' || reconciled.state !== 'active') return reconciled;
    const adapter = this.adapters.get(reconciled.intent.adapter_id)!;
    if (!(await adapter.capabilities()).can_cancel_job) return reconciled;
    const claimed = await this.queue.claim(id);
    if (!claimed?.lease_token) return reconciled;
    const token = claimed.lease_token;
    try {
      const result = AdapterResultSchema.parse(await adapter.cancel(claimed.provider_job!.external_job_id!));
      if (result.outcome === 'blocked') return await this.queue.uncertain(id, token, result.error.code);
      return await this.queue.complete(id, token, result.job);
    } catch (error) {
      try { return await this.queue.uncertain(id, token, 'generation_cancel_result_unknown'); }
      catch { throw error; }
    }
  }
}

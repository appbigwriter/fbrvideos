import { useEffect, useRef, useState,useCallback } from 'react';
import type { z } from 'zod';

export async function api<T>(path: string,schema: z.ZodType<T>,body?: unknown,signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api${path}`,{...(body !== undefined ? {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)} : {}),...(signal ? {signal} : {})});
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('A API local não respondeu corretamente. Confira se ela está ativa e tente novamente.');
  const payload: unknown = await response.json();
  if(response.status===401)window.dispatchEvent(new Event('fbr-auth-required'));
  if (!response.ok) {
    const message = payload && typeof payload === 'object' && 'message' in payload && typeof payload.message === 'string' ? payload.message : 'A API não conseguiu concluir a operação.';
    throw new Error(message);
  }
  return schema.parse(payload);
}
export function useResource<T>(path: string|null,schema: z.ZodType<T>) {
  const [data,setData] = useState<T|null>(null),[error,setError] = useState<string|null>(null),[loading,setLoading] = useState(path !== null),[revision,setRevision] = useState(0);
  const quiet=useRef(false),previousPath=useRef(path);
  const reload=useCallback(()=>{quiet.current=false;setRevision(value=>value+1);},[]);
  const refresh=useCallback(()=>{quiet.current=true;setRevision(value=>value+1);},[]);
  useEffect(() => {
    const controller = new AbortController(),keep=quiet.current&&previousPath.current===path;quiet.current=false;previousPath.current=path;
    if(!keep)setData(null);setError(null);setLoading(path !== null&&!keep);
    if (path !== null) void api(path,schema,undefined,controller.signal).then(value => { if (!controller.signal.aborted) setData(value); })
      .catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Falha ao carregar dados.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  },[path,schema,revision]);
  return {data,error,loading,reload,refresh};
}
export function useCommand() {
  const [pending,setPending] = useState(false),[error,setError] = useState<string|null>(null);
  const intention = useRef<{fingerprint:string;id:string}|null>(null);
  const busy = useRef(false);
  async function run<T>(path: string,schema: z.ZodType<T>,payload: object,onSuccess:(value:T) => void) {
    if (busy.current) return;
    busy.current=true;setPending(true);setError(null);
    const fingerprint=JSON.stringify({path,payload});
    if (intention.current?.fingerprint !== fingerprint) intention.current={fingerprint,id:crypto.randomUUID()};
    try { const result=await api(path,schema,{...payload,command_id:intention.current.id});onSuccess(result);intention.current=null; }
    catch(e) { setError(e instanceof Error ? e.message : 'Não foi possível salvar.'); }
    finally {busy.current=false;setPending(false);}
  }
  return {pending,error,run};
}

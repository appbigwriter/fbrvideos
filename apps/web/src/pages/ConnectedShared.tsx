import type { ReactNode } from 'react';
import { AppShell } from '../components/AppShell.js';
import { PageHeader } from '../components/PageHeader.js';
export function Page({title,children}:{title:string;children:ReactNode}) { return <AppShell><div className="connected-page"><PageHeader title={title}/>{children}</div></AppShell>; }
export function ResourceState({loading,error,onRetry}:{loading:boolean;error:string|null;onRetry:()=>void}) {
  return <>{loading && <p role="status">Carregando…</p>}{error && <div role="alert"><p>{error}</p><button className="connected-button" type="button" onClick={onRetry}>Tentar novamente</button></div>}</>;
}
export const field = (id:string,label:string,disabled=false,help:string|null=null) => ({id,label,disabled,help,error:null,required:false});
export const refValue = (ref:{id:string;version:number}|null) => ref ? `${ref.id}:${ref.version}` : '';
export function parseRef(value:string) { const split=value.lastIndexOf(':'); return value ? {id:value.slice(0,split),version:Number(value.slice(split+1))} : null; }

import {z} from 'zod';
import {AdapterRequestSchema,type AdapterRequest,type ModelOperation} from '@fbr/contracts';
import {canonical,sha256} from '@fbr/domain';
import {validateModelRequest} from '@fbr/pipeline';
import {ProviderMediaTransfer} from './provider-media-transfer.js';
const origin='https://api.higgsfield.ai';
const decimal=z.string().regex(/^\d{1,9}(?:\.\d{1,6})?$/);
const ReceiptSchema=z.object({request_id:z.string().min(1).max(300),status:z.enum(['queued','in_progress','completed','failed','nsfw','canceled']),
  status_url:z.url(),cancel_url:z.url()});
export type HiggsfieldReceipt=z.infer<typeof ReceiptSchema>;
function providerUrl(raw:string){const url=new URL(raw,origin);if(url.origin!==origin||url.username||url.password||url.hash)throw new Error('higgsfield_origin_denied');return url;}
function modelPath(model:ModelOperation){
  if(!['image','animation'].includes(model.operation)||model.documentation!=='schema_reviewed'||!/^[-a-zA-Z0-9_]+(?:\/[-a-zA-Z0-9_.]+)+$/.test(model.model)
    ||model.model.split('/').some(part=>part==='..'||part==='.'))throw new Error('higgsfield_model_schema_required');
  return `/${model.model}`;
}
/** REST preparado sem habilitar conta/qualidade ou inferir câmbio/preço. Chamadas são feitas apenas pelo runtime liberado. */
export class HiggsfieldClient{
  constructor(private readonly key:()=>string,private readonly network:typeof fetch=fetch){}
  private async call(path:string,method:'GET'|'POST',body?:unknown,idempotencyKey?:string){
    const key=this.key();if(!key.trim()||/[\r\n]/.test(key))throw new Error('higgsfield_credential_missing');
    const headers=new Headers({Authorization:`Key ${key}`,Accept:'application/json'});
    if(body!==undefined)headers.set('Content-Type','application/json');if(idempotencyKey)headers.set('Idempotency-Key',idempotencyKey);
    const response=await this.network(providerUrl(path),{method,headers,redirect:'error',signal:AbortSignal.timeout(15000),...(body===undefined?{}:{body:canonical(body)})});
    if(!response.ok)throw new Error('higgsfield_http_failure');
    if(response.status===202&&body===undefined)return null;
    if(!response.headers.get('content-type')?.includes('application/json'))throw new Error('higgsfield_response_type_invalid');
    const reader=response.body?.getReader();if(!reader)throw new Error('higgsfield_response_empty');
    const chunks:Uint8Array[]=[];let size=0;
    try{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>1_000_000)throw new Error('higgsfield_response_too_large');chunks.push(part.value);}}
    finally{await reader.cancel();}
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  }
  async estimate(model:ModelOperation,raw:AdapterRequest){
    const request=AdapterRequestSchema.parse(raw);if(validateModelRequest(model,request).length)throw new Error('higgsfield_request_invalid');
    const quote=z.object({credits:decimal,usd:decimal}).parse(await this.call(`/estimate${modelPath(model)}`,'POST',request.parameters));
    const [whole,fraction='']=quote.usd.split('.'),denominator=10n**BigInt(fraction.length),numerator=BigInt(whole!)*denominator+BigInt(fraction||'0');
    const upperMinor=Number((numerator*100n+denominator-1n)/denominator);
    if(!Number.isSafeInteger(upperMinor))throw new Error('higgsfield_quote_out_of_range');
    return {currency:'USD' as const,upper_minor:upperMinor,credits:quote.credits,usd:quote.usd,request_hash:sha256(canonical({model:model.model,parameters:request.parameters})),
      quoted_at:new Date().toISOString(),evidence:'Estimativa autenticada em USD; arredondamento conservador para centavos. Não é cobrança nem conversão para BRL.'};
  }
  async submit(model:ModelOperation,raw:AdapterRequest){
    const request=AdapterRequestSchema.parse(raw);if(validateModelRequest(model,request).length)throw new Error('higgsfield_request_invalid');
    const receipt=ReceiptSchema.parse(await this.call(modelPath(model),'POST',request.parameters,`${request.execution_key}:${request.attempt}`));
    providerUrl(receipt.status_url);providerUrl(receipt.cancel_url);return receipt;
  }
  async status(raw:HiggsfieldReceipt){const receipt=ReceiptSchema.parse(raw);const result=await this.call(providerUrl(receipt.status_url).href,'GET');
    const status=z.object({request_id:z.string(),status:ReceiptSchema.shape.status}).passthrough().parse(result);
    if(status.request_id!==receipt.request_id)throw new Error('higgsfield_receipt_mismatch');return status;}
  async cancel(raw:HiggsfieldReceipt){const receipt=ReceiptSchema.parse(raw),before=await this.status(receipt);
    if(before.status!=='queued')return before;
    await this.call(providerUrl(receipt.cancel_url).href,'POST');return this.status(receipt);
  }
  async upload(contentType:string,bytes:Uint8Array,transfer:ProviderMediaTransfer){
    if(!['image/jpeg','image/png','image/webp','image/gif','audio/wav','video/mp4'].includes(contentType))throw new Error('higgsfield_upload_type_invalid');
    const signed=z.object({public_url:z.url(),upload_url:z.url(),content_type:z.string(),upload_headers:z.record(z.string(),z.string())})
      .parse(await this.call('/files/generate-upload-url','POST',{content_type:contentType}));
    if(signed.content_type!==contentType)throw new Error('higgsfield_upload_type_mismatch');
    return transfer.upload(signed.upload_url,signed.upload_headers,bytes,signed.public_url);
  }
}

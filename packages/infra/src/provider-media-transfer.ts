import {createHash} from 'node:crypto';
import {lookup} from 'node:dns/promises';
import {request as httpsRequest} from 'node:https';
import {AssetSchema,type AssetStore,type Asset} from '@fbr/contracts';
import {isPublicAddress,validateCaptureUrl} from './article-capture.js';
export interface MediaTransferTransport{
  transfer(url:URL,method:'GET'|'PUT',headers:Record<string,string>,body:Uint8Array|undefined,maxBytes:number):Promise<{bytes:Uint8Array;mime_type:string|null}>;
}
const pinned:MediaTransferTransport={async transfer(url,method,headers,body,maxBytes){
  const addresses=await lookup(url.hostname,{all:true,verbatim:true});
  if(!addresses.length||addresses.some(value=>!isPublicAddress(value.address)))throw new Error('provider_storage_dns_not_public');
  const address=addresses[0]!;
  return new Promise((resolve,reject)=>{
    const req=httpsRequest({hostname:address.address,family:address.family,servername:url.hostname,port:443,path:url.pathname+url.search,
      method,agent:false,headers:{...headers,Host:url.host,...(body?{'Content-Length':String(body.length)}:{})}},response=>{
      if(!response.statusCode||response.statusCode<200||response.statusCode>=300||Number(response.headers['content-length'])>maxBytes){
        response.destroy();reject(new Error('provider_storage_response_invalid'));return;}
      const chunks:Buffer[]=[];let count=0;
      response.on('data',(part:Buffer)=>{count+=part.length;if(count>maxBytes){response.destroy(new Error('provider_media_too_large'));return;}chunks.push(part);});
      response.on('error',()=>reject(new Error('provider_storage_transfer_failed')));
      response.on('end',()=>resolve({bytes:Buffer.concat(chunks),mime_type:response.headers['content-type']?.split(';')[0]??null}));
    });
    req.on('error',()=>reject(new Error('provider_storage_transfer_failed')));req.setTimeout(15000,()=>req.destroy(new Error('provider_storage_timeout')));
    if(body)req.write(body);req.end();
  });
}};
type ProbeResult=Pick<Asset['file'],'mime_type'|'width'|'height'|'duration_seconds'>;
/** URLs assinadas ficam somente em memória; arquivos duráveis recebem chave pelo hash dos bytes medidos. */
export class ProviderMediaTransfer{
  private readonly origins:Set<string>;
  constructor(origins:string[],private readonly transport:MediaTransferTransport=pinned){
    this.origins=new Set(origins.map(origin=>{const url=validateCaptureUrl(origin);if(url.protocol!=='https:'||url.pathname!=='/'||url.search)throw new Error('provider_storage_origin_invalid');return url.origin;}));
  }
  private url(raw:string){const url=validateCaptureUrl(raw);if(url.protocol!=='https:'||!this.origins.has(url.origin))throw new Error('provider_storage_origin_denied');return url;}
  async upload(rawUrl:string,uploadHeaders:Record<string,string>,bytes:Uint8Array,publicUrl:string){
    if(!bytes.length||bytes.length>100_000_000)throw new Error('provider_upload_size_invalid');
    for(const [key,value]of Object.entries(uploadHeaders))if(['cookie','proxy-authorization','x-api-key','host'].includes(key.toLowerCase())
      ||(key.toLowerCase()==='authorization'&&!value.startsWith('AWS4-HMAC-SHA256 ')))throw new Error('provider_storage_credential_denied');
    const published=this.url(publicUrl);await this.transport.transfer(this.url(rawUrl),'PUT',uploadHeaders,bytes,10000);return published.href;
  }
  async download(rawUrl:string,store:AssetStore,probe:(bytes:Uint8Array)=>Promise<ProbeResult>){
    const response=await this.transport.transfer(this.url(rawUrl),'GET',{},undefined,100_000_000),bytes=response.bytes;
    if(!bytes.length||bytes.length>100_000_000)throw new Error('provider_media_size_invalid');
    const measured=AssetSchema.shape.file.pick({mime_type:true,width:true,height:true,duration_seconds:true}).parse(await probe(bytes));
    if(!['image/png','image/jpeg','image/webp','video/mp4','audio/wav','audio/mpeg','audio/mp4'].includes(measured.mime_type))throw new Error('provider_media_type_unsupported');
    const hash=createHash('sha256').update(bytes).digest('hex'),storage_key=`provider-media/${hash}.bin`;
    await store.putImmutable(storage_key,bytes,hash);
    return {storage_key,hash,bytes:bytes.length,...measured};
  }
}

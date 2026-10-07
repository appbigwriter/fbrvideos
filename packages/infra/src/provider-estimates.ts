import {z} from 'zod';
import type {AdapterRequest,GenerationIntent} from '@fbr/contracts';
import {canonical,sha256} from '@fbr/domain';
export const ProviderQuoteSchema=z.strictObject({adapter_id:z.string().min(1),account_scope:z.string().min(1),request_hash:z.string().regex(/^[a-f0-9]{64}$/),
  currency:z.string().regex(/^[A-Z]{3}$/),upper_minor:z.int().nonnegative(),quoted_at:z.iso.datetime(),expires_at:z.iso.datetime(),evidence:z.string().trim().min(1)});
export type ProviderQuote=z.infer<typeof ProviderQuoteSchema>;
/** Price is tied to the material request, not to reservation or production bookkeeping. */
export function providerQuoteRequestHash(request:AdapterRequest){return sha256(canonical({operation:request.operation,route:request.route,
  configuration_hash:request.configuration_hash,parameters:request.parameters,input_assets:request.input_assets,references:request.references}));}
export function validateProviderQuote(raw:unknown,intent:GenerationIntent,accountScope:string,now=new Date()){
  const quote=ProviderQuoteSchema.parse(raw);
  if(quote.adapter_id!==intent.adapter_id||quote.account_scope!==accountScope||quote.request_hash!==providerQuoteRequestHash(intent.request))throw new Error('provider_quote_request_changed');
  if(quote.currency!==intent.request.currency||quote.upper_minor!==intent.request.reserved_minor)throw new Error('provider_quote_currency_or_reservation_mismatch');
  if(Date.parse(quote.quoted_at)>now.getTime()||Date.parse(quote.expires_at)<=now.getTime()||Date.parse(quote.expires_at)<=Date.parse(quote.quoted_at))throw new Error('provider_quote_expired');
  return quote;
}

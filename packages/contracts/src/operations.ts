import {z} from 'zod';
export const OperationsViewSchema=z.strictObject({http:z.strictObject({uptime_seconds:z.int().nonnegative(),routes:z.array(z.strictObject({route:z.string(),count:z.int().nonnegative(),errors:z.int().nonnegative(),total_ms:z.number().nonnegative(),max_ms:z.number().nonnegative(),mean_ms:z.number().nonnegative()}))}),
  runtime:z.strictObject({database:z.literal('ready'),productions:z.array(z.strictObject({status:z.string(),count:z.int().nonnegative()})),
    jobs:z.array(z.strictObject({state:z.string(),count:z.int().nonnegative()})),interrupted_assemblies:z.int().nonnegative(),attention_required:z.boolean()}).optional()});

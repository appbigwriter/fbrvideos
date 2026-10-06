import { PostgresDatabase, migrateConfiguration } from './configuration-store.js';
if (!process.env.DATABASE_URL) throw new Error('Defina DATABASE_URL no servidor antes de executar as migrações.');
const database = new PostgresDatabase(process.env.DATABASE_URL);
try { await migrateConfiguration(database); console.log('Migrações de configuração, produção, geração e mídia aplicadas.'); }
finally { await database.close(); }

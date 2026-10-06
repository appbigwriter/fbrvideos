import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { PostgresDatabase } from './configuration-store.js';
import { captureMetadataBackup } from './metadata-backup.js';

if (!process.env.DATABASE_URL) throw new Error('Defina DATABASE_URL antes de criar o backup.');
const database = new PostgresDatabase(process.env.DATABASE_URL);
try {
  const backup = await captureMetadataBackup(database);
  const path = resolve('var/backups', `fbr-metadata-${backup.created_at.replace(/[:.]/g, '-')}.json`);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(backup, null, 2), { flag: 'wx' });
  console.log(`Backup de metadados salvo em ${path}; SHA-256 ${backup.hash}. Arquivos do AssetStore devem ser copiados junto.`);
} finally { await database.close(); }

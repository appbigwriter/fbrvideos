// Cada chamada usa um snapshot separado no volume persistente de backups.
process.env.FBR_BACKUP_ROOT ||= `/backups/${new Date().toISOString().replace(/[:.]/g,'-')}`;
await import('../packages/infra/src/full-backup-cli.js');

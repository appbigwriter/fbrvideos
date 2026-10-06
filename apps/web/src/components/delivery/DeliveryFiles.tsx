import type { DeliveryView } from '@fbr/contracts';

export interface DeliveryFilesProps {
  files: DeliveryView['files'];
  kind: DeliveryView['kind'];
}

export function DeliveryFiles({ files, kind }: DeliveryFilesProps) {
  if (files.length === 0) {
    return (
      <div className="delivery-files-empty" role="status">
        <span className="empty-icon" aria-hidden="true">📁</span>
        <p className="empty-title">Nenhum arquivo disponível para download</p>
        <p className="empty-subtitle">
          Os arquivos serão gerados e disponibilizados após a renderização e montagem do pacote.
        </p>
      </div>
    );
  }

  const downloadButtonText =
    kind === 'preview' ? 'Baixar prévia' : 'Baixar arquivo aprovado';

  return (
    <section className="delivery-files-section" aria-label="Arquivos e ativos disponíveis para download">
      <h3 className="delivery-section-subtitle">Arquivos da Produção ({files.length})</h3>

      <div className="delivery-files-grid">
        {files.map((file) => (
          <article
            key={`${file.ref.id}:${file.ref.version}`}
            className="delivery-file-card"
          >
            <div className="file-card-icon" aria-hidden="true">
              🎬
            </div>
            <div className="file-card-info">
              <h4 className="file-label-title">{file.label}</h4>
              <span className="file-version-tag">Versão {file.ref.version}</span>
            </div>
            <div className="file-card-action">
              <a
                href={file.download_url}
                download
                className="btn-download-file"
              >
                <span className="download-icon" aria-hidden="true">⬇</span>
                <span>{downloadButtonText}</span>
              </a>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

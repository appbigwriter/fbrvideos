import type { NarrativeBlocksProps, DossierPresentation } from '@fbr/contracts';
import { ShotDetails } from './ShotDetails.js';

type SourceRefItem = DossierPresentation['dossier']['blocks'][number]['speeches'][number]['sources'][number];

export function NarrativeBlocks({ data }: NarrativeBlocksProps) {
  const { dossier, article } = data;
  const blocks = [...dossier.blocks].sort((a, b) => a.sequence - b.sequence);

  return (
    <div className="narrative-blocks-container" aria-label="Roteiro e blocos narrativos">
      <h3 className="narrative-section-title">Blocos Narrativos e Planos Técnicos</h3>

      <div className="narrative-blocks-list">
        {blocks.map((block) => {
          const associatedShots = dossier.shots.filter((s) => s.block_id === block.id);

          return (
            <section
              key={block.id}
              className="narrative-block-card"
              aria-labelledby={`block-title-${block.id}`}
            >
              <div className="block-card-header">
                <div className="block-header-left">
                  <span className="block-sequence-tag">Bloco #{block.sequence}</span>
                  <span className="block-id-tag">{block.id}</span>
                </div>
                <div className="block-visual-function">
                  <span className="visual-function-badge">{block.visual_function}</span>
                </div>
              </div>

              <div className="block-intent-section">
                <h4 id={`block-title-${block.id}`} className="block-intent-title">
                  {block.intent}
                </h4>
              </div>

              <div className="block-speeches-section">
                <h5 className="sub-section-heading">Falas e Locução</h5>
                {block.speeches.length > 0 ? (
                  <div className="speeches-list">
                    {block.speeches.map((speech) => (
                      <div key={speech.id} className="speech-item">
                        <div className="speech-meta">
                          <span className="speech-mode-badge">{speech.mode}</span>
                          <span className="speech-category-badge">{speech.kind}</span>
                        </div>
                        <p className="speech-text">“{speech.text}”</p>

                        <div className="speech-sources-container">
                          {speech.sources.length > 0 ? (
                            speech.sources.map((src: SourceRefItem, sIdx: number) => {
                              const isExactArticle =
                                src.kind === 'article' &&
                                src.document.id === article.id &&
                                src.document.version === article.version;

                              if (isExactArticle) {
                                const segment = article.segments.find((s) => s.id === src.segment_id);
                                return (
                                  <details key={`src-${sIdx}`} className="block-source-box source-verified">
                                    <summary className="source-label">Fonte do artigo: {src.document.id} · v{src.document.version} · {src.segment_id}</summary>
                                    <div className="source-meta">
                                      <span className="source-doc">{article.title} (v{article.version})</span>
                                      <span className="source-segment">Trecho: #{src.segment_id}</span>
                                    </div>
                                    {segment ? (
                                      <blockquote className="source-quote">“{segment.text}”</blockquote>
                                    ) : (
                                      <p className="source-pending">Trecho #{src.segment_id} não indexado no snapshot atual.</p>
                                    )}
                                  </details>
                                );
                              }

                              if (src.kind === 'article') {
                                return (
                                  <div key={`src-${sIdx}`} className="block-source-box source-unavailable">
                                    <span className="source-label">Fonte de Conteúdo:</span>
                                    <p>{src.document.id} · v{src.document.version} · {src.segment_id}</p>
                                    <p className="source-notice">Fonte não disponível nesta apresentação</p>
                                  </div>
                                );
                              }

                              return (
                                <div key={`src-${sIdx}`} className="block-source-box source-editorial">
                                  <span className="source-label">Origem Editorial:</span>
                                  <p>{src.document.id} · v{src.document.version} · {src.segment_id}</p>
                                  <p className="source-notice">Fonte não disponível nesta apresentação</p>
                                </div>
                              );
                            })
                          ) : (
                            <div className="block-source-box source-editorial">
                              <span className="source-label">Origem Narrativa:</span>
                              <p className="source-notice">{speech.kind === 'transicao_convite' ? 'Transição editorial sem afirmação factual' : 'Fonte não disponível nesta apresentação'}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted">Nenhuma fala neste bloco.</p>
                )}
              </div>

              <div className="block-shots-section">
                <h5 className="sub-section-heading">
                  Planos Visuais Associados ({associatedShots.length})
                </h5>
                {associatedShots.length > 0 ? (
                  <div className="block-shots-list">
                    {associatedShots.map((shot) => (
                      <ShotDetails key={shot.id} shot={shot} />
                    ))}
                  </div>
                ) : (
                  <p className="text-muted">Nenhum plano associado diretamente a este bloco.</p>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { dossierFixture, fixtureRefs } from '../src/fixtures.js';
import { correctionImpact, dependencyImpact, invalidateDossier } from '@fbr/domain';

test('Correção visual invalida imagem/timeline/render/aprovação e preserva áudio/fonte', () => {
  const impact = correctionImpact(dossierFixture, [fixtureRefs.image]);
  for (const ref of [fixtureRefs.image, fixtureRefs.render, { id: 'timeline_fixture', version: 1 }, { id: 'approval_fixture', version: 1 }])
    assert.ok(impact.invalidated.some(value => value.id === ref.id && value.version === ref.version));
  for (const ref of [fixtureRefs.article, fixtureRefs.audio]) assert.ok(impact.preserved.some(value => value.id === ref.id));
  assert.equal(impact.approval_invalidated, true);
  const updated = invalidateDossier(dossierFixture, [fixtureRefs.image]);
  assert.equal(updated.version, 2); assert.equal(updated.timeline!.status, 'outdated');
  assert.equal(updated.assets.find(asset => asset.id === fixtureRefs.audio.id)!.status, 'approved');
  assert.equal(updated.approvals[0]!.status, 'invalidated');
  assert.equal(dossierFixture.approvals[0]!.status, 'active'); assert.equal(dossierFixture.timeline!.status, 'rendered');
});
test('Mudança narrativa invalida áudio/visual e alterações combinadas unem os derivados', () => {
  const narrative = correctionImpact(dossierFixture, [fixtureRefs.dossier]);
  assert.ok(narrative.invalidated.some(ref => ref.id === fixtureRefs.audio.id));
  assert.ok(narrative.invalidated.some(ref => ref.id === fixtureRefs.image.id));
  const updated=invalidateDossier(dossierFixture,[fixtureRefs.dossier]);assert.equal(updated.shots[0]!.version,dossierFixture.shots[0]!.version+1);
  assert.equal(updated.shots[0]!.status,'specified');
  const together = correctionImpact(dossierFixture, [fixtureRefs.image, fixtureRefs.audio]);
  assert.ok(together.invalidated.some(ref => ref.id === fixtureRefs.render.id));
  assert.equal(new Set(together.invalidated.map(ref => `${ref.id}:${ref.version}`)).size, together.invalidated.length);
  assert.throws(() => correctionImpact(dossierFixture, [{ ...fixtureRefs.image, version: 99 }]), /root_missing/);
  assert.throws(() => correctionImpact(dossierFixture, []), /roots_required/);
});
test('Grafo recusa ciclo, dependência ausente e nós duplicados', () => {
  const a = { id: 'a', version: 1 }, b = { id: 'b', version: 1 };
  assert.throws(() => dependencyImpact([{ ref: a, dependencies: [b] }, { ref: b, dependencies: [a] }], [a]), /cycle/);
  assert.throws(() => dependencyImpact([{ ref: a, dependencies: [b] }], [a]), /node_missing/);
  assert.throws(() => dependencyImpact([{ ref: a, dependencies: [] }, { ref: a, dependencies: [] }], [a]), /duplicate/);
});

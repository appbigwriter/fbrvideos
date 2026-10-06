import test from 'node:test';
import assert from 'node:assert/strict';
import { dossierFixture, productionFixture, fixtureRefs, approvalFixture } from '../src/fixtures.js';
import { buildDeliveryManifest } from '@fbr/domain';

test('Preview é explícito e manifesto da mesma revisão é reproduzível', () => {
  const manifest = buildDeliveryManifest(productionFixture, dossierFixture, 'preview');
  assert.equal(manifest.status, 'preview'); assert.equal(manifest.approval, null);
  assert.deepEqual(buildDeliveryManifest(productionFixture, dossierFixture, 'preview'), manifest);
  assert.equal(manifest.assets.length, 1); assert.equal(manifest.assets[0]!.type, 'render');
  assert.throws(() => buildDeliveryManifest(productionFixture, dossierFixture, 'approved_delivery'), /final_approval/);
});
test('Entrega final exige aprovação humana do render exato e pendências resolvidas', () => {
  const production = { ...productionFixture, status: 'approved' as const, current_approval: { id: approvalFixture.id, version: 1 } };
  const manifest = buildDeliveryManifest(production, dossierFixture, 'approved_delivery');
  assert.equal(manifest.approval!.target.id, fixtureRefs.render.id); assert.equal(manifest.status, 'approved_delivery');
  const stale = structuredClone(dossierFixture); stale.approvals[0]!.target.version = 2;
  assert.throws(() => buildDeliveryManifest(production, stale, 'approved_delivery'), /final_approval/);
  const pending = structuredClone(dossierFixture); pending.pending_issues = [{ code: 'review', message: 'Pendente', next_action: 'Revisar', required: true }];
  assert.throws(() => buildDeliveryManifest(production, pending, 'approved_delivery'), /final_approval/);
  assert.throws(() => buildDeliveryManifest({ ...production, costs: { ...production.costs, committed_minor: 100 } }, dossierFixture, 'approved_delivery'), /final_approval/);
  const uncertain = structuredClone(dossierFixture); uncertain.jobs[0]!.costs.confirmed_minor = null;
  assert.throws(() => buildDeliveryManifest(production, uncertain, 'approved_delivery'), /final_approval/);
  const other = structuredClone(dossierFixture); other.timeline!.version = 2;
  assert.throws(() => buildDeliveryManifest(productionFixture, other, 'preview'), /render_missing_or_outdated/);
});

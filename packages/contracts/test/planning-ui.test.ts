import test from 'node:test';
import assert from 'node:assert/strict';
import { DossierPresentationSchema,ProductionSummarySchema } from '../src/planning-ui.js';
import { productionSummaryFixture,blockedProductionSummaryFixture,dossierPresentationFixture } from '../src/planning-fixtures.js';
test('Fixtures AG-05/06 exibem bloqueios e dossiê sem aprovações ou mídia; fonte deve ser exata',()=>{
  assert.equal(ProductionSummarySchema.parse(productionSummaryFixture).can_submit,true);
  assert.equal(ProductionSummarySchema.parse(blockedProductionSummaryFixture).can_submit,false);
  const data=DossierPresentationSchema.parse(dossierPresentationFixture);
  assert.equal(data.dossier.assets.length+data.dossier.jobs.length+data.dossier.approvals.length,0);
  assert.equal(DossierPresentationSchema.safeParse({...data,article:{...data.article,version:2}}).success,false);
});

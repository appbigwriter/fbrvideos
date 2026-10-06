import { ReviewViewSchema, DeliveryViewSchema } from './review-ui.js';
import { productionFixture, fixtureRefs, fixtureCosts } from './fixtures.js';
const disabled={enabled:false,reason:'SIMULAÇÃO: nenhum vídeo real disponível.'};
export const reviewViewFixtures = {
  unavailable:ReviewViewSchema.parse({production:fixtureRefs.production,name:productionFixture.name,status:'awaiting_decision',render:null,scenes:[],points:[],
    actions:{comment:disabled,approve:disabled},notice:'SIMULAÇÃO para apresentação. Prévia ainda indisponível.'}),
  review:ReviewViewSchema.parse({production:fixtureRefs.production,name:productionFixture.name,status:'ready_for_review',
    render:{ref:fixtureRefs.render,hash:'a'.repeat(64),preview_url:'/api/productions/production_fixture/assets/render_fixture?version=1',duration_seconds:8},
    scenes:[{ref:fixtureRefs.shot,title:'Cena sintética de notificações',start_seconds:0,end_seconds:8,transcript:'Texto sintético para inspeção.'}],points:[],
    actions:{comment:{enabled:true,reason:null},approve:disabled},notice:'SIMULAÇÃO: URL não corresponde a arquivo real; não valida qualidade audiovisual.'}),
};
export const deliveryViewFixtures = {
  unavailable:DeliveryViewSchema.parse({production:fixtureRefs.production,name:productionFixture.name,status:'awaiting_decision',kind:'unavailable',render:null,render_hash:null,files:[],costs:fixtureCosts,export_action:disabled,notice:'SIMULAÇÃO: nenhum arquivo disponível.'}),
  preview:DeliveryViewSchema.parse({production:fixtureRefs.production,name:productionFixture.name,status:'ready_for_review',kind:'preview',render:fixtureRefs.render,render_hash:'a'.repeat(64),
    files:[{ref:fixtureRefs.render,label:'Prévia sintética',download_url:'/api/productions/production_fixture/assets/render_fixture?version=1'}],costs:fixtureCosts,export_action:disabled,notice:'SIMULAÇÃO: não é entrega aprovada e não há arquivo real nesta fixture.'}),
};

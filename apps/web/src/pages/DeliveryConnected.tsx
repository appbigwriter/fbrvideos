import {Link,useParams} from 'react-router';
import {DeliveryViewSchema,ProductionSchema} from '@fbr/contracts';
import {useResource,useCommand} from '../api.js';
import {Page} from './ConnectedShared.js';
import {DeliveryPanel} from '../components/delivery/DeliveryPanel.js';
export function DeliveryPage(){
  const {id}=useParams(),resource=useResource(id?`/productions/${id}/delivery`:null,DeliveryViewSchema),command=useCommand();
  const data=resource.data;
  return <Page title="Entrega"><Link to={`/producoes/${id}/revisao`}>Voltar à revisão</Link>
    <DeliveryPanel {...resource} pending={command.pending} command_error={command.error} onRetry={resource.reload} onExport={()=>{
      if(!data?.render||!data.render_hash||!data.export_action.enabled)return;
      void command.run(`/productions/${id}/delivery/export`,ProductionSchema,{production:data.production,render:data.render,render_hash:data.render_hash},resource.reload);
    }}/></Page>;
}


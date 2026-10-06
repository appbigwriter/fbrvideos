import { spawn,type ChildProcess } from 'node:child_process';
import { mkdtemp,writeFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join,resolve,basename,dirname } from 'node:path';
import type { JsonInference,InferenceResult } from '@fbr/contracts';

export const OAUTH_PLANNER_MODEL='gpt-6.1-sol';
export class CodexOAuthInference implements JsonInference {
  private readonly children=new Set<ChildProcess>();
  constructor(private readonly executable:string,private readonly timeoutMs=180_000) {}
  close() {for(const child of this.children)child.kill();}
  async run(prompt:string,schema:Record<string,unknown>):Promise<InferenceResult> {
    const tempRoot=resolve(tmpdir());const directory=await mkdtemp(join(tempRoot,'fbr-inference-'));
    try {
      const schemaPath=join(directory,'schema.json');await writeFile(schemaPath,JSON.stringify(schema),'utf8');
      const args=['exec','--ignore-user-config','--ephemeral','--skip-git-repo-check',
        '--sandbox','read-only','--model',OAUTH_PLANNER_MODEL,'--disable','shell_tool','--disable','unified_exec',
        '--disable','multi_agent','--disable','shell_snapshot','-c','forced_login_method="chatgpt"',
        '-c','web_search="disabled"','-c','model_reasoning_effort="high"','--json','--output-schema',schemaPath,'-C',directory,'-'];
      // Never pass credentials on argv or read auth.json. Codex manages its existing OAuth session.
      const env:NodeJS.ProcessEnv={};
      for(const name of ['SystemRoot','WINDIR','COMSPEC','PATH','PATHEXT','USERPROFILE','HOMEDRIVE','HOMEPATH','HOME',
        'TEMP','TMP','APPDATA','LOCALAPPDATA','CODEX_HOME','SSL_CERT_FILE','CODEX_CA_CERTIFICATE','HTTPS_PROXY','HTTP_PROXY','NO_PROXY'])
        if(process.env[name])env[name]=process.env[name];
      return await new Promise<InferenceResult>((accept,reject)=>{
        const child=spawn(resolve(this.executable),args,{env,windowsHide:true,shell:false,stdio:['pipe','pipe','pipe']});
        this.children.add(child);child.once('close',()=>this.children.delete(child));
        let buffer='',answer='',completed=false,bytes=0,settled=false;
        let usage={input_tokens:0,output_tokens:0};
        const finish=(error?:Error)=>{if(settled)return;settled=true;clearTimeout(timer);
          if(error){child.kill();reject(error);}else{try{accept({value:JSON.parse(answer),usage});}catch{reject(new Error('oauth_output_invalid'));}}};
        const timer=setTimeout(()=>finish(new Error('oauth_timeout_unknown')),this.timeoutMs);
        child.stdout.setEncoding('utf8');
        child.stdout.on('data',(chunk:string)=>{
          bytes+=Buffer.byteLength(chunk);if(bytes>2_000_000){finish(new Error('oauth_output_limit'));return;}
          buffer+=chunk;const lines=buffer.split('\n');buffer=lines.pop()??'';
          for(const line of lines){if(!line.trim())continue;try{
            const event=JSON.parse(line);
            if(event.type==='turn.failed'||event.type==='error'){finish(new Error('oauth_inference_failed'));return;}
            if(event.type==='item.started'||event.type==='item.completed') {
              if(event.item?.type && !['agent_message','reasoning'].includes(event.item.type)){finish(new Error('oauth_tool_use_rejected'));return;}
              if(event.type==='item.completed'&&event.item?.type==='agent_message')answer=event.item.text;
            }
            if(event.type==='turn.completed'){completed=true;
              usage={input_tokens:Number(event.usage?.input_tokens??0),output_tokens:Number(event.usage?.output_tokens??0)};}
          }catch{finish(new Error('oauth_protocol_invalid'));return;}}
        });
        // Provider stderr may include credentials, source text or diagnostics; do not forward it.
        child.stderr.on('data',()=>{});child.on('error',()=>finish(new Error('oauth_cli_unavailable')));
        child.on('close',code=>finish(code===0&&completed&&answer?undefined:new Error('oauth_incomplete')));
        child.stdin.on('error',()=>finish(new Error('oauth_cli_unavailable')));child.stdin.end(prompt);
      });
    } finally {
      if(dirname(resolve(directory))!==tempRoot||!basename(directory).startsWith('fbr-inference-'))throw new Error('oauth_cleanup_path_invalid');
      await rm(directory,{recursive:true,force:true});
    }
  }
}

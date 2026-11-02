import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import {once} from 'node:events';

const root='/tmp/rebase-parallel-read-study';
const sdk='/workspace/ReBase/rebase-next/target/g7-environment/upgrade-7.3.77/usr';
const env={...process.env,LD_LIBRARY_PATH:'/workspace/ReBase/rebase-next/target/g7-environment/lib'};
const clusterFile=path.join(root,'fdb.cluster');
const children=[];
const metadata={scope:'three local FDB7.3.77 processes, one host/DC/region, triple SSD, warm native research reads; not WAN',started:new Date().toISOString(),processes:[],resourceSamples:[],errors:[]};
const delay=ms=>new Promise(r=>setTimeout(r,ms));
function start(name,bin,args){
 const out=fs.openSync(path.join(root,`${name}.stdout.log`),'w');
 const err=fs.openSync(path.join(root,`${name}.stderr.log`),'w');
 const p=spawn(bin,args,{env,stdio:['ignore',out,err]});
 fs.closeSync(out);fs.closeSync(err);
 const item={name,child:p,pid:p.pid,done:false};
 item.closed=new Promise(resolve=>{p.once('close',(code,signal)=>{item.done=true;item.code=code;item.signal=signal;resolve({code,signal});});p.once('error',e=>{metadata.errors.push(`${name}:${e}`);});});
 children.push(item);return item;
}
async function cli(command){
 const p=spawn(`${sdk}/bin/fdbcli`,['-C',clusterFile,'--exec',command],{env,stdio:['ignore','pipe','pipe']});
 let out='',err='';p.stdout.on('data',d=>out+=d);p.stderr.on('data',d=>err+=d);
 const timer=setTimeout(()=>p.kill('SIGKILL'),10000);
 const [code]=await once(p,'close');clearTimeout(timer);
 if(code!==0)throw Error(`cli:${command}:${code}:${err}`);return out;
}
async function port(){const s=createServer();s.listen(0,'127.0.0.1');await once(s,'listening');const p=s.address().port;await new Promise(r=>s.close(r));return p;}
function resources(){
 let allocated=0;
 function walk(dir){for(const f of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,f.name);if(f.isDirectory())walk(full);else allocated+=fs.statSync(full).blocks*512;}}
 for(let i=0;i<3;i++)for(const kind of ['data','logs']){const dir=path.join(root,`${kind}-${i}`);if(fs.existsSync(dir))walk(dir);}
 const rows=children.filter(x=>!x.done).map(x=>{try{const stat=fs.readFileSync(`/proc/${x.pid}/stat`,'utf8').slice(fs.readFileSync(`/proc/${x.pid}/stat`,'utf8').lastIndexOf(')')+2).trim().split(/\s+/);return{name:x.name,pid:x.pid,cpuTicks:Number(stat[11])+Number(stat[12]),rssBytes:Number(stat[21])*4096};}catch{return{name:x.name,pid:x.pid,unavailable:true};}});
 metadata.resourceSamples.push({time:new Date().toISOString(),allocatedBytes:allocated,processes:rows});
 const st=fs.statfsSync('/tmp');if(allocated>3000000000||st.bavail*st.bsize<500000000){throw Error('owned disk guard exceeded');}
}
let timer;
try{
 const ports=await Promise.all([port(),port(),port()]);
 fs.writeFileSync(clusterFile,`parallelread:parallelread@127.0.0.1:${ports[0]}\n`,{flag:'wx'});
 for(let i=0;i<3;i++){
  for(const kind of ['data','logs'])fs.mkdirSync(path.join(root,`${kind}-${i}`));
  const item=start(`fdb-${i}`,`${sdk}/sbin/fdbserver`,['-C',clusterFile,'-p',`127.0.0.1:${ports[i]}`,'-m','1024','--cache-memory','64','--storage-memory','64','-d',path.join(root,`data-${i}`),'-L',path.join(root,`logs-${i}`),'--locality-dcid','parallel_dc','--locality-zoneid',`parallel_zone_${i}`,'--locality-machineid',`parallel_machine_${i}`]);
  metadata.processes.push({name:item.name,pid:item.pid,port:ports[i]});
 }
 timer=setInterval(()=>{try{resources();}catch(e){metadata.errors.push(e.message);for(const p of children.filter(x=>!x.done))p.child.kill('SIGTERM');}},1000);
 await delay(1500);await cli('configure new triple ssd');
 for(let i=0;i<45;i++){
  const s=JSON.parse(await cli('status json'));
  const processes=Object.values(s.cluster?.processes??{});
  if(s.client?.database_status?.healthy&&s.cluster?.recovery_state?.seconds_since_last_recovered>=10&&processes.length===3&&processes.flatMap(p=>p.roles??[]).filter(r=>r.role==='storage').length>=3){metadata.statusBefore=s;break;}
  if(i===44)throw Error('cluster not healthy');await delay(1000);
 }
 while(!fs.existsSync(path.join(root,'ready')))await delay(500);
 const bench=start('benchmark',path.join(root,'bench'),[clusterFile]);
 const timeout=setTimeout(()=>bench.child.kill('SIGTERM'),300000);
 metadata.benchmark=await bench.closed;clearTimeout(timeout);
 resources();metadata.statusAfter=JSON.parse(await cli('status json'));
 if(metadata.benchmark.code!==0)throw Error(`benchmark exited ${metadata.benchmark.code}`);
}catch(e){metadata.errors.push(e.stack??String(e));process.exitCode=1;}
finally{
 clearInterval(timer);
 try{resources();}catch{}
 for(const x of children.filter(x=>!x.done))x.child.kill('SIGTERM');
 await Promise.race([Promise.all(children.map(x=>x.closed)),delay(10000)]);
 for(const x of children.filter(x=>!x.done))x.child.kill('SIGKILL');
 await Promise.all(children.map(x=>x.closed));
 for(let i=0;i<3;i++)for(const kind of ['data','logs'])fs.rmSync(path.join(root,`${kind}-${i}`),{recursive:true,force:true});
 metadata.finished=new Date().toISOString();metadata.cleanup=children.every(x=>x.done);
 fs.writeFileSync(path.join(root,'run-metadata.json'),JSON.stringify(metadata,null,2));
 console.log(JSON.stringify({errors:metadata.errors,benchmark:metadata.benchmark,cleanup:metadata.cleanup}));
}

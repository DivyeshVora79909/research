import assert from 'node:assert/strict';
import {generateKeyPairSync,randomUUID} from 'node:crypto';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import {connect,resolveConfig,prepareModel,openNative,openOperator,preparePopulation,propose,accept} from '/workspace/ReBase/rebase-next/tools/node/index.mjs';
const binary='/tmp/rebase-unbounded-build/debug/rebase-next';
import {init} from '/workspace/ReBase/node_modules/z3-solver/build/node.js';
import {createGeneratorSync} from '/workspace/ReBase/node_modules/json-schema-faker/dist/index.js';
const zt=performance.now();const z=await init();let ctx=new z.Context('adaptive');const solver=new ctx.Solver();const q=ctx.Int.const('q');const solverInitMs=performance.now()-zt;
const results=[];
for(const n of ('10').split(',').map(Number)) {
 const dir=await mkdtemp('/tmp/equipment-population-'); let native,operator,service;
 const r={n,publicRows:16+n,batchSize:1,errors:[],timings:{}}; const begin=performance.now();
 try {
 const tenant=randomUUID(),actor=randomUUID();const pair=generateKeyPairSync('ed25519');
 const identity={issuer:'trial',audience:'trial',public_keys:{local:pair.publicKey.export({type:'spki',format:'pem'}).toString()},max_token_seconds:3600};
 const methods=['store.check','service.start','service.stop','identity.issue'];
 const config=resolveConfig({overrides:{native:{binary,environment:{},configuration:{model:'equipment',backend:{kind:'redb',cluster_file:null},target:{mode:'create',path:dir+'/store.redb',tenant,actor},operator_methods:methods}},service:{listen:'127.0.0.1:0',identity,max_inflight:8,request_timeout_seconds:60,effects:null}}});
 native=await openNative(config);operator=openOperator(native,{scope:native.scope,methods});service=await operator.startService({config:config.service});
 const token=(await operator.issueIdentity({identity,request:{tenant,actor,epoch:0,ttl:3600,key_id:'local'},privateKeyPem:pair.privateKey.export({type:'pkcs8',format:'pem'}).toString()})).token;
 const client=connect({endpoint:service.endpoint,credential:token});const model=prepareModel(await native.catalog({scope:'developer'}),{native,selector:'equipment'});
 r.limits=model.catalog.capabilities.limits;r.model=model.identity;
 const initMs=performance.now()-begin;
 const pools=Array.from({length:8},()=>({id:randomUUID(),contract:'Pool',fields:{unit:1}}));
 const anchors=pools.flatMap(p=>[{op:'create',id:p.id,contract:101,fields:p.fields},{op:'create',id:randomUUID(),contract:205,fields:{pool:p.id,at:'0',quantity:'3'}}]);
 const anchorPlan=await client.prepare({model:model.identity,commands:anchors,returning:pools.map(p=>p.id)});const anchorReceipt=await client.execute(anchorPlan);assert.equal(anchorReceipt.status,'committed');
 const facts=[...anchors], balances=Object.fromEntries(pools.map(p=>[p.id,3]));
 r.records=[];r.schedule=[];r.parentHistogram={};r.solverChecks=0;r.solverInitMs=solverInitMs;r.timings.initModelMs=initMs;
 let current,now=0;
 const faker=createGeneratorSync({seed:1234+n});
 const strategy=()=>{const t=performance.now();const v=faker.generate({type:'object',properties:{target:{type:'integer',minimum:1,maximum:9}},required:['target'],additionalProperties:false});current.fakeMs=performance.now()-t;current.target=v.target;return {target:v.target}};
 const rule=async(fields,fresh)=>{const t=performance.now();solver.push();try{solver.add(q.ge(1),q.eq(fresh.name==='Reservation'?Math.min(fields.target,fresh.available):fields.target),...(fresh.name==='Reservation'?[q.le(fresh.available)]:[]));const c=performance.now();assert.equal(await solver.check(),'sat');current.solverCheckMs=performance.now()-c;r.solverChecks++;const val=solver.model().eval(q).toString();return fresh.name==='Delivery'?{pool:fields.pool,at:String(fresh.at),quantity:val}:{pool:fields.pool,starts:String(fresh.at),ends:String(n+10000),requested:val,active:true};}finally{solver.pop();current.ruleMs=performance.now()-t;}};
 const state=preparePopulation(model,{Delivery:Math.floor(n/2),Reservation:n-Math.floor(n/2)},{seed:'adaptive-'+n,batchSize:1,existing:{Pool:pools},priorities:{Delivery:1,Reservation:2},strategies:{Delivery:strategy,Reservation:strategy},rules:{Delivery:rule,Reservation:rule},
 selectReference(child,field,view,usage,rng){const t=performance.now();const rows=view.Pool.filter(p=>child!=='Reservation'||balances[p.id]>0);assert.ok(rows.length,'no funded pool: witness stalled');const weights=rows.map(p=>1/(1+Object.entries(usage).filter(([k])=>k.endsWith(p.id)).reduce((s,[,v])=>s+v,0)));let ticket=rng()*weights.reduce((a,b)=>a+b,0),index=0;while(index<weights.length-1 && (ticket-=weights[index])>=0)index++;const id=rows[index].id;current.selectorMs=performance.now()-t;return ['Pool',id]},
 context:async(name,refs)=>{const t=performance.now();const root=await client.call('roots.read',{model:model.identity,owner:refs.pool,slot:7,read:{kind:'before',at:String(now+1)}});current.contextReadMs=performance.now()-t;const at=++now;const available=Number(root.value.sum);assert.equal(available,balances[refs.pool]);current.available=available;current.parent=refs.pool;current.contract=name;return {name,at,available}}});
 let batches=0,proposeMs=0,prepareMs=0,executeMs=0;
 const popStart=performance.now();
 while(Object.values(state.accepted).reduce((a,b)=>a+b,0)<n){
  let t=performance.now();current={index:r.records.length};const proposal=await propose(state);current.proposeInclusiveMs=performance.now()-t;proposeMs+=current.proposeInclusiveMs;current.proposeExclusiveMs=current.proposeInclusiveMs-current.fakeMs-current.selectorMs-current.contextReadMs-current.ruleMs;
  for(const c of proposal.commands){assert.equal(model.validate(c.contract,c.fields).valid,true);facts.push(c)}
  t=performance.now();const plan=await client.prepare({model:model.identity,commands:proposal.commands,returning:proposal.returning});current.prepareMs=performance.now()-t;prepareMs+=current.prepareMs;state.pending.plan=plan;
  t=performance.now();const receipt=await client.execute(plan);current.executeMs=performance.now()-t;executeMs+=current.executeMs;assert.equal(receipt.status,'committed');t=performance.now();accept(state,proposal,plan,receipt);current.acceptMs=performance.now()-t;const f=proposal.commands[0].fields;balances[f.pool]+=current.contract==='Delivery'?Number(f.quantity):-Number(f.requested);r.schedule.push(current.contract);r.parentHistogram[f.pool]=(r.parentHistogram[f.pool]??0)+1;r.records.push(current);batches++;
 }
 r.timings.populationMs=performance.now()-popStart;r.timings.proposeMs=proposeMs;r.timings.prepareMs=prepareMs;r.timings.executeMs=executeMs;r.batches=batches;r.accepted=state.accepted;
 let t=performance.now();let rows=0,reservations=0;const poolId=state.poolIds.Pool[0];
 for(const c of facts){const row=await client.call('records.get',{model:model.identity,id:c.id});assert.deepEqual(row.input,c.fields);if(c.contract===410){reservations++;if(!r.sampleReservation)r.sampleReservation=row;assert.equal(row.derived.allocated,c.fields.requested);assert.equal(row.derived.available_before,String(r.records.find(x=>x.index===facts.indexOf(c)-anchors.length).available));}rows++}
 assert.equal(reservations,n-Math.floor(n/2));for(const p of pools){const root=await client.call('roots.read',{model:model.identity,owner:p.id,slot:7,read:{kind:'before',at:String(n+1)}});assert.equal(root.value.sum,String(balances[p.id]));const summary=await client.call('roots.read',{model:model.identity,owner:p.id,slot:7,read:{kind:'summary'}});assert.equal(summary.value.sum,String(3+facts.filter(c=>c.contract===205&&c.fields.pool===p.id&&c.fields.at!=='0').reduce((s,c)=>s+Number(c.fields.quantity),0)));}r.verifiedReservations=reservations;r.timings.independentReadMs=performance.now()-t;r.verifiedRows=rows;r.referenceUsage=state.referenceUsage;
 t=performance.now();r.check=await operator.check();r.timings.storeCheckMs=performance.now()-t;
 r.tightReservations=r.records.filter(x=>x.contract==='Reservation'&&x.available<=x.target).length;assert.ok(r.tightReservations>0,'no tight reservation witness');r.pass=true;
 } catch(e){r.pass=false;r.errors.push({name:e.name,code:e.code,message:e.message,stack:e.stack});}
 finally{if(service)await operator.stopService({service:service.service});if(native)await native.close();await rm(dir,{recursive:true,force:true});r.cleaned=true;r.timings.totalMs=performance.now()-begin;results.push(r);await writeFile('/tmp/equipment-tight-results.json',JSON.stringify(results,null,2));console.log(JSON.stringify({n:r.n,publicRows:r.publicRows,pass:r.pass,cleaned:r.cleaned,accepted:r.accepted,verifiedRows:r.verifiedRows,verifiedReservations:r.verifiedReservations,batches:r.batches,timings:r.timings,check:r.check?.status,errors:r.errors}));}
 if(!r.pass)break;
}

solver.release();z.em.PThread.terminateAllThreads();ctx=null;

import {intentSchema} from '@/lib/intent-schema';
import {chatWithLlm,startChatWithLlm,LlmError,llmStatus} from '@/lib/llm';
import {database,authIdentity,mutationGuard,failure} from '@/lib/server';
import {initialState,makeOffers,type State,type Trip,type PreferenceDimension} from '@/lib/model';
import {z} from 'zod';
const intent=intentSchema;
async function consumeLlmQuota(owner:string){const minute=Math.floor(Date.now()/60000),day=new Date().toISOString().slice(0,10);const quota=await database().prepare(`INSERT INTO llm_limits(owner,minute,count,day,daily_count) VALUES (?,?,1,?,1)
 ON CONFLICT(owner) DO UPDATE SET minute=excluded.minute,count=CASE WHEN llm_limits.minute=excluded.minute THEN llm_limits.count+1 ELSE 1 END,day=excluded.day,daily_count=CASE WHEN llm_limits.day=excluded.day THEN llm_limits.daily_count+1 ELSE 1 END
 WHERE (llm_limits.minute!=excluded.minute OR llm_limits.count<6) AND (llm_limits.day!=excluded.day OR llm_limits.daily_count<100) RETURNING owner`).bind(owner,minute,day).first();if(!quota)throw new LlmError('LLM_USER_LIMIT','Bạn đã đạt giới hạn chat (6 lượt/phút hoặc 100 lượt/ngày). Vui lòng thử lại sau.',429);}
function starterCandidate(s:State){const d=s.starter?.draft||{};return {...d,name:(d.name||`${d.from||'Trip'} → ${d.to||'Trip'}`).slice(0,70),passengers:d.passengers??1,baggage:d.baggage??s.profile.baggage??23,transit:d.transit??24,seat:d.seat||s.profile.seat||'No preference'};}
function starterReady(s:State){return intent.safeParse(starterCandidate(s)).success;}
async function load(id:string,profileName:string){const db=database();await db.prepare('INSERT OR IGNORE INTO workspaces (owner,payload,revision) VALUES (?,?,0)').bind(id,JSON.stringify(initialState(profileName))).run();return (await db.prepare('SELECT payload,revision FROM workspaces WHERE owner=?').bind(id).first()) as {payload:string;revision:number};}
export async function GET(r:Request){try{const identity=await authIdentity(r),row=await load(identity.owner,identity.name);return Response.json({state:JSON.parse(row.payload),revision:row.revision,llm:llmStatus(),auth:{kind:identity.kind,name:identity.name,email:identity.email,phone:identity.phone}},{headers:{'Cache-Control':'no-store'}});}catch(e){return failure(e);}}
export async function POST(r:Request){try{mutationGuard(r);const identity=await authIdentity(r),id=identity.owner,b=z.object({action:z.string(),revision:z.number().int(),tripId:z.string().nullable().optional()}).passthrough().parse(await r.json()),row=await load(id,identity.name),s:State=JSON.parse(row.payload);if(typeof s.profile.family!=='boolean')s.profile.family=false;if(b.revision!==row.revision)return Response.json({error:'This trip changed in another tab. Refresh and try again.'},{status:409});let result:any=null;if(!Array.isArray(s.preferenceEvidence))s.preferenceEvidence=[];const t=s.trips.find(x=>x.id===b.tripId);if(b.action==='create'||b.action==='edit'){const parsed=intent.safeParse(b.intent);if(!parsed.success)throw new Error('VALIDATION:Please check the trip fields, airports and dates.');const data=parsed.data;if(b.action==='edit'){if(!t)throw new Error('VALIDATION:Trip not found.');Object.assign(t,data,{version:t.version+1,offers:makeOffers(data)});delete t.pendingIntent;}else {const trip:Trip={...data,id:crypto.randomUUID(),version:1,status:'draft',offers:makeOffers(data),history:[],messages:[{role:'assistant',text:'I have prepared your travel intent. Review your requirements, then start monitoring. These are sample fares until live search is connected.'}]};s.trips.unshift(trip);result={tripId:trip.id};}}
else if(b.action==='starter_chat'){
 const text=z.string().trim().min(1).max(2000).parse(b.text);
 if(!llmStatus().configured)throw new LlmError('LLM_NOT_CONFIGURED','Chat AI chưa được kết nối với Ollama. Hãy làm theo HUONG-DAN-CHAY.md.');
 await consumeLlmQuota(id);
 if(!s.starter)s.starter={messages:[],draft:{}};
 const answer=await startChatWithLlm(s.starter.draft,s.starter.messages,text,s.profile);
 s.starter.messages.push({role:'user',text},{role:'assistant',text:answer.reply});
 s.starter.messages=s.starter.messages.slice(-30);
 s.starter.draft={...s.starter.draft,...answer.patch};
 result={ready:starterReady(s),draft:s.starter.draft};
}
else if(b.action==='starter_reset'){delete s.starter;result={reset:true};}
else if(b.action==='starter_confirm'){
 if(!s.starter)throw new Error('VALIDATION:Start a conversation with LIA first.');
 const parsed=intent.safeParse(starterCandidate(s));
 if(!parsed.success)throw new Error('VALIDATION:LIA still needs your route, travel window and total AUD budget before creating the trip.');
 const data=parsed.data;const trip:Trip={...data,id:crypto.randomUUID(),version:1,status:'draft',offers:makeOffers(data),history:[],messages:[...s.starter.messages,{role:'assistant',text:'Travel Intent created. The options below use sample fares in this prototype; live Vietnam Airlines search is not connected.'}]};
 s.trips.unshift(trip);delete s.starter;result={tripId:trip.id};
}
else if(b.action==='profile'){s.profile={...s.profile,...z.object({name:z.string().trim().min(1).max(60).optional(),member:z.boolean(),personalize:z.boolean(),notifications:z.boolean(),seat:z.enum(['Aisle','Window','No preference']),baggage:z.number().min(0).max(46),family:z.boolean()}).parse(b.profile)};}
else if(b.action==='read'){s.notifications.forEach(n=>n.read=true);}
else {if(!t)throw new Error('VALIDATION:Trip not found.');
if(b.action==='preference_feedback'){const parsed=z.object({offerId:z.string().min(1),dimension:z.enum(['price','transit','journey_time','baggage','miles'])}).parse(b);const offer=t.offers.find(o=>o.id===parsed.offerId);if(!offer)throw new Error('VALIDATION:Offer not found.');s.preferenceEvidence=s.preferenceEvidence.filter(e=>!(e.tripId===t.id&&e.offerId===offer.id));s.preferenceEvidence.push({id:crypto.randomUUID(),tripId:t.id,offerId:offer.id,dimension:parsed.dimension as PreferenceDimension,created:new Date().toISOString()});s.preferenceEvidence=s.preferenceEvidence.slice(-100);result={saved:true};}
else if(b.action==='status'){if(!['monitoring','paused','cancelled'].includes(String(b.status)))throw new Error('VALIDATION:Invalid status.');t.status=String(b.status);}
else if(b.action==='delete'){s.trips=s.trips.filter(x=>x.id!==t.id);s.notifications=s.notifications.filter(x=>x.tripId!==t.id);s.bookings=s.bookings.filter(x=>x.tripId!==t.id);s.preferenceEvidence=s.preferenceEvidence.filter(x=>x.tripId!==t.id);}
else if(b.action==='chat'){
 const text=z.string().trim().min(1).max(2000).parse(b.text);
 if(!llmStatus().configured)throw new LlmError('LLM_NOT_CONFIGURED','Chat AI chưa được kết nối với Ollama. Hãy làm theo HUONG-DAN-CHAY.md.');
 await consumeLlmQuota(id);
 const answer=await chatWithLlm(t,text,s.profile,s.preferenceEvidence);t.messages.push({role:'user',text},{role:'assistant',text:answer.reply});t.feedback=text;t.messages=t.messages.slice(-100);
 delete t.pendingIntent;
 if(Object.keys(answer.patch).length)t.pendingIntent={id:crypto.randomUUID(),patch:answer.patch,baseVersion:t.version};
}
else if(b.action==='confirm_intent'){
 const pending=t.pendingIntent;if(!pending||b.proposalId!==pending.id||pending.baseVersion!==t.version)throw new Error('VALIDATION:Đề xuất đã thay đổi. Hãy tải lại chuyến đi.');
 const current=Object.fromEntries(Object.keys(intentSchema.innerType().shape).map(k=>[k,(t as any)[k]]));
 const merged=intent.parse({...current,...pending.patch});Object.assign(t,merged,{version:t.version+1,offers:makeOffers(merged)});delete t.pendingIntent;
 t.messages.push({role:'assistant',text:'Đã lưu Travel Intent theo đề xuất bạn vừa xác nhận. Bạn có thể tiếp tục chỉnh sửa hoặc xem các lựa chọn mẫu.'});
}
else if(b.action==='dismiss_intent'){if(t.pendingIntent?.id!==b.proposalId)throw new Error('VALIDATION:Đề xuất đã thay đổi.');delete t.pendingIntent;}
else if(b.action==='check'){if(t.status!=='monitoring')throw new Error('VALIDATION:Start monitoring this trip first.');if(t.end<new Date().toISOString().slice(0,10)){t.status='expired';}else {t.offers=makeOffers(t);t.checkedAt=new Date().toISOString();const observed=t.offers.slice().sort((a,b)=>a.price-b.price)[0];if(observed){t.history.push({date:new Date().toLocaleDateString('en-AU',{month:'short',day:'numeric'}),price:observed.price});t.history=t.history.slice(-20);}const best=t.offers.filter(o=>o.price<=t.budget).sort((a,b)=>b.score-a.score)[0];if(best&&s.profile.notifications&&!s.notifications.some(n=>n.tripId===t.id&&!n.read)){const reasons=[`within your AUD ${t.budget.toLocaleString()} budget`,`${best.baggage} kg baggage included`,`${best.transit}h transit`];if(s.profile.personalize&&s.profile.seat!=='No preference')reasons.push(`${s.profile.seat.toLowerCase()} seat preference saved`);if(s.profile.family)reasons.push('family preference considered');if(s.profile.member)reasons.push(`${best.miles.toLocaleString()} sample Lotusmiles shown`);s.notifications.unshift({id:crypto.randomUUID(),tripId:t.id,text:`Strong sample match: ${t.from} → ${t.to} for AUD ${best.price.toLocaleString()} · ${reasons.slice(0,4).join(' · ')}.`,read:false});}result={matched:!!best,observedPrice:observed?.price??null};}}
else if(b.action==='demo_fare_observation'){if(t.status!=='monitoring')throw new Error('VALIDATION:Start monitoring this trip first.');const baseline=makeOffers(t);if(!baseline.length)throw new Error('VALIDATION:No illustrative option is available for this intent. Relax transit or baggage constraints first.');const candidate=baseline.find(o=>o.id==='value')||baseline[0];const targetBelowBudget=Math.max(50,t.budget-20);const simulatedPrice=Math.max(50,Math.min(candidate.price-70,targetBelowBudget));const simulated={...candidate,label:'New observed match · demo',price:simulatedPrice,score:100};t.offers=[simulated,...baseline.filter(o=>o.id!==candidate.id)];t.checkedAt=new Date().toISOString();t.history.push({date:'Demo now',price:simulated.price});t.history=t.history.slice(-20);s.notifications=s.notifications.filter(n=>n.tripId!==t.id);let notificationCreated=false;if(s.profile.notifications){const reasons=[`now within your AUD ${t.budget.toLocaleString()} budget`,`${simulated.transit}h transit is within your ${t.transit}h limit`,`${simulated.baggage} kg baggage meets your saved requirement`];s.notifications.unshift({id:crypto.randomUUID(),tripId:t.id,text:`Demo fare observation: ${t.from} → ${t.to} for AUD ${simulated.price.toLocaleString()} · ${reasons.join(' · ')}.`,read:false});notificationCreated=true;}result={matched:true,previousPrice:candidate.price,price:simulated.price,notificationCreated,source:'simulated-demo-observation'};}
else if(b.action==='reset_demo_observation'){t.offers=makeOffers(t);t.checkedAt=undefined;t.history=[];s.notifications=s.notifications.filter(n=>n.tripId!==t.id);result={reset:true};}
else if(b.action==='booking'){const offer=t.offers.find(o=>o.id===b.offerId);if(!offer||!b.confirmed)throw new Error('VALIDATION:Review and confirm an available offer.');const seat=z.enum(['Aisle','Window','No preference']).parse(b.seat);const extraBag=!!b.extraBag;const booking={id:crypto.randomUUID(),tripId:t.id,offer,seat,extraBag,total:offer.price+(extraBag?65*t.passengers:0),created:new Date().toISOString(),status:'demo-review-complete'};s.bookings.unshift(booking);result=booking;}
else throw new Error('VALIDATION:Unknown action.');}
const update=await database().prepare('UPDATE workspaces SET payload=?,revision=revision+1 WHERE owner=? AND revision=?').bind(JSON.stringify(s),id,row.revision).run();if(!update.meta.changes)return Response.json({error:'Another update was saved. Refresh before retrying.'},{status:409});return Response.json({state:s,revision:row.revision+1,result});}catch(e){if(e instanceof LlmError)return Response.json({error:e.message,code:e.code},{status:e.status});if(e instanceof z.ZodError)return Response.json({error:'Please check your input.'},{status:400});return failure(e);}}

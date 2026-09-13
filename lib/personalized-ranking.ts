import type {Intent,Offer,PreferenceDimension,PreferenceEvidence} from './model';

export type PersonalisedWeights={
 price:number;
 journey_time:number;
 transit:number;
 baggage:number;
 miles:number;
 flexibility:number;
};

const BASE:PersonalisedWeights={price:.34,journey_time:.24,transit:.18,baggage:.12,miles:.08,flexibility:.04};

export function evidenceWeight(item:PreferenceEvidence){
 if(item.strength!=null&&Number.isFinite(item.strength))return Math.max(.25,Math.min(2,item.strength));
 return item.source==='booking'?1.35:item.source==='choice'?1.15:item.source==='filter'?0.85:1;
}

export function personalisedWeights(evidence:PreferenceEvidence[]=[],enabled=true):PersonalisedWeights{
 const weights={...BASE};
 if(enabled){
  const counts:Record<PreferenceDimension,number>={price:0,transit:0,journey_time:0,baggage:0,miles:0};
  for(const item of evidence)counts[item.dimension]+=evidenceWeight(item);
  for(const [dimension,count] of Object.entries(counts) as [PreferenceDimension,number][]){
   const boost=Math.min(.16,.025*count);
   if(dimension==='price')weights.price+=boost;
   else if(dimension==='journey_time')weights.journey_time+=boost;
   else if(dimension==='transit')weights.transit+=boost;
   else if(dimension==='baggage')weights.baggage+=boost;
   else if(dimension==='miles')weights.miles+=boost;
  }
 }
 const total=Object.values(weights).reduce((a,b)=>a+b,0)||1;
 for(const key of Object.keys(weights) as (keyof PersonalisedWeights)[])weights[key]/=total;
 return weights;
}

function inv(value:number,min:number,max:number){return max===min?1:1-(value-min)/(max-min);}
function norm(value:number,min:number,max:number){return max===min?1:(value-min)/(max-min);}
function flex(value:Offer['flexibility']|string|undefined){const v=String(value||'').toLowerCase();return v.includes('flex')||v.includes('more')?1:(v.includes('standard')||v.includes('condition')?0.65:0.35);}

export type RankableMetrics={
 price:number;
 duration:number;
 transit:number;
 baggage:number;
 miles?:number;
 flexibility?:string;
};

export type RankedItem<T>={item:T;score:number;reasons:string[]};

export function rankByPersonalValue<T>(items:T[],metrics:(item:T)=>RankableMetrics,evidence:PreferenceEvidence[]=[],enabled=true,intent?:Pick<Intent,'budget'|'transit'|'baggage'>):RankedItem<T>[] {
 if(!items.length)return [];
 const weights=personalisedWeights(evidence,enabled),m=items.map(metrics);
 const prices=m.map(x=>x.price),durations=m.map(x=>x.duration),transits=m.map(x=>x.transit),bags=m.map(x=>x.baggage),miles=m.map(x=>x.miles||0);
 const minP=Math.min(...prices),maxP=Math.max(...prices),minD=Math.min(...durations),maxD=Math.max(...durations),minT=Math.min(...transits),maxT=Math.max(...transits),minB=Math.min(...bags),maxB=Math.max(...bags),minM=Math.min(...miles),maxM=Math.max(...miles);
 return items.map((item,index)=>{
  const x=m[index];
  const parts={
   price:inv(x.price,minP,maxP),
   journey_time:inv(x.duration,minD,maxD),
   transit:inv(x.transit,minT,maxT),
   baggage:norm(x.baggage,minB,maxB),
   miles:maxM===minM?0:norm(x.miles||0,minM,maxM),
   flexibility:flex(x.flexibility),
  };
  const quality=weights.price*parts.price+weights.journey_time*parts.journey_time+weights.transit*parts.transit+weights.baggage*parts.baggage+weights.miles*parts.miles+weights.flexibility*parts.flexibility;
  const checks=intent?[x.price<=intent.budget,x.transit<=intent.transit,x.baggage>=intent.baggage]:[];
  const constraintFit=checks.length?checks.filter(Boolean).length/checks.length:1;
  const score=100*(checks.length?(0.68*constraintFit+0.32*quality):quality);
  const contributions:[string,number][]=[['Giá phù hợp',weights.price*parts.price],['Hành trình ngắn',weights.journey_time*parts.journey_time],['Transit ngắn',weights.transit*parts.transit],['Hành lý tốt',weights.baggage*parts.baggage],['Lotusmiles',weights.miles*parts.miles],['Điều kiện vé linh hoạt',weights.flexibility*parts.flexibility]];
  const reasons=contributions.sort((a,b)=>b[1]-a[1]).filter(([,v])=>v>0).slice(0,3).map(([label])=>label);
  return {item,score:Math.round(score*10)/10,reasons};
 }).sort((a,b)=>b.score-a.score||metrics(a.item).price-metrics(b.item).price||metrics(a.item).duration-metrics(b.item).duration);
}

export function rankOffersForIntent(offers:Offer[],intent:Pick<Intent,'budget'|'transit'|'baggage'>,evidence:PreferenceEvidence[]=[],enabled=true){
 const ranked=rankByPersonalValue(offers,o=>({price:o.price,duration:o.hours*60,transit:o.transit,baggage:o.baggage,miles:o.miles,flexibility:o.flexibility}),evidence,enabled,intent);
 return ranked.map(r=>({...r.item,personalizedScore:r.score,rankingReasons:r.reasons}));
}

export function inferPreferenceFromChoice<T>(chosen:T,alternatives:T[],metrics:(item:T)=>RankableMetrics):PreferenceDimension|null{
 if(!alternatives.length)return null;
 const c=metrics(chosen),cheapest=[chosen,...alternatives].sort((a,b)=>metrics(a).price-metrics(b).price)[0],low=metrics(cheapest);
 if(c.price<=low.price)return 'price';
 // Only infer a preference when the customer accepted a clear trade-off against the cheapest option.
 if(c.transit+60<=low.transit)return 'transit';
 if(c.duration+60<=low.duration)return 'journey_time';
 if(c.baggage>low.baggage)return 'baggage';
 if((c.miles||0)>(low.miles||0))return 'miles';
 return null;
}

export function preferenceFromIntentPatch(patch:Partial<Intent>):PreferenceDimension|null{
 if(patch.transit!=null)return 'transit';
 if(patch.baggage!=null)return 'baggage';
 if(patch.budget!=null)return 'price';
 return null;
}

export function whyNowForOffer(offer:Offer,intent:Pick<Intent,'budget'|'transit'|'baggage'>,evidence:PreferenceEvidence[]=[],enabled=true){
 const reasons:string[]=[];
 if(intent.budget>=100000||offer.price<=intent.budget)reasons.push(intent.budget>=100000?'Không có giới hạn ngân sách cứng':`Trong ngân sách AUD ${intent.budget.toLocaleString('en-AU')}`);
 if(offer.transit<=intent.transit)reasons.push(`Transit ${offer.transit}h nằm trong giới hạn ${intent.transit}h`);
 if(offer.baggage>=intent.baggage)reasons.push(`${offer.baggage} kg hành lý đáp ứng yêu cầu`);
 if(enabled&&evidence.length){const w=personalisedWeights(evidence,true),ranked=([['price',w.price],['transit',w.transit],['journey_time',w.journey_time],['baggage',w.baggage],['miles',w.miles]] as [PreferenceDimension,number][]).sort((a,b)=>b[1]-a[1])[0];if(ranked){const labels:Record<PreferenceDimension,string>={price:'giá',transit:'transit ngắn',journey_time:'hành trình ngắn',baggage:'hành lý',miles:'Lotusmiles'};reasons.push(`Phù hợp xu hướng ưu tiên ${labels[ranked[0]]} đã học từ lựa chọn của bạn`);}}
 return reasons.slice(0,4);
}

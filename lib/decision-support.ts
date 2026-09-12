import type {Offer,PreferenceDimension,PreferenceEvidence,Trip} from './model';

export const preferenceDimensions:PreferenceDimension[]=['price','transit','journey_time','baggage','miles'];

export function preferenceCounts(evidence:PreferenceEvidence[]){
 const counts:Record<PreferenceDimension,number>={price:0,transit:0,journey_time:0,baggage:0,miles:0};
 for(const item of evidence)counts[item.dimension]=(counts[item.dimension]||0)+1;
 return counts;
}

export function dominantPreference(evidence:PreferenceEvidence[]){
 const counts=preferenceCounts(evidence);
 const entries=preferenceDimensions.map(d=>[d,counts[d]] as const).filter(([,count])=>count>0).sort((a,b)=>b[1]-a[1]);
 if(!entries.length)return null;
 const [dimension,count]=entries[0];
 const tied=entries.filter(([,c])=>c===count).length>1;
 return {dimension,count,tied};
}

export function tripConstraintEvidence(offer:Offer,trip:Trip){
 return {
  budget:offer.price<=trip.budget,
  transit:offer.transit<=trip.transit,
  baggage:offer.baggage>=trip.baggage,
 };
}

export function tripConstraintCount(offer:Offer,trip:Trip){
 const checks=tripConstraintEvidence(offer,trip);
 return Object.values(checks).filter(Boolean).length;
}

export type DirectDecision={kind:'direct-lower'|'equal-known-total'|'direct-higher';action:'explain-and-continue'|'explain-and-monitor';gap:number};

export function directDecisionSupport(otaKnownTotal:number,directIllustrativeTotal:number):DirectDecision{
 const gap=directIllustrativeTotal-otaKnownTotal;
 if(gap<0)return {kind:'direct-lower',action:'explain-and-continue',gap};
 if(gap===0)return {kind:'equal-known-total',action:'explain-and-continue',gap};
 return {kind:'direct-higher',action:'explain-and-monitor',gap};
}

export function offerMatchesPreference(offer:Offer,trip:Trip,dimension:PreferenceDimension){
 const offers=trip.offers;
 if(!offers.length)return false;
 if(dimension==='price')return offer.price===Math.min(...offers.map(o=>o.price));
 if(dimension==='transit')return offer.transit===Math.min(...offers.map(o=>o.transit));
 if(dimension==='journey_time')return offer.hours===Math.min(...offers.map(o=>o.hours));
 if(dimension==='baggage')return offer.baggage===Math.max(...offers.map(o=>o.baggage));
 return offer.miles===Math.max(...offers.map(o=>o.miles));
}

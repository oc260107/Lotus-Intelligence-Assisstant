export type Intent = {name:string;from:string;to:string;start:string;end:string;budget:number;passengers:number;baggage:number;transit:number;seat:string};
export type Offer = {id:string;label:string;price:number;transit:number;hours:number;baggage:number;miles:number;flight:string;score:number};
export type PreferenceDimension='price'|'transit'|'journey_time'|'baggage'|'miles';
export type PreferenceEvidence={id:string;tripId:string;offerId:string;dimension:PreferenceDimension;created:string};
export type StarterConversation={messages:{role:'user'|'assistant';text:string}[];draft:Partial<Intent>};
export type Trip = Intent & {id:string;status:string;messages:{role:string;text:string}[];history:{date:string;price:number}[];offers:Offer[];checkedAt?:string;feedback?:string;version:number;pendingIntent?:{id:string;patch:Partial<Intent>;baseVersion:number}};
export type State = {trips:Trip[];profile:{name:string;member:boolean;personalize:boolean;notifications:boolean;seat:string;baggage:number;family:boolean};notifications:{id:string;tripId:string;text:string;read:boolean}[];bookings:{id:string;tripId:string;offer:Offer;seat:string;extraBag:boolean;total:number;created:string;status:string}[];preferenceEvidence:PreferenceEvidence[];starter?:StarterConversation};
export const blankIntent:Intent={name:'',from:'SYD',to:'HAN',start:'2026-12-10',end:'2026-12-28',budget:1200,passengers:1,baggage:23,transit:4,seat:'Aisle'};
function constraintScore(o:Omit<Offer,'score'>,t:Intent){const checks=[o.price<=t.budget,o.transit<=t.transit,o.baggage>=t.baggage];return Math.round(checks.filter(Boolean).length/checks.length*100);}
export function makeOffers(t:Intent):Offer[]{
 const base=t.from===t.to?0:({HAN:1150,SGN:1090,NRT:1280,DAD:1120,SYD:1190,MEL:1170} as Record<string,number>)[t.to]||1250;
 const offers:Omit<Offer,'score'>[]=[
  {id:'value',label:'Best overall value',price:base*t.passengers,transit:2,hours:14,baggage:23,miles:4500,flight:'VN 772 / VN 216'},
  {id:'price',label:'Lowest price',price:(base-90)*t.passengers,transit:5,hours:17,baggage:23,miles:3200,flight:'VN 780 / VN 210'},
  {id:'time',label:'Shortest journey',price:(base+80)*t.passengers,transit:0,hours:10,baggage:23,miles:4800,flight:'VN 786'},
 ];
 // These are server-side illustrative offers. The score is only the share of three
 // explicit trip constraints met (budget, max transit, baggage), not an ML probability.
 return offers.filter(o=>o.transit<=t.transit&&o.baggage>=t.baggage).map(o=>({...o,score:constraintScore(o,t)}));
}
export function initialState(profileName='Traveller'):State {return {trips:[],profile:{name:profileName,member:false,personalize:false,notifications:true,seat:'Aisle',baggage:23,family:false},notifications:[],bookings:[],preferenceEvidence:[]};}

export type Intent = {name:string;from:string;to:string;start:string;end:string;budget:number;passengers:number;baggage:number;transit:number;seat:string};
export type Offer = {id:string;datasetId?:string;label:string;price:number;transit:number;hours:number;baggage:number;miles:number;flight:string;score:number;departureTime?:string;arrivalTime?:string;stops?:number;flexibility?:'Basic'|'Standard'|'Flexible';source?:'synthetic-demo-dataset'|'simulated-demo-observation'};
export type PreferenceDimension='price'|'transit'|'journey_time'|'baggage'|'miles';
export type PreferenceEvidence={id:string;tripId:string;offerId:string;dimension:PreferenceDimension;created:string};
export type StarterSearchFilters={
  maxPrice?:number|null;
  maxTransit?:number|null;
  minBaggage?:number|null;
  directOnly?:boolean|null;
  transitVia?:string|null;
  sortBy?:'best'|'price'|'duration'|'transit';
  limit?:number;
};
export type StarterSelectedOffer={
  offerId:string;
  departureDate:string;
  departureTime:string;
  arrivalDate:string;
  arrivalTime:string;
  routing:string;
  totalPriceAUD:number;
  totalDurationText:string;
  stops:number;
  transitAirport:string;
  transitCity:string;
  transitMinutes:number;
  baggageKg:number;
  selectedAt:string;
};
export type StarterPendingSuggestion={
  kind:'switch_departure'|'select_offer';
  offerId:string;
  departureDate:string;
  reason:string;
  filters:StarterSearchFilters;
  created:string;
};
export type StarterLastSearch={
  query:string;
  requestedDate:string|null;
  exactMatchIds:string[];
  nearbyMatchIds:string[];
  nearMissIds:string[];
  recommendedOfferId:string|null;
  filters:StarterSearchFilters;
  searchedAt:string;
};
export type StarterConversation={
  messages:{role:'user'|'assistant';text:string}[];
  draft:Partial<Intent>;
  searchFilters?:StarterSearchFilters;
  pendingSuggestion?:StarterPendingSuggestion;
  selectedOfferId?:string|null;
  selectedOffer?:StarterSelectedOffer|null;
  lastSearch?:StarterLastSearch;
  phase?:'collecting'|'searching'|'awaiting-confirmation'|'selected';
};
export type RetrievalSummary={source:'synthetic-demo-dataset';datasetSize:number;routeMatches:number;shown:number};
export type AiRecommendation={offerId:string;summary:string;reasons:string[];tradeoffs:string[];created:string;model:string};
export type Trip = Intent & {id:string;status:string;selectedOffer?:StarterSelectedOffer|null;messages:{role:string;text:string}[];history:{date:string;price:number}[];offers:Offer[];retrieval?:RetrievalSummary;aiRecommendation?:AiRecommendation;checkedAt?:string;feedback?:string;version:number;pendingIntent?:{id:string;patch:Partial<Intent>;baseVersion:number}};
export type State = {trips:Trip[];profile:{name:string;member:boolean;personalize:boolean;notifications:boolean;seat:string;baggage:number;family:boolean};notifications:{id:string;tripId:string;text:string;read:boolean}[];bookings:{id:string;tripId:string;offer:Offer;seat:string;extraBag:boolean;total:number;created:string;status:string}[];preferenceEvidence:PreferenceEvidence[];starter?:StarterConversation};
export const blankIntent:Intent={name:'',from:'SYD',to:'HAN',start:'2026-12-10',end:'2026-12-28',budget:1200,passengers:1,baggage:23,transit:4,seat:'Aisle'};
export function initialState(profileName='Traveller'):State {return {trips:[],profile:{name:profileName,member:false,personalize:false,notifications:true,seat:'Aisle',baggage:23,family:false},notifications:[],bookings:[],preferenceEvidence:[]};}

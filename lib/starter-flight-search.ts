import flightsData from '../data/synthetic-flights.json';
import type {PreferenceEvidence} from './model';
import {rankByPersonalValue} from './personalized-ranking';

export type StarterSearchSort='best'|'price'|'duration'|'transit';
export type StarterSearchFilters={
 from:string;
 to:string;
 departureDate?:string|null;
 windowStart?:string|null;
 windowEnd?:string|null;
 passengers?:number;
 maxPrice?:number|null;
 maxTransit?:number|null;
 minBaggage?:number|null;
 directOnly?:boolean|null;
 requireTransit?:boolean|null;
 transitVia?:string|null;
 excludeChina?:boolean|null;
 sortBy?:StarterSearchSort;
 limit?:number;
 personalization?:{enabled:boolean;evidence:PreferenceEvidence[]};
};

type RawFlight={
 offer_id:string;route:string;origin:string;destination:string;departure_date:string;departure_time_local:string;
 arrival_date:string;arrival_time_local:string;routing:string;stops:number;transit_airport:string;transit_airport_name:string;
 transit_city:string;transit_minutes:number;total_duration_minutes:number;total_duration_text:string;flight_reference:string;
 aircraft_reference:string;demo_fare_type:string;synthetic_price_aud:number;checked_baggage_kg_demo:number;flexibility_demo:string;
 connection_profile:string;synthetic_flag:boolean;synthetic_note:string;
};

export type StarterFlightCandidate={
 id:string;route:string;departureDate:string;departureTime:string;arrivalDate:string;arrivalTime:string;routing:string;
 stops:number;transitAirport:string;transitCity:string;transitMinutes:number;totalDurationMinutes:number;totalDurationText:string;
 totalPriceAUD:number;baggageKg:number;fareType:string;flexibility:string;flightReference:string;synthetic:true;
 rankingScore:number;rankingReasons:string[];
};
export type StarterNearMiss=StarterFlightCandidate&{violations:string[];relaxations:string[]};
export type StarterFlightSearchResult={
 requestedDate:string|null;
 routeRows:number;
 exactDateRows:number;
 exactMatches:StarterFlightCandidate[];
 nearbyMatches:StarterFlightCandidate[];
 sameDateNearMisses:StarterNearMiss[];
 recommended:StarterFlightCandidate|null;
 recommendationBasis:'exact'|'nearby'|'near-miss'|'none';
};

const DATA=flightsData as RawFlight[];
const CHINA=new Set(['CAN','PVG','XMN','PEK','PKX','CTU','TFU','KMG','SZX']);
const AUSTRALIA=new Set(['SYD','MEL','PER','BNE','ADL','CBR']);
const VIETNAM=new Set(['HAN','SGN','DAD','CXR','HUI','PQC']);

function dayNumber(date:string){const t=Date.parse(date+'T00:00:00Z');return Number.isFinite(t)?Math.floor(t/86400000):0;}
function normalise(s:string){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');}
function transitMatches(r:RawFlight,via?:string|null){
 if(!via)return true;
 if(r.stops===0)return false;
 const v=normalise(via),airport=(r.transit_airport||'').toUpperCase(),city=normalise(r.transit_city||'');
 if(['china','trungquoc','cn'].includes(v))return CHINA.has(airport);
 if(['australia','uc','au'].includes(v))return AUSTRALIA.has(airport);
 if(['vietnam','vn'].includes(v))return VIETNAM.has(airport);
 const aliases:Record<string,string[]>={
  guangzhou:['can','guangzhou','quangchau'],shanghai:['pvg','sha','shanghai','thuonghai'],xiamen:['xmn','xiamen','hammon'],
  melbourne:['mel','melbourne'],perth:['per','perth'],hochiminhcity:['sgn','hochiminhcity','hochiminh','saigon','tphcm'],
 };
 for(const vals of Object.values(aliases))if(vals.map(normalise).includes(v))return vals.some(x=>normalise(x)===normalise(airport)||normalise(x)===city);
 return v===normalise(airport)||city.includes(v)||normalise(r.transit_airport_name||'').includes(v);
}
function candidate(r:RawFlight,passengers=1):StarterFlightCandidate{
 return {id:r.offer_id,route:r.route,departureDate:r.departure_date,departureTime:r.departure_time_local,arrivalDate:r.arrival_date,
  arrivalTime:r.arrival_time_local,routing:r.routing,stops:r.stops,transitAirport:r.transit_airport||'',transitCity:r.transit_city||'',
  transitMinutes:r.transit_minutes,totalDurationMinutes:r.total_duration_minutes,totalDurationText:r.total_duration_text,
  totalPriceAUD:r.synthetic_price_aud*Math.max(1,passengers),baggageKg:r.checked_baggage_kg_demo,fareType:r.demo_fare_type,
  flexibility:r.flexibility_demo,flightReference:r.flight_reference,synthetic:true,rankingScore:0,rankingReasons:[]};
}
function strictMatch(r:RawFlight,c:StarterFlightCandidate,f:StarterSearchFilters){
 if(f.maxPrice!=null&&c.totalPriceAUD>f.maxPrice)return false;
 if(f.maxTransit!=null&&c.transitMinutes>f.maxTransit*60)return false;
 if(f.minBaggage!=null&&c.baggageKg<f.minBaggage)return false;
 if(f.directOnly===true&&c.stops!==0)return false;
 if(f.requireTransit===true&&c.stops===0)return false;
 if(f.excludeChina===true&&CHINA.has((r.transit_airport||'').toUpperCase()))return false;
 if(f.transitVia&&!transitMatches(r,f.transitVia))return false;
 return true;
}
function violationDetails(r:RawFlight,c:StarterFlightCandidate,f:StarterSearchFilters){
 const violations:string[]=[],relaxations:string[]=[];
 if(f.maxPrice!=null&&c.totalPriceAUD>f.maxPrice){const delta=c.totalPriceAUD-f.maxPrice;violations.push(`Giá AUD ${c.totalPriceAUD} cao hơn mức AUD ${f.maxPrice} khoảng AUD ${delta}.`);relaxations.push(`Tăng ngưỡng giá lên ít nhất AUD ${c.totalPriceAUD}.`);}
 if(f.maxTransit!=null&&c.transitMinutes>f.maxTransit*60){const hours=Math.round(c.transitMinutes/6)/10;violations.push(`Transit ${hours} giờ vượt giới hạn ${f.maxTransit} giờ.`);relaxations.push(`Nới transit tối đa lên khoảng ${hours} giờ.`);}
 if(f.minBaggage!=null&&c.baggageKg<f.minBaggage){violations.push(`Hành lý ${c.baggageKg} kg thấp hơn yêu cầu ${f.minBaggage} kg.`);relaxations.push(`Giảm yêu cầu hành lý xuống ${c.baggageKg} kg.`);}
 if(f.directOnly===true&&c.stops!==0){violations.push(`Chuyến có ${c.stops} điểm dừng, không phải bay thẳng.`);relaxations.push(`Cho phép tối đa ${c.stops} điểm dừng.`);}
 if(f.requireTransit===true&&c.stops===0){violations.push('Chuyến này bay thẳng trong khi bạn yêu cầu có transit.');relaxations.push('Bỏ yêu cầu bắt buộc transit.');}
 if(f.excludeChina===true&&CHINA.has((r.transit_airport||'').toUpperCase())){violations.push(`Điểm transit ${c.transitAirport} thuộc nhóm Trung Quốc đang loại trừ.`);relaxations.push('Bỏ điều kiện tránh transit Trung Quốc.');}
 if(f.transitVia&&!transitMatches(r,f.transitVia)){violations.push(`Điểm transit ${c.transitCity||c.transitAirport||'khác'} không khớp yêu cầu ${f.transitVia}.`);relaxations.push(`Bỏ hoặc đổi yêu cầu transit qua ${f.transitVia}.`);}
 return {violations,relaxations};
}
function rank(list:StarterFlightCandidate[],sortBy:StarterSearchSort='best',personalization?:StarterSearchFilters['personalization']){
 if(!list.length)return list;
 if(sortBy==='price')return list.map(c=>({...c,rankingScore:100,rankingReasons:['Ưu tiên giá thấp nhất theo yêu cầu hiện tại.']})).sort((a,b)=>a.totalPriceAUD-b.totalPriceAUD||a.totalDurationMinutes-b.totalDurationMinutes);
 if(sortBy==='duration')return list.map(c=>({...c,rankingScore:100,rankingReasons:['Ưu tiên tổng thời gian hành trình ngắn nhất theo yêu cầu hiện tại.']})).sort((a,b)=>a.totalDurationMinutes-b.totalDurationMinutes||a.totalPriceAUD-b.totalPriceAUD);
 if(sortBy==='transit')return list.map(c=>({...c,rankingScore:100,rankingReasons:['Ưu tiên thời gian transit ngắn nhất theo yêu cầu hiện tại.']})).sort((a,b)=>a.transitMinutes-b.transitMinutes||a.totalPriceAUD-b.totalPriceAUD);
 const ranked=rankByPersonalValue(list,c=>({price:c.totalPriceAUD,duration:c.totalDurationMinutes,transit:c.transitMinutes,baggage:c.baggageKg,flexibility:c.flexibility}),personalization?.evidence||[],!!personalization?.enabled);
 return ranked.map(r=>({...r.item,rankingScore:r.score,rankingReasons:r.reasons}));
}

export function getStarterFlightById(id:string,passengers=1):StarterFlightCandidate|null{
 const row=DATA.find(r=>r.offer_id===id);return row?candidate(row,passengers):null;
}
export function getStarterRouteCount(from:string,to:string){return DATA.filter(r=>r.origin===from&&r.destination===to).length;}

export function searchStarterFlights(f:StarterSearchFilters):StarterFlightSearchResult{
 const passengers=Math.max(1,f.passengers||1),limit=Math.max(1,Math.min(6,f.limit||3));
 const route=DATA.filter(r=>r.origin===f.from&&r.destination===f.to);
 const exactRows=f.departureDate?route.filter(r=>r.departure_date===f.departureDate):(f.windowStart||f.windowEnd)?route.filter(r=>(!f.windowStart||r.departure_date>=f.windowStart)&&(!f.windowEnd||r.departure_date<=f.windowEnd)):route;
 const strict=exactRows.map(r=>({r,c:candidate(r,passengers)})).filter(x=>strictMatch(x.r,x.c,f)).map(x=>x.c);
 const exact=rank(strict,f.sortBy,f.personalization).slice(0,limit);
 let nearby:StarterFlightCandidate[]=[];
 if(f.departureDate&&exact.length===0){
  const target=dayNumber(f.departureDate);
  const eligible=route.map(r=>({r,c:candidate(r,passengers),delta:Math.abs(dayNumber(r.departure_date)-target)})).filter(x=>x.delta>0&&x.delta<=14&&strictMatch(x.r,x.c,f));
  const byDay=new Map<number,StarterFlightCandidate[]>();for(const x of eligible){if(!byDay.has(x.delta))byDay.set(x.delta,[]);byDay.get(x.delta)!.push(x.c);}
  const deltas=[...byDay.keys()].sort((a,b)=>a-b);
  for(const d of deltas){nearby.push(...rank(byDay.get(d)!,f.sortBy,f.personalization));if(nearby.length>=limit)break;}
  nearby=nearby.slice(0,limit);
 }
 const nearMisses=exactRows.map(r=>{const c=candidate(r,passengers),v=violationDetails(r,c,f);return {...c,...v};})
  .filter(x=>x.violations.length>0).sort((a,b)=>a.violations.length-b.violations.length||a.totalPriceAUD-b.totalPriceAUD||a.totalDurationMinutes-b.totalDurationMinutes).slice(0,limit);
 const recommended=exact[0]||nearby[0]||nearMisses[0]||null;
 return {requestedDate:f.departureDate||null,routeRows:route.length,exactDateRows:exactRows.length,exactMatches:exact,nearbyMatches:nearby,sameDateNearMisses:nearMisses,recommended,recommendationBasis:exact.length?'exact':nearby.length?'nearby':nearMisses.length?'near-miss':'none'};
}

export type StarterRoundTripCombo = {
  id: string;
  outbound: StarterFlightCandidate;
  return: StarterFlightCandidate;
  totalPriceAUD: number;
  totalDurationMinutes: number;
  totalTransitMinutes: number;
  rankingScore: number;
};

export type StarterRoundTripSearchInput = {
  from: string;
  to: string;
  startDate: string;
  endDate: string;
  dateMode?: 'fixed' | 'window';
  passengers?: number;
  filters?: {
    maxPrice?: number | null;
    maxTransit?: number | null;
    minBaggage?: number | null;
    directOnly?: boolean | null;
    requireTransit?: boolean | null;
    transitVia?: string | null;
    excludeChina?: boolean | null;
    sortBy?: StarterSearchSort;
    limit?: number;
    personalization?:{enabled:boolean;evidence:PreferenceEvidence[]};
  };
  limit?: number;
};

export function searchStarterRoundTrip(
  input: StarterRoundTripSearchInput,
) {
  const passengers = Math.max(1, input.passengers || 1);
  const limit = Math.max(1, Math.min(6, input.limit || 3));

  const commonFilters = {
    passengers,
    maxPrice: input.filters?.maxPrice ?? null,
    maxTransit: input.filters?.maxTransit ?? null,
    minBaggage: input.filters?.minBaggage ?? null,
    directOnly: input.filters?.directOnly ?? null,
    requireTransit: input.filters?.requireTransit ?? null,
    transitVia: input.filters?.transitVia ?? null,
    excludeChina: input.filters?.excludeChina ?? null,
    sortBy: input.filters?.sortBy || 'best',
    limit,
    personalization: input.filters?.personalization,
  };

  const outboundResult = searchStarterFlights({
    ...commonFilters,
    from: input.from,
    to: input.to,
    departureDate: input.startDate,
  });

  const returnResult = searchStarterFlights({
    ...commonFilters,
    from: input.to,
    to: input.from,
    departureDate: input.endDate,
  });

  const outboundFlights = outboundResult.exactMatches.length
    ? outboundResult.exactMatches
    : outboundResult.nearbyMatches;

  const returnFlights = returnResult.exactMatches.length
    ? returnResult.exactMatches
    : returnResult.nearbyMatches;

  const combos: StarterRoundTripCombo[] = [];

  for (const outbound of outboundFlights) {
    for (const returnFlight of returnFlights) {
      const totalPriceAUD =
        outbound.totalPriceAUD + returnFlight.totalPriceAUD;

      const totalDurationMinutes =
        outbound.totalDurationMinutes +
        returnFlight.totalDurationMinutes;

      const totalTransitMinutes =
        outbound.transitMinutes +
        returnFlight.transitMinutes;

      const rankingScore =
        Math.round(
          ((outbound.rankingScore + returnFlight.rankingScore) / 2) * 10,
        ) / 10;

      combos.push({
        id: `${outbound.id}__${returnFlight.id}`,
        outbound,
        return: returnFlight,
        totalPriceAUD,
        totalDurationMinutes,
        totalTransitMinutes,
        rankingScore,
      });
    }
  }

  const sortBy = input.filters?.sortBy || 'best';

  if (sortBy === 'price') {
    combos.sort((a, b) => a.totalPriceAUD - b.totalPriceAUD);
  } else if (sortBy === 'duration') {
    combos.sort(
      (a, b) => a.totalDurationMinutes - b.totalDurationMinutes,
    );
  } else if (sortBy === 'transit') {
    combos.sort(
      (a, b) => a.totalTransitMinutes - b.totalTransitMinutes,
    );
  } else {
    const personalised = rankByPersonalValue(
      combos,
      c => ({
        price: c.totalPriceAUD,
        duration: c.totalDurationMinutes,
        transit: c.totalTransitMinutes,
        baggage: Math.min(c.outbound.baggageKg, c.return.baggageKg),
        flexibility: `${c.outbound.flexibility || ''} ${c.return.flexibility || ''}`,
      }),
      input.filters?.personalization?.evidence || [],
      !!input.filters?.personalization?.enabled,
    );
    const scores = new Map(personalised.map(x => [x.item.id, x.score]));
    combos.sort((a, b) => (scores.get(b.id) || 0) - (scores.get(a.id) || 0) || a.totalPriceAUD - b.totalPriceAUD);
    for (const combo of combos) combo.rankingScore = scores.get(combo.id) || combo.rankingScore;
  }

  return {
    combos: combos.slice(0, limit),
    routeRowsOutbound: outboundResult.routeRows,
    routeRowsReturn: returnResult.routeRows,
  };
}
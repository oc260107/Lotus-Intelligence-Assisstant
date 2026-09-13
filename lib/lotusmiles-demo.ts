import type {LotusmilesAppliedRedemption} from './model';

export type LotusmilesDemoProfile={
  member:boolean;
  lotusTier?:string;
  lotusMilesBalance?:number;
  lotusMilesExpiring?:number;
};

export type LotusmilesBenefitKind='business-upgrade'|'preferred-seat'|'extra-baggage';
export type LotusmilesBenefitOption={
  id:string;
  kind:LotusmilesBenefitKind;
  title:string;
  description:string;
  milesCost:number;
  milesCostPerTraveller:number;
  available:boolean;
  reason:string;
  badge:string;
  targetCabin?:'business';
  disclaimer:string;
};

export const LOTUSMILES_DEMO_DEFAULTS={tier:'Gold',balance:40000,expiring:8000};
export const LOTUSMILES_BUSINESS_RULE={milesPerTraveller:18000,taxPerTravellerPerDirectionAUD:92,baggageKg:40,eligibleFareFamily:'Economy Standard / Economy Flex'};

export function lotusBalance(profile:LotusmilesDemoProfile){return Math.max(0,Math.round(profile.lotusMilesBalance??LOTUSMILES_DEMO_DEFAULTS.balance));}
export function lotusTier(profile:LotusmilesDemoProfile){return profile.lotusTier||LOTUSMILES_DEMO_DEFAULTS.tier;}
export function lotusExpiring(profile:LotusmilesDemoProfile){return Math.max(0,Math.round(profile.lotusMilesExpiring??LOTUSMILES_DEMO_DEFAULTS.expiring));}

export function buildLotusmilesBusinessUpgrade(profile:LotusmilesDemoProfile,input:{passengers:number;flexibility?:string|null;baseItineraryId:string;directions?:number}):LotusmilesAppliedRedemption|null{
  const passengers=Math.max(1,Math.round(input.passengers||1));
  const directions=Math.max(1,Math.min(2,Math.round(input.directions||1)));
  const balance=lotusBalance(profile),tier=lotusTier(profile),flex=String(input.flexibility||'').toLowerCase();
  const eligible=!flex.includes('basic');
  const milesUsed=LOTUSMILES_BUSINESS_RULE.milesPerTraveller*passengers;
  const cashTaxesAUD=LOTUSMILES_BUSINESS_RULE.taxPerTravellerPerDirectionAUD*passengers*directions;
  if(!profile.member||!eligible||balance<milesUsed)return null;
  return {
    id:`lotus-business:${input.baseItineraryId}`,
    kind:'business-upgrade',
    baseItineraryId:input.baseItineraryId,
    tier,
    startingBalance:balance,
    milesUsed,
    milesPerTraveller:LOTUSMILES_BUSINESS_RULE.milesPerTraveller,
    remainingBalance:balance-milesUsed,
    cashTaxesAUD,
    taxPerTravellerAUD:LOTUSMILES_BUSINESS_RULE.taxPerTravellerPerDirectionAUD*directions,
    eligibleFareFamily:LOTUSMILES_BUSINESS_RULE.eligibleFareFamily,
    targetCabin:'business',
    baggageKg:LOTUSMILES_BUSINESS_RULE.baggageKg,
    benefits:['Business cabin','Complimentary Business seat selection','Priority check-in & boarding','Business lounge access','40 kg checked baggage'],
    source:'prototype-lotusmiles'
  };
}

export function lotusmilesDemoBenefits(profile:LotusmilesDemoProfile,input:{passengers:number;flexibility?:string|null;requestedCabin?:string|null}) : LotusmilesBenefitOption[]{
  const passengers=Math.max(1,input.passengers||1),balance=lotusBalance(profile),member=!!profile.member,tier=lotusTier(profile);
  const upgradePerTraveller=LOTUSMILES_BUSINESS_RULE.milesPerTraveller,upgradeCost=upgradePerTraveller*passengers;
  const baggagePerTraveller=7500,baggageCost=baggagePerTraveller*passengers;
  const flexibleEnough=!String(input.flexibility||'').toLowerCase().includes('basic');
  const wantsEconomy=String(input.requestedCabin||'').toLowerCase()==='economy';
  return [
    {
      id:'demo-business-upgrade',kind:'business-upgrade',
      title:wantsEconomy?'Consider Business with Lotusmiles':'Business upgrade opportunity',
      description:`Upgrade the itinerary to Business using ${upgradePerTraveller.toLocaleString('en-AU')} miles per traveller.`,
      milesCost:upgradeCost,milesCostPerTraveller:upgradePerTraveller,
      available:member&&flexibleEnough&&balance>=upgradeCost,
      reason:!member?'Connect the Lotusmiles member experience first.':!flexibleEnough?'Basic fares are not upgrade-eligible in this prototype.':balance<upgradeCost?`Need ${upgradeCost.toLocaleString('en-AU')} miles; current balance is ${balance.toLocaleString('en-AU')}.`:`Your ${tier} member balance can cover this Business upgrade.`,
      badge:'SMART UPGRADE',targetCabin:'business',
      disclaimer:'Prototype redemption rule. Production values must come from authorised Lotusmiles systems.'
    },
    {
      id:'demo-preferred-seat',kind:'preferred-seat',
      title:'Preferred-seat member value',
      description:'Surface preferred-seat eligibility during checkout so the traveller does not need to look up benefits manually.',
      milesCost:0,milesCostPerTraveller:0,
      available:member,
      reason:member?`${tier} member context is active.`:'Connect the Lotusmiles member experience first.',
      badge:'MEMBER BENEFIT',
      disclaimer:'Prototype member-benefit rule.'
    },
    {
      id:'demo-extra-baggage',kind:'extra-baggage',
      title:'Redeem miles for +10 kg baggage',
      description:`Use ${baggagePerTraveller.toLocaleString('en-AU')} miles per traveller for +10 kg baggage.`,
      milesCost:baggageCost,milesCostPerTraveller:baggagePerTraveller,
      available:member&&balance>=baggageCost,
      reason:!member?'Connect the Lotusmiles member experience first.':balance<baggageCost?`Need ${baggageCost.toLocaleString('en-AU')} miles; current balance is ${balance.toLocaleString('en-AU')}.`:`Current member balance can cover this redemption.`,
      badge:'REDEEM MILES',
      disclaimer:'Prototype redemption rule.'
    }
  ];
}

export function bestLotusmilesDemoBenefit(profile:LotusmilesDemoProfile,input:{passengers:number;flexibility?:string|null;requestedCabin?:string|null}){
  const options=lotusmilesDemoBenefits(profile,input);
  const business=options.find(x=>x.kind==='business-upgrade'&&x.available);
  if(business)return business;
  return options.find(x=>x.kind==='preferred-seat'&&x.available)||options.find(x=>x.available)||null;
}

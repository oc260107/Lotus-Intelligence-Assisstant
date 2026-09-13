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

export const LOTUSMILES_DEMO_DEFAULTS={tier:'Gold',balance:24500,expiring:8000};

export function lotusBalance(profile:LotusmilesDemoProfile){return Math.max(0,Math.round(profile.lotusMilesBalance??LOTUSMILES_DEMO_DEFAULTS.balance));}
export function lotusTier(profile:LotusmilesDemoProfile){return profile.lotusTier||LOTUSMILES_DEMO_DEFAULTS.tier;}
export function lotusExpiring(profile:LotusmilesDemoProfile){return Math.max(0,Math.round(profile.lotusMilesExpiring??LOTUSMILES_DEMO_DEFAULTS.expiring));}

export function lotusmilesDemoBenefits(profile:LotusmilesDemoProfile,input:{passengers:number;flexibility?:string|null;requestedCabin?:string|null}) : LotusmilesBenefitOption[]{
  const passengers=Math.max(1,input.passengers||1),balance=lotusBalance(profile),member=!!profile.member,tier=lotusTier(profile);
  const upgradePerTraveller=18000,upgradeCost=upgradePerTraveller*passengers;
  const baggagePerTraveller=7500,baggageCost=baggagePerTraveller*passengers;
  const flexibleEnough=!String(input.flexibility||'').toLowerCase().includes('basic');
  const wantsEconomy=String(input.requestedCabin||'').toLowerCase()==='economy';
  return [
    {
      id:'demo-business-upgrade',kind:'business-upgrade',
      title:wantsEconomy?'Consider Business with Lotusmiles':'Business upgrade opportunity',
      description:`Upgrade the outbound cabin to Business in this prototype using ${upgradePerTraveller.toLocaleString('en-AU')} sample miles per traveller.`,
      milesCost:upgradeCost,milesCostPerTraveller:upgradePerTraveller,
      available:member&&flexibleEnough&&balance>=upgradeCost,
      reason:!member?'Connect the Lotusmiles member experience first.':!flexibleEnough?'This demo treats Basic fares as not upgrade-eligible.':balance<upgradeCost?`Need ${upgradeCost.toLocaleString('en-AU')} sample miles; current sample balance is ${balance.toLocaleString('en-AU')}.`:`Your ${tier} demo context has enough sample miles for this upgrade concept.`,
      badge:'SMART UPGRADE',targetCabin:'business',
      disclaimer:'Illustrative prototype rule only — not an official Vietnam Airlines redemption rate. Live fare-class eligibility, taxes and mileage requirements must be verified by Lotusmiles.'
    },
    {
      id:'demo-preferred-seat',kind:'preferred-seat',
      title:'Preferred seat selection · demo member benefit',
      description:'Show preferred-seat selection as AUD 0 in this prototype member journey instead of making the traveller manually remember the benefit.',
      milesCost:0,milesCostPerTraveller:0,
      available:member,
      reason:member?`${tier} demo context is active.`:'Connect the Lotusmiles member experience first.',
      badge:'MEMBER BENEFIT',
      disclaimer:'Illustrative tier benefit only. Actual complimentary-seat eligibility depends on member tier, fare, route and Vietnam Airlines rules.'
    },
    {
      id:'demo-extra-baggage',kind:'extra-baggage',
      title:'Redeem miles for +10 kg baggage · demo',
      description:`Use ${baggagePerTraveller.toLocaleString('en-AU')} sample miles per traveller for an illustrative +10 kg baggage redemption.`,
      milesCost:baggageCost,milesCostPerTraveller:baggagePerTraveller,
      available:member&&balance>=baggageCost,
      reason:!member?'Connect the Lotusmiles member experience first.':balance<baggageCost?`Need ${baggageCost.toLocaleString('en-AU')} sample miles; current sample balance is ${balance.toLocaleString('en-AU')}.`:`Current sample balance can cover this redemption concept.`,
      badge:'REDEEM MILES',
      disclaimer:'Illustrative prototype rule only — actual baggage redemption rates and eligibility must come from authorised Lotusmiles systems.'
    }
  ];
}

export function bestLotusmilesDemoBenefit(profile:LotusmilesDemoProfile,input:{passengers:number;flexibility?:string|null;requestedCabin?:string|null}){
  const options=lotusmilesDemoBenefits(profile,input);
  const business=options.find(x=>x.kind==='business-upgrade'&&x.available);
  if(business)return business;
  return options.find(x=>x.kind==='preferred-seat'&&x.available)||options.find(x=>x.available)||null;
}

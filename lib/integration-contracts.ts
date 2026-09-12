/** Implement these server-only ports when the approved VNA contracts are available.
 * Never trust client prices, client identities or LLM-generated booking records.
 * No speculative endpoint paths or credentials are included.
 */
import type { Intent, Offer } from './model';
export interface FlightSearchPort { search(intent:Intent):Promise<{offers:Offer[];observedAt:string;expiresAt:string}> }
export interface IntentUnderstandingPort { parse(text:string,current:Intent|null):Promise<{proposed:Partial<Intent>;needsConfirmation:boolean;question?:string}> }
export interface OfferExtractionPort { extract(bytes:ArrayBuffer,mime:string):Promise<{route?:string;date?:string;fare?:number;currency?:string;baggage?:string;confidence:number}> }
export interface LoyaltyPort { getProfile(verifiedVnaCustomerId:string):Promise<{tier:string;balance:number;expiringMiles:number}> }
export interface BookingPort { reprice(offerId:string):Promise<{quoteId:string;total:number;expiresAt:string}>; createSecureHandoff(quoteId:string,passengerProfileReference:string):Promise<{url:string}> }
export interface NotificationPort { deliver(userId:string,tripId:string,message:string):Promise<void> }
export class IntegrationUnavailable extends Error { constructor(service:string){super(`${service} is not connected`)} }

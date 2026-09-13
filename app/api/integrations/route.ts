import {llmStatus} from '@/lib/llm';
export async function GET(){return Response.json({mode:'demo',services:{vnaSearch:'not-connected',lotusmiles:'not-connected',ocr:'not-connected',llm:llmStatus(),payment:'not-connected',push:'not-connected',scheduledMonitoring:'manual-demo-only'}});}
export async function POST(){return Response.json({error:'Live VNA booking/payment integration is not connected. LIA can complete only the clearly labelled local demo-payment flow.'},{status:501});}

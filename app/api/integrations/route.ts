import {llmStatus} from '@/lib/llm';
export async function GET(){return Response.json({mode:'demo',services:{vnaSearch:'not-connected',lotusmiles:'not-connected',ocr:'not-connected',llm:llmStatus(),payment:'not-connected',push:'not-connected',scheduledMonitoring:'not-connected'}});}
export async function POST(){return Response.json({error:'Live VNA booking is not connected. No payment was taken and no ticket was issued.'},{status:501});}

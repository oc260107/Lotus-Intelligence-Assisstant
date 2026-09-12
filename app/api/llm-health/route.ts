import {owner,failure} from '@/lib/server';
import {checkLlm} from '@/lib/llm';
export async function GET(r:Request){try{await owner(r);return Response.json(await checkLlm(),{headers:{'Cache-Control':'no-store'}});}catch(e){return failure(e);}}

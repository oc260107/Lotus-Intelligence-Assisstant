import {z} from 'zod';
export const intentFields={name:z.string().trim().min(1).max(70),from:z.enum(['SYD','MEL','HAN','SGN','DAD','NRT']),to:z.enum(['SYD','MEL','HAN','SGN','DAD','NRT']),start:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),end:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),budget:z.number().min(100).max(100000),passengers:z.number().int().min(1).max(9),baggage:z.number().min(0).max(46),transit:z.number().min(0).max(24),seat:z.enum(['Aisle','Window','No preference'])};
const validDate=(s:string)=>!Number.isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
export const intentSchema=z.object(intentFields).strict().refine(x=>validDate(x.start)&&validDate(x.end)&&x.from!==x.to&&x.end>=x.start&&x.start>=new Date().toISOString().slice(0,10),'Kiểm tra sân bay và ngày đi trong tương lai.');
export const patchSchema=z.object(intentFields).partial().strict();

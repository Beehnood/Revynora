import { Injectable } from "@nestjs/common";
import { Worker } from "node:worker_threads";
import { ApiError } from "../shared/http/errors";
import {
  MAX_PDF_BYTES,
  pagesSchema,
  type DocumentPages,
} from "./document.schema";
// A separate, bounded V8 isolate: no rendering, eval, URL loading or PDF actions.
const extractor = `
const {parentPort,workerData}=require('node:worker_threads');
(async()=>{
 const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
 const task=getDocument({data:new Uint8Array(workerData),isEvalSupported:false,useSystemFonts:false,useWorkerFetch:false,disableFontFace:true,isOffscreenCanvasSupported:false,isImageDecoderSupported:false,stopAtErrors:true,verbosity:0});
 let doc;
 try {
  doc=await task.promise;
  if(doc.numPages>25 || await doc.getJSActions() || await doc.getAttachments())throw Error('Unsupported document');
  const pages=[];let total=0;
  for(let n=1;n<=doc.numPages;n++){
   const p=await doc.getPage(n);
   if(await p.getJSActions())throw Error('Active document');
   const annotations=await p.getAnnotations();
   if(annotations.some(a=>a.actions || a.attachment || a.action || a.unsafeUrl || a.url))throw Error('Active annotation');
   let text='';
   const stream=p.streamTextContent();const reader=stream.getReader();
   while(true){const next=await reader.read();if(next.done)break;
    for(const i of next.value.items){if(typeof i.str==='string'){text+=i.str+(i.hasEOL?'\\n':' ');total+=i.str.length+1;if(total>60000)throw Error('Text limit');}}
   }
   pages.push({page:n,text:text.trim()});p.cleanup();
  }
  if(pages.reduce((n,p)=>n+p.text.length,0)<40)throw Error('No readable text');
  parentPort.postMessage({pages});
 }finally{await task.destroy();}
})().catch(()=>parentPort.postMessage({error:true}));
`;
@Injectable()
export class PdfExtractor {
  private active = 0;
  async extract(buffer: Buffer): Promise<DocumentPages> {
    if (
      !buffer.length ||
      buffer.length > MAX_PDF_BYTES ||
      !buffer
        .subarray(0, 8)
        .toString("ascii")
        .match(/^%PDF-1\.[0-7]|^%PDF-2\.0/) ||
      !buffer.subarray(-1024).includes(Buffer.from("%%EOF"))
    )
      throw new ApiError(
        422,
        "PDF_INVALID",
        "PDF invalide, trop volumineux ou illisible.",
      );
    if (this.active >= 2)
      throw new ApiError(
        429,
        "PDF_BUSY",
        "Le traitement PDF est occupé. Réessayez plus tard.",
      );
    this.active++;
    try {
      return await new Promise<DocumentPages>((resolve, reject) => {
        const worker = new Worker(extractor, {
          eval: true,
          workerData: buffer,
          resourceLimits: {
            maxOldGenerationSizeMb: 128,
            maxYoungGenerationSizeMb: 16,
          },
          stdout: true,
          stderr: true,
        });
        // Never propagate parser output or document text to application logs.
        worker.stdout.resume();
        worker.stderr.resume();
        const timer = setTimeout(() => {
          void worker.terminate();
          reject(
            new ApiError(
              422,
              "PDF_TIMEOUT",
              "Extraction trop longue. Utilisez un PDF plus court.",
            ),
          );
        }, 10000);
        const fail = () =>
          reject(
            new ApiError(
              422,
              "PDF_UNREADABLE",
              "PDF protégé, actif, trop complexe ou sans texte lisible. Les scans nécessitent un OCR non disponible.",
            ),
          );
        worker.once("message", (value) => {
          if (value?.error) fail();
          else {
            const parsed = pagesSchema.safeParse(value?.pages);
            if (parsed.success) resolve(parsed.data);
            else fail();
          }
          void worker.terminate();
        });
        worker.once("error", fail);
        worker.once("exit", () => {
          clearTimeout(timer);
          fail();
        });
      });
    } finally {
      this.active--;
    }
  }
}

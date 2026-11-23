import { Injectable, Logger } from "@nestjs/common";
import { Worker } from "node:worker_threads";
import { ApiError } from "../shared/http/errors";
import {
  MAX_PDF_BYTES,
  MAX_PDF_PAGES,
  MAX_PDF_TEXT,
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
  if(doc.numPages>${MAX_PDF_PAGES})return parentPort.postMessage({reason:'PDF_PAGE_LIMIT'});
  if(await doc.getJSActions() || await doc.getAttachments())return parentPort.postMessage({reason:'PDF_ACTIVE_CONTENT'});
  const pages=[];let total=0;
  for(let n=1;n<=doc.numPages;n++){
   const p=await doc.getPage(n);
   if(await p.getJSActions())return parentPort.postMessage({reason:'PDF_ACTIVE_CONTENT'});
   const annotations=await p.getAnnotations();
   if(annotations.some(a=>a.actions || a.attachment || a.action || a.unsafeUrl || a.url))return parentPort.postMessage({reason:'PDF_ACTIVE_CONTENT'});
   let text='';
   const stream=p.streamTextContent();const reader=stream.getReader();
   while(true){const next=await reader.read();if(next.done)break;
    for(const i of next.value.items){if(typeof i.str==='string'){text+=i.str+(i.hasEOL?'\\n':' ');total+=i.str.length+1;if(total>${MAX_PDF_TEXT})return parentPort.postMessage({reason:'PDF_TEXT_LIMIT'});}}
   }
   pages.push({page:n,text:text.trim()});p.cleanup();
  }
  if(pages.reduce((n,p)=>n+p.text.length,0)<40)return parentPort.postMessage({reason:'PDF_INSUFFICIENT_TEXT'});
  parentPort.postMessage({pages});
 }catch(error){
  parentPort.postMessage({reason:error?.name==='PasswordException'?'PDF_PASSWORD_REQUIRED':'PDF_UNREADABLE'});
 }finally{await task.destroy();}
})().catch(()=>parentPort.postMessage({reason:'PDF_UNREADABLE'}));
`;
const extractionMessages = {
  PDF_PAGE_LIMIT: `Le PDF dépasse la limite de ${MAX_PDF_PAGES} pages.`,
  PDF_ACTIVE_CONTENT:
    "Ce PDF contient des liens, des actions ou des pièces jointes que l’import refuse.",
  PDF_TEXT_LIMIT:
    "Le PDF contient trop de texte pour être importé. Choisissez un document plus court.",
  PDF_INSUFFICIENT_TEXT:
    "Trop peu de texte a pu être extrait. Les pages scannées nécessitent un OCR, qui est indisponible ici.",
  PDF_PASSWORD_REQUIRED: "Ce PDF est protégé par un mot de passe.",
  PDF_UNREADABLE: "Le texte du PDF n’a pas pu être extrait.",
  PDF_TIMEOUT: "Extraction trop longue. Utilisez un PDF plus court.",
};

@Injectable()
export class PdfExtractor {
  private active = 0;
  private readonly logger = new Logger(PdfExtractor.name);

  private extractionError(reason: keyof typeof extractionMessages) {
    this.logger.warn(reason);
    return new ApiError(422, reason, extractionMessages[reason]);
  }
  async extract(buffer: Buffer): Promise<DocumentPages> {
    if (buffer.length > MAX_PDF_BYTES)
      throw new ApiError(
        413,
        "PDF_TOO_LARGE",
        "Le PDF dépasse la taille maximale autorisée.",
      );
    if (
      !buffer.length ||
      !buffer
        .subarray(0, 8)
        .toString("ascii")
        .match(/^%PDF-1\.[0-7]|^%PDF-2\.0/) ||
      !buffer.subarray(-1024).includes(Buffer.from("%%EOF"))
    )
      throw new ApiError(
        422,
        "PDF_INVALID",
        "Le fichier ne présente pas un en-tête et une fin de PDF valides.",
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
          fail("PDF_TIMEOUT");
        }, 10000);
        let reported = false;
        const fail = (
          reason: keyof typeof extractionMessages = "PDF_UNREADABLE",
        ) => {
          if (reported) return;
          reported = true;
          reject(this.extractionError(reason));
        };
        worker.once("message", (value) => {
          const reason = value?.reason;
          if (
            typeof reason === "string" &&
            Object.hasOwn(extractionMessages, reason)
          )
            fail(reason as keyof typeof extractionMessages);
          else {
            const parsed = pagesSchema.safeParse(value?.pages);
            if (parsed.success) {
              reported = true;
              resolve(parsed.data);
            } else fail();
          }
          void worker.terminate();
        });
        worker.once("error", () => fail());
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

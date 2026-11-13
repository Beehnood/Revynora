import { PdfQuizService } from "./pdf-quiz.service";
import { PdfUploadGuard } from "./pdf-upload.guard";
import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DocumentsController } from "./documents.controller";
import { DocumentsService } from "./documents.service";
import { PdfExtractor } from "./pdf-extractor";
import { DocumentAi } from "./document-ai";
@Module({
  imports: [AuthModule],
  controllers: [DocumentsController],
  providers: [
    PdfQuizService,
    DocumentsService,
    PdfExtractor,
    DocumentAi,
    PdfUploadGuard,
  ],
})
export class DocumentsModule {}

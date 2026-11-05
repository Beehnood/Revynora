import {
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBody, ApiConsumes, ApiCookieAuth, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import type { AuthRequest } from "../auth/auth.service";
import { LearningAccessGuard } from "../auth/learning-access.guard";
import { parse } from "../shared/http/errors";
import { DocumentsService } from "./documents.service";
import { PdfUploadGuard } from "./pdf-upload.guard";
import { MAX_PDF_BYTES } from "./document.schema";
const idSchema = z.string().uuid();
@ApiTags("Documents pédagogiques")
@ApiCookieAuth()
@UseGuards(LearningAccessGuard)
@Controller("documents")
export class DocumentsController {
  constructor(
    @Inject(DocumentsService) private readonly documents: DocumentsService,
  ) {}
  @Get("config") config(@Req() r: AuthRequest) {
    return this.documents.configuration(r.student.id);
  }
  @Get() list(@Req() r: AuthRequest, @Query("page") page: unknown) {
    return this.documents.list(
      r.student.id,
      parse(z.coerce.number().int().min(1).max(10000).default(1), page),
    );
  }
  @Get(":id") get(@Req() r: AuthRequest, @Param("id") id: string) {
    return this.documents.get(r.student.id, parse(idSchema, id));
  }
  @Post()
  @UseGuards(PdfUploadGuard)
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["file"],
      properties: { file: { type: "string", format: "binary" } },
    },
  })
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: MAX_PDF_BYTES, files: 1, fields: 0, parts: 2 },
    }),
  )
  upload(
    @Req() r: AuthRequest,
    @UploadedFile()
    file?: { buffer: Buffer; originalname: string; mimetype: string },
  ) {
    return this.documents.upload(r.student.id, file);
  }
  @Post(":id/analyze") analyze(@Req() r: AuthRequest, @Param("id") id: string) {
    return this.documents.analyze(r.student.id, parse(idSchema, id));
  }
  @Delete(":id") remove(@Req() r: AuthRequest, @Param("id") id: string) {
    return this.documents.remove(r.student.id, parse(idSchema, id));
  }
}

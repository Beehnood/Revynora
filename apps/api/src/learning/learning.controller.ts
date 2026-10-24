import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiTags,
  ApiCookieAuth,
  ApiBody,
  ApiQuery,
  ApiResponse,
  ApiHeader,
} from "@nestjs/swagger";
import { z } from "zod";
import {
  answerSchema,
  courseSchema,
  diagnosticSchema,
  idSchema,
  paginationSchema,
} from "@revynora/validation";
import type { SchemaObject } from "@nestjs/swagger/dist/interfaces/open-api-spec.interface";
import type { AuthRequest } from "../auth/auth.service";
import { LearningAccessGuard } from "../auth/learning-access.guard";
import { parse } from "../shared/http/errors";
import { LearningService } from "./learning.service";
import { AiService } from "../ai/ai.service";
const body = (schema: z.ZodType) => {
  const converted = z.toJSONSchema(schema, { unrepresentable: "any" });
  delete converted.$schema; // OpenAPI 3.0 SchemaObject does not accept the draft marker.
  return ApiBody({ schema: converted as SchemaObject });
};
@ApiTags("Pédagogie")
@ApiCookieAuth()
@ApiHeader({
  name: "X-Revynora-Client",
  required: false,
  description: "Valeur web obligatoire pour POST/PUT (protection CSRF)",
})
@ApiResponse({ status: 401, description: "Session absente ou expirée" })
@ApiResponse({ status: 403, description: "Rôle ou origine refusé" })
@ApiResponse({
  status: 404,
  description: "Ressource inexistante ou appartenant à un autre étudiant",
})
@UseGuards(LearningAccessGuard)
@Controller()
export class LearningController {
  constructor(
    @Inject(LearningService) private readonly learning: LearningService,
    @Inject(AiService) private readonly ai: AiService,
  ) {}
  @Get("learning/config") config(@Req() req: AuthRequest) {
    return this.ai.configuration(req.student.id);
  }
  @Get("learning/summary") summary(@Req() req: AuthRequest) {
    return this.learning.summary(req.student.id);
  }
  @Get("courses")
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "pageSize", required: false, type: Number })
  courses(@Req() req: AuthRequest, @Query() query: unknown) {
    const p = parse(paginationSchema, query);
    return this.learning.courses(req.student.id, p.page, p.pageSize);
  }
  @Post("courses") @body(courseSchema) course(
    @Req() req: AuthRequest,
    @Body() data: unknown,
  ) {
    return this.learning.createCourse(
      req.student.id,
      parse(courseSchema, data),
    );
  }
  @Post("quizzes/diagnostic")
  @body(diagnosticSchema)
  @ApiResponse({ status: 429, description: "Quota quotidien atteint" })
  @ApiResponse({ status: 503, description: "Échec du fournisseur IA" })
  diagnostic(@Req() req: AuthRequest, @Body() data: unknown) {
    return this.learning.diagnostic(
      req.student.id,
      parse(diagnosticSchema, data),
    );
  }
  @Get("quizzes/:id") quiz(@Req() req: AuthRequest, @Param("id") id: string) {
    return this.learning.quiz(req.student.id, parse(idSchema, id));
  }
  @Post("quizzes/:id/attempts") createAttempt(
    @Req() req: AuthRequest,
    @Param("id") id: string,
  ) {
    return this.learning.createAttempt(req.student.id, parse(idSchema, id));
  }
  @Get("attempts")
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "pageSize", required: false, type: Number })
  history(@Req() req: AuthRequest, @Query() query: unknown) {
    const p = parse(paginationSchema, query);
    return this.learning.history(req.student.id, p.page, p.pageSize);
  }
  @Get("attempts/:id") attempt(
    @Req() req: AuthRequest,
    @Param("id") id: string,
  ) {
    return this.learning.attempt(req.student.id, parse(idSchema, id));
  }
  @Put("attempts/:id/answers/:questionId")
  @body(answerSchema)
  @ApiResponse({ status: 409, description: "Tentative déjà soumise" })
  answer(
    @Req() req: AuthRequest,
    @Param("id") id: string,
    @Param("questionId") questionId: string,
    @Body() data: unknown,
  ) {
    return this.learning.saveAnswer(
      req.student.id,
      parse(idSchema, id),
      parse(idSchema, questionId),
      parse(answerSchema, data).selectedOptionIds,
    );
  }
  @Post("attempts/:id/submit")
  @ApiResponse({ status: 409, description: "Réponses incomplètes" })
  submit(@Req() req: AuthRequest, @Param("id") id: string) {
    return this.learning.submit(req.student.id, parse(idSchema, id));
  }
}

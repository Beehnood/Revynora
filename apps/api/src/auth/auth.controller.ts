import {
  Body,
  Controller,
  Get,
  Inject,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiBody, ApiCookieAuth } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { registerSchema, loginSchema } from "@revynora/validation";
import { AuthService, type AuthRequest } from "./auth.service";
import { StudentGuard } from "./student.guard";
import { parse } from "../shared/http/errors";
@ApiTags("Authentification")
@Controller("auth")
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}
  @Post("register")
  @ApiBody({
    schema: {
      type: "object",
      required: ["name", "email", "password"],
      properties: {
        name: { type: "string" },
        email: { type: "string", format: "email" },
        password: { type: "string", minLength: 12, maxLength: 128 },
      },
    },
  })
  register(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.auth.register(parse(registerSchema, body), req, res);
  }
  @Post("login")
  @ApiBody({
    schema: {
      type: "object",
      required: ["email", "password"],
      properties: {
        email: { type: "string", format: "email" },
        password: { type: "string", minLength: 12, maxLength: 128 },
      },
    },
  })
  login(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.auth.login(parse(loginSchema, body), req, res);
  }
  @Post("logout") logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.auth.logout(req, res);
  }
}
@ApiTags("Profil")
@ApiCookieAuth()
@UseGuards(StudentGuard)
@Controller("users")
export class UsersController {
  @Get("me") me(@Req() req: AuthRequest) {
    return req.student;
  }
}

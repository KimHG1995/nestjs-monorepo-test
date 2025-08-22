import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { ProblemDetails } from '../interfaces/problem-details.interface';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let detail: string | object;
    let title: string;

    if (exception instanceof HttpException) {
      const errorResponse = exception.getResponse();
      title = exception.message;
      detail = typeof errorResponse === 'object' ? (errorResponse as any).message || errorResponse : errorResponse;
    } else {
      title = 'Internal Server Error';
      detail = process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : (exception as Error).stack;
    }

    const problemDetails: ProblemDetails = {
      type: `https://example.com/errors/${status}`,
      title,
      status,
      detail,
      instance: request.url,
    };

    response
      .status(status)
      .set({ 'Content-Type': 'application/problem+json' })
      .json(problemDetails);
  }
}

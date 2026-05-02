import { z } from 'zod';

/**
 * Schema for the runtime environment of the signaling server. Centralizing the
 * shape lets us fail fast at boot when configuration drifts and gives the rest
 * of the codebase a typed, validated object to depend on.
 */
const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z
    .string()
    .optional()
    .default('3010')
    .transform((value, ctx) => {
      const parsed = Number(value);
      if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'PORT must be an integer between 1 and 65535',
        });
        return z.NEVER;
      }
      return parsed;
    }),
  CORS_ORIGIN: z.string().min(1).default('*'),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  TURN_URL: z.string().url().optional(),
  TURN_USER: z.string().min(1).optional(),
  TURN_PASS: z.string().min(1).optional(),
});

export type IServerEnv = z.infer<typeof envSchema>;

export class EnvValidationError extends Error {
  constructor(
    message: string,
    public readonly issues: readonly z.ZodIssue[],
  ) {
    super(message);
    this.name = 'EnvValidationError';
  }
}

/**
 * Parse and validate the given environment record. Throws EnvValidationError
 * with a human-readable summary of the failures when validation fails.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): IServerEnv {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const summary = result.error.issues
      .map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`)
      .join('; ');
    throw new EnvValidationError(
      `Invalid server environment: ${summary}`,
      result.error.issues,
    );
  }

  // TURN credentials must be all-or-nothing.
  const env = result.data;
  const turnFields = [env.TURN_URL, env.TURN_USER, env.TURN_PASS];
  const turnDefined = turnFields.filter((value) => value !== undefined).length;
  if (turnDefined !== 0 && turnDefined !== 3) {
    throw new EnvValidationError(
      'Invalid server environment: TURN_URL, TURN_USER, and TURN_PASS must be set together or not at all',
      [],
    );
  }

  return env;
}

/**
 * Public-safe view of the loaded env (omits TURN credentials) so it can be
 * logged at boot without leaking secrets.
 */
export function describeEnv(env: IServerEnv): Record<string, unknown> {
  return {
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
    corsOrigin: env.CORS_ORIGIN,
    logLevel: env.LOG_LEVEL,
    turnConfigured: env.TURN_URL !== undefined,
  };
}

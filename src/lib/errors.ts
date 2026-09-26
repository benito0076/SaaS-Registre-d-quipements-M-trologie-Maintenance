import { PLAN_LIMIT_CODE } from "./plan";

/**
 * Erreurs métier. Une ressource appartenant à une autre organisation est
 * signalée par NotFoundError (jamais 403) afin de ne pas permettre de
 * deviner l'existence d'un identifiant (§5 – Isolation des données).
 */
export class NotFoundError extends Error {
  readonly status = 404;
  constructor(message = "Ressource introuvable") {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ForbiddenError extends Error {
  readonly status = 403;
  constructor(message = "Action non autorisée pour votre rôle") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class PlanLimitError extends Error {
  readonly status = 402;
  readonly code = PLAN_LIMIT_CODE;
  constructor(message = "Limite du plan gratuit atteinte") {
    super(message);
    this.name = "PlanLimitError";
  }
}

export class ConflictError extends Error {
  readonly status = 409;
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

export class ValidationError extends Error {
  readonly status = 400;
  constructor(
    message: string,
    readonly fieldErrors: Record<string, string[] | undefined> = {},
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

export type AppError =
  | NotFoundError
  | ForbiddenError
  | PlanLimitError
  | ConflictError
  | ValidationError;

export function isAppError(e: unknown): e is AppError {
  return (
    e instanceof NotFoundError ||
    e instanceof ForbiddenError ||
    e instanceof PlanLimitError ||
    e instanceof ConflictError ||
    e instanceof ValidationError
  );
}

/** Code PostgreSQL 23505 = violation de contrainte d'unicité. */
export function isUniqueViolation(e: unknown): boolean {
  const code = (e as { code?: string; cause?: { code?: string } })?.code
    ?? (e as { cause?: { code?: string } })?.cause?.code;
  return code === "23505";
}

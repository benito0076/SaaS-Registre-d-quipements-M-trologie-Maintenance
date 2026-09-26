import { FREE_PLAN_EQUIPMENT_LIMIT, PLAN_LIMIT_CODE } from "./plan";

/**
 * Erreurs métier. Le message est une clé de traduction du namespace
 * « errors » (messages/*.json) ; la traduction est faite à la frontière
 * (Server Action ou Route Handler) selon la langue de l'utilisateur.
 *
 * Une ressource appartenant à une autre organisation est signalée par
 * NotFoundError (jamais 403) afin de ne pas permettre de deviner l'existence
 * d'un identifiant (§5 – Isolation des données).
 */
export type ErrorKey =
  | "notFound"
  | "forbidden"
  | "planLimit"
  | "duplicateInternalId"
  | "emailTaken"
  | "lastAdmin"
  | "cannotRemoveSelf"
  | "invalidData"
  | "invalidJson"
  | "invalidRole"
  | "emptyFile"
  | "fileTooLarge"
  | "unsupportedFile";

abstract class KeyedError extends Error {
  abstract readonly status: number;
  constructor(
    readonly key: ErrorKey,
    readonly params: Record<string, string | number> = {},
  ) {
    super(key);
  }
}

export class NotFoundError extends KeyedError {
  readonly status = 404;
  constructor() {
    super("notFound");
    this.name = "NotFoundError";
  }
}

export class ForbiddenError extends KeyedError {
  readonly status = 403;
  constructor() {
    super("forbidden");
    this.name = "ForbiddenError";
  }
}

export class PlanLimitError extends KeyedError {
  readonly status = 402;
  readonly code = PLAN_LIMIT_CODE;
  constructor() {
    super("planLimit", { limit: FREE_PLAN_EQUIPMENT_LIMIT });
    this.name = "PlanLimitError";
  }
}

export class ConflictError extends KeyedError {
  readonly status = 409;
  constructor(key: ErrorKey) {
    super(key);
    this.name = "ConflictError";
  }
}

/**
 * `fieldErrors` contient, par champ, des clés du namespace « validation »
 * (éventuellement suffixées d'un paramètre numérique : « tooLong:100 »).
 */
export class ValidationError extends KeyedError {
  readonly status = 400;
  constructor(
    key: ErrorKey,
    readonly fieldErrors: Record<string, string[] | undefined> = {},
  ) {
    super(key);
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
  return e instanceof KeyedError;
}

/** Code PostgreSQL 23505 = violation de contrainte d'unicité. */
export function isUniqueViolation(e: unknown): boolean {
  const code = (e as { code?: string; cause?: { code?: string } })?.code
    ?? (e as { cause?: { code?: string } })?.cause?.code;
  return code === "23505";
}

import { Resend } from "resend";

export interface EmailMessage {
  to: string[];
  subject: string;
  html: string;
  text: string;
  /** Clé d'idempotence Resend : évite un double envoi lors d'une reprise. */
  idempotencyKey?: string;
}

export interface EmailSender {
  send(message: EmailMessage): Promise<{ id: string | null }>;
}

/** Erreur d'envoi ; `retryable` = false pour les erreurs de validation (4xx). */
export class EmailError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "EmailError";
  }
}

const NON_RETRYABLE = new Set<string>([
  "validation_error",
  "missing_required_field",
  "invalid_from_address",
  "invalid_parameter",
  "invalid_api_key",
  "restricted_api_key",
  "missing_api_key",
  "invalid_idempotency_key",
  "invalid_idempotent_request",
  "monthly_quota_exceeded",
  "daily_quota_exceeded",
]);

class ResendSender implements EmailSender {
  private client: Resend;
  constructor(
    apiKey: string,
    private from: string,
  ) {
    this.client = new Resend(apiKey);
  }

  async send(message: EmailMessage) {
    const { data, error } = await this.client.emails.send(
      {
        from: this.from,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
      },
      message.idempotencyKey ? { idempotencyKey: message.idempotencyKey } : undefined,
    );
    if (error) {
      throw new EmailError(`${error.name}: ${error.message}`, !NON_RETRYABLE.has(error.name));
    }
    return { id: data?.id ?? null };
  }
}

/** Sans RESEND_API_KEY : les e-mails sont écrits dans les logs (développement). */
class ConsoleSender implements EmailSender {
  async send(message: EmailMessage) {
    console.info(
      `[email:console] à=${message.to.join(",")} sujet="${message.subject}"\n${message.text}`,
    );
    return { id: null };
  }
}

export function getEmailSender(): EmailSender {
  const key = process.env.RESEND_API_KEY;
  if (!key) return new ConsoleSender();
  return new ResendSender(key, process.env.EMAIL_FROM ?? "Registre Métrologie <alertes@example.com>");
}

export function appUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

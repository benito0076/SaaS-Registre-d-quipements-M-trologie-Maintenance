import { notFound } from "next/navigation";
import { NotFoundError } from "./errors";

/** Convertit NotFoundError en page 404 Next.js. */
export async function orNotFound<T>(promise: Promise<T>): Promise<T> {
  try {
    return await promise;
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
}

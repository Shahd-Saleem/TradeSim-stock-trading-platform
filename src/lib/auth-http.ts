import type { PrismaClient } from "@/generated/prisma/client";
import type { createAuth } from "./auth-core";
import { loginSchema, registrationSchema } from "./auth-validation";
import { consumeAuthAttempt } from "./auth-throttle";

async function limitedBody(request: Request): Promise<string | null> {
  const reader = request.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) return text + decoder.decode();
    bytes += chunk.value.byteLength;
    if (bytes > 8192) {
      await reader.cancel();
      return null;
    }
    text += decoder.decode(chunk.value, { stream: true });
  }
}

export function createAuthHttp(
  auth: ReturnType<typeof createAuth>,
  db: PrismaClient,
  baseURL: string,
  secret: string,
  databaseSchema = "tradesim",
) {
  const origin = new URL(baseURL).origin;
  const error = (message: string, status: number) =>
    Response.json(
      { message },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  return {
    async GET(request: Request) {
      try {
        const response = await auth.handler(request);
        response.headers.set("Cache-Control", "private, no-store");
        return response;
      } catch {
        return error("Authentication is temporarily unavailable.", 503);
      }
    },
    async POST(request: Request) {
      try {
        if (request.headers.get("origin") !== origin)
          return error("Invalid request origin.", 403);
        const path = new URL(request.url).pathname;
        if (
          path.endsWith("/sign-in/email") ||
          path.endsWith("/sign-up/email")
        ) {
          if (Number(request.headers.get("content-length") ?? "0") > 8192)
            return error("Request too large.", 413);
          const raw = await limitedBody(request);
          if (raw === null) return error("Request too large.", 413);
          let body: unknown;
          try {
            body = JSON.parse(raw);
          } catch {
            return error("Invalid request.", 400);
          }
          const schema = path.endsWith("/sign-up/email")
            ? registrationSchema
            : loginSchema;
          const parsed = schema.safeParse(body);
          if (!parsed.success)
            return error(
              "Enter a valid email, name where required, and a password of 12–128 characters.",
              400,
            );
          if (
            !(await consumeAuthAttempt(
              db,
              parsed.data.email,
              secret,
              databaseSchema,
            ))
          )
            return error(
              "Too many attempts. Please try again in 15 minutes.",
              429,
            );
          const headers = new Headers(request.headers);
          headers.delete("content-length");
          request = new Request(request.url, {
            method: "POST",
            headers,
            body: JSON.stringify(parsed.data),
          });
        }
        const response = await auth.handler(request);
        if (response.status >= 400 && response.status !== 429)
          return error(
            "Unable to authenticate. Check your details and try again.",
            response.status >= 500 ? 503 : 400,
          );
        response.headers.set("Cache-Control", "private, no-store");
        return response;
      } catch {
        return error("Authentication is temporarily unavailable.", 503);
      }
    },
  };
}

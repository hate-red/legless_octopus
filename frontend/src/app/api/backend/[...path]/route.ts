import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "credit_session";
const API_ROOT = (
  process.env.BACKEND_URL ?? "http://127.0.0.1:8000/api"
).replace(/\/$/, "");
const allowedRoots = new Set([
  "auth",
  "products",
  "applications",
  "bank",
  "company",
  "notifications",
]);
const MAX_BODY = 11 * 1024 * 1024;
class BodyTooLarge extends Error {}
async function limitedBody(request: NextRequest) {
  if (!request.body) return undefined;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY) {
      await reader.cancel();
      throw new BodyTooLarge();
    }
    chunks.push(value);
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

async function proxy(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  if (!allowedRoots.has(path[0]))
    return NextResponse.json({ detail: "Маршрут не найден" }, { status: 404 });
  if (request.method !== "GET" && request.method !== "HEAD") {
    const origin = request.headers.get("origin");
    const expectedOrigin = process.env.APP_ORIGIN;
    const sameOrigin =
      !origin ||
      (expectedOrigin
        ? origin === expectedOrigin
        : URL.canParse(origin) &&
          new URL(origin).host === request.headers.get("host"));
    if (!sameOrigin)
      return NextResponse.json(
        { detail: "Недопустимый источник запроса" },
        { status: 403 },
      );
  }
  const cookieStore = await cookies();
  if (path.join("/") === "auth/logout" && request.method === "POST") {
    const response = NextResponse.json({ message: "Вы вышли из кабинета" });
    response.cookies.delete(SESSION_COOKIE);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const login = path.join("/") === "auth/login" && request.method === "POST";
  if (!token && !login)
    return NextResponse.json({ detail: "Войдите в кабинет" }, { status: 401 });
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY)
    return NextResponse.json(
      { detail: "Максимальный размер файла — 10 МБ" },
      { status: 413 },
    );
  try {
    const headers = new Headers();
    if (token && !login) headers.set("Authorization", `Bearer ${token}`);
    const contentType = request.headers.get("content-type");
    if (contentType) headers.set("Content-Type", contentType);
    const response = await fetch(
      `${API_ROOT}/${path.map(encodeURIComponent).join("/")}${request.nextUrl.search}`,
      {
        method: request.method,
        headers,
        body: ["GET", "HEAD"].includes(request.method)
          ? undefined
          : await limitedBody(request),
        cache: "no-store",
        signal: AbortSignal.timeout(120_000),
      },
    );
    if (login && response.ok) {
      const result = await response.json();
      const output = NextResponse.json({ user: result.user });
      output.cookies.set(SESSION_COOKIE, result.access_token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.COOKIE_SECURE === "true",
        path: "/",
        maxAge: 86400,
      });
      output.headers.set("Cache-Control", "private, no-store");
      return output;
    }
    const outgoing = new Headers({ "Cache-Control": "private, no-store" });
    for (const name of [
      "content-type",
      "content-disposition",
      "x-content-type-options",
    ]) {
      const value = response.headers.get(name);
      if (value) outgoing.set(name, value);
    }
    const output = new NextResponse(
      response.status === 204 ? null : response.body,
      { status: response.status, headers: outgoing },
    );
    if (response.status === 401) output.cookies.delete(SESSION_COOKIE);
    return output;
  } catch (error) {
    if (error instanceof BodyTooLarge)
      return NextResponse.json(
        { detail: "Максимальный размер файла — 10 МБ" },
        { status: 413 },
      );
    return NextResponse.json(
      { detail: "Сервер временно недоступен. Попробуйте ещё раз." },
      { status: 503 },
    );
  }
}
export {
  proxy as GET,
  proxy as POST,
  proxy as PUT,
  proxy as PATCH,
  proxy as DELETE,
};

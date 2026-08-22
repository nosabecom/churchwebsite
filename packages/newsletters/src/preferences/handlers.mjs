import { createNewsletterPreferenceService } from "./service.mjs";
import { validatePreferenceSubmission } from "./validation.mjs";

const GENERIC_REQUEST_MESSAGE =
  "If this request can be processed, a verification email will arrive shortly.";
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{40,100}$/;

function json(body, status = 200, headers = {}) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    },
  });
}

function redirect(origin, result) {
  const target = new URL("/newsletters/", origin);
  target.searchParams.set("newsletter-preference", result);
  target.hash = "newsletter-preferences";
  return new Response(null, {
    status: 303,
    headers: {
      Location: target.toString(),
      "Cache-Control": "no-store",
    },
  });
}

function confirmationPage(token) {
  return new Response(
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Confirm newsletter preference</title>
    <style>
      :root { color-scheme: light; font-family: ui-sans-serif, system-ui, sans-serif; }
      body { min-height: 100vh; margin: 0; display: grid; place-items: center; background: #f8fafc; color: #0f172a; }
      main { width: min(36rem, calc(100% - 2rem)); box-sizing: border-box; padding: clamp(1.5rem, 5vw, 3rem); border: 1px solid #cbd5e1; border-radius: 1.5rem; background: #fff; box-shadow: 0 1.25rem 3rem rgb(15 23 42 / 10%); }
      h1 { margin-top: 0; font-size: clamp(1.75rem, 6vw, 2.5rem); line-height: 1.1; }
      p { color: #475569; line-height: 1.65; }
      button { width: 100%; margin-top: 1rem; padding: .9rem 1.25rem; border: 0; border-radius: .8rem; background: #b91c1c; color: #fff; font: inherit; font-weight: 750; cursor: pointer; }
      button:focus-visible { outline: 3px solid #b91c1c; outline-offset: 3px; }
    </style>
  </head>
  <body>
    <main>
      <h1>Confirm your newsletter preference</h1>
      <p>Selecting the button below will apply the preference you requested. This extra step prevents email-security scanners from changing a Breeze profile simply by opening the link.</p>
      <form method="post" action="/api/newsletter-preferences/verify">
        <input type="hidden" name="token" value="${token}">
        <button type="submit">Confirm my preference</button>
      </form>
    </main>
  </body>
</html>`,
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "Content-Security-Policy":
          "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
        "Content-Type": "text/html; charset=utf-8",
        "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}

function acceptsHtml(request) {
  return request.headers.get("accept")?.includes("text/html");
}

function requestOrigin(request, allowedOrigins) {
  const origin = request.headers.get("origin");
  return origin && allowedOrigins.has(origin) ? origin : undefined;
}

function clientIp(request) {
  const forwarded =
    request.headers.get("x-vercel-forwarded-for") ??
    request.headers.get("x-forwarded-for") ??
    "unknown";
  return forwarded.split(",")[0].trim().slice(0, 128);
}

async function parseSubmission(request) {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > 8_192) throw new Error("request-too-large");
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) return await request.json();
  if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    return Object.fromEntries(await request.formData());
  }
  throw new Error("unsupported-content-type");
}

export function createNewsletterPreferenceHandlers(options = {}) {
  let service;
  function getService() {
    service ??= options.service ?? createNewsletterPreferenceService(options);
    return service;
  }

  return {
    async request(request) {
      if (request.method !== "POST") {
        return json({ error: "Method not allowed." }, 405, { Allow: "POST" });
      }

      let currentService;
      try {
        currentService = getService();
      } catch (error) {
        console.error("Newsletter preference service is not configured.", {
          error: error instanceof Error ? error.message : "Unknown error",
        });
        return json({ error: "Newsletter preferences are temporarily unavailable." }, 503);
      }

      const origin = requestOrigin(request, currentService.config.allowedOrigins);
      if (!origin) return json({ error: "Request origin is not allowed." }, 403);

      let input;
      try {
        input = await parseSubmission(request);
      } catch {
        return json({ error: "The submitted form could not be read." }, 400);
      }

      if (input.website) {
        return acceptsHtml(request)
          ? redirect(origin, "requested")
          : json({ ok: true, message: GENERIC_REQUEST_MESSAGE }, 202);
      }

      const validated = validatePreferenceSubmission(input);
      if (!validated.success) {
        return acceptsHtml(request)
          ? redirect(origin, "invalid")
          : json({ error: "Check the highlighted fields.", fields: validated.errors }, 400);
      }

      try {
        const result = await currentService.requestVerification({
          submission: validated.data,
          clientIp: clientIp(request),
          origin,
        });
        console.info("Newsletter verification request accepted.", {
          requestId: result.requestId,
          status: result.status,
        });
        return acceptsHtml(request)
          ? redirect(origin, "requested")
          : json({ ok: true, message: GENERIC_REQUEST_MESSAGE }, 202);
      } catch (error) {
        console.error("Newsletter verification request failed.", {
          error: error instanceof Error ? error.message : "Unknown error",
        });
        return acceptsHtml(request)
          ? redirect(origin, "error")
          : json({ error: "Newsletter preferences are temporarily unavailable." }, 503);
      }
    },

    async verify(request) {
      if (request.method !== "GET" && request.method !== "POST") {
        return json({ error: "Method not allowed." }, 405, { Allow: "GET, POST" });
      }

      let currentService;
      try {
        currentService = getService();
      } catch (error) {
        console.error("Newsletter preference service is not configured.", {
          error: error instanceof Error ? error.message : "Unknown error",
        });
        return json({ error: "Newsletter preferences are temporarily unavailable." }, 503);
      }

      const fallbackOrigin = [...currentService.config.allowedOrigins][0];
      if (request.method === "GET") {
        const token = new URL(request.url).searchParams.get("token");
        return TOKEN_PATTERN.test(token ?? "")
          ? confirmationPage(token)
          : redirect(fallbackOrigin, "invalid");
      }

      const origin = requestOrigin(request, currentService.config.allowedOrigins);
      if (!origin) return json({ error: "Request origin is not allowed." }, 403);

      let token;
      try {
        const input = await parseSubmission(request);
        token = typeof input.token === "string" ? input.token : undefined;
      } catch {
        return redirect(origin, "invalid");
      }
      try {
        const result = await currentService.verify(token);
        console.info("Newsletter verification completed.", {
          requestId: result.requestId,
          status: result.status,
        });
        const outcome = result.status === "invalid" ? "invalid" : "verified";
        return redirect(result.origin ?? origin, outcome);
      } catch (error) {
        console.error("Newsletter verification failed.", {
          error: error instanceof Error ? error.message : "Unknown error",
        });
        return redirect(origin, "error");
      }
    },
  };
}

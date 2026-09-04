import { authConfig } from "@/lib/auth.config";
import { GRUP_COOKIE_NAME } from "@/lib/grup-cookie-name";
import { parseGrupEmpresa } from "@/lib/grups-empresa";
import { potConfigurar, potEditar } from "@/lib/roles";
import NextAuth from "next-auth";
import { NextResponse } from "next/server";

/*
 * Middleware — EDGE RUNTIME.
 * Usa authConfig (edge-safe): sense imports de Node.js.
 *
 * IMPORTANT: amb `auth((req) => …)` el callback `authorized` de authConfig
 * NO s'executa. Tota la protecció d'accés ha d'estar aquí.
 */
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const url = req.nextUrl;
  const pathname = url.pathname;
  const isLoggedIn = !!req.auth?.user;
  const isLogin = pathname === "/login";
  const isApiAuth = pathname.startsWith("/api/auth");
  const isDevCalcul =
    process.env.NODE_ENV !== "production" &&
    (pathname === "/api/dev/calcul-ajust-central" || pathname === "/api/dev/proposta-central-pct");

  if (isApiAuth || isDevCalcul) return NextResponse.next();

  if (isLogin) {
    if (isLoggedIn) return NextResponse.redirect(new URL("/", url));
    return NextResponse.next();
  }

  if (!isLoggedIn) {
    const loginUrl = new URL("/login", url);
    loginUrl.searchParams.set("callbackUrl", `${pathname}${url.search}`);
    return NextResponse.redirect(loginUrl);
  }

  const role = req.auth?.user?.role;
  // EDICIO: Dades (import/ajustos). Configuració: només ADMIN.
  if (pathname.startsWith("/dades") && role && !potEditar(role)) {
    return NextResponse.redirect(new URL("/", url));
  }
  if (pathname.startsWith("/settings") && role && !potConfigurar(role)) {
    return NextResponse.redirect(new URL("/", url));
  }

  const res = NextResponse.next();
  const grupParam = url.searchParams.get("grup");
  if (grupParam === "calblay" || grupParam === "fdlc" || grupParam === "consolidat") {
    const current = req.cookies.get(GRUP_COOKIE_NAME)?.value;
    const nextGrup = parseGrupEmpresa(grupParam);
    if (current !== nextGrup) {
      res.cookies.set(GRUP_COOKIE_NAME, nextGrup, {
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
        sameSite: "lax",
      });
    }
  }

  return res;
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest\\.webmanifest|.*\\.png$|.*\\.ico$).*)",
  ],
};

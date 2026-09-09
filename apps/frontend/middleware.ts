import { authConfig } from "@/lib/auth.config";
import { clampGrupEmpresa, resolveGrupsPermitits } from "@/lib/consulta-scope";
import { GRUP_COOKIE_NAME } from "@/lib/grup-cookie-name";
import { parseGrupEmpresa } from "@/lib/grups-empresa";
import { homeHrefPerRol, parseNavExtra, potAccedirPath } from "@/lib/nav-access";
import type { NavExtra } from "@/lib/nav-catalog";
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
  /** APIs M2M (Cal Blay, etc.): auth per Bearer a la route, sense sessió. */
  const isExternalApi = pathname.startsWith("/api/external/");
  const isDevCalcul =
    process.env.NODE_ENV !== "production" &&
    (pathname === "/api/dev/calcul-ajust-central" || pathname === "/api/dev/proposta-central-pct");

  if (isApiAuth || isExternalApi || isDevCalcul) return NextResponse.next();

  const role = req.auth?.user?.role;
  const navExtra = parseNavExtra((req.auth?.user as { navExtra?: NavExtra } | undefined)?.navExtra);
  const homeHref = homeHrefPerRol(role, navExtra);

  if (isLogin) {
    if (isLoggedIn) {
      return NextResponse.redirect(new URL(homeHref, url));
    }
    return NextResponse.next();
  }

  if (!isLoggedIn) {
    const loginUrl = new URL("/login", url);
    loginUrl.searchParams.set("callbackUrl", `${pathname}${url.search}`);
    return NextResponse.redirect(loginUrl);
  }

  // Catàleg: partides → categories
  if (
    pathname === "/dades/pressupost-partides" ||
    pathname.startsWith("/dades/pressupost-partides/")
  ) {
    return NextResponse.redirect(new URL(`/dades/pressupost-categories${url.search}`, url));
  }

  // Rutes antigues del pressupost → mòdul independent (abans del check /dades)
  if (pathname === "/dades/pressupost" || pathname.startsWith("/dades/pressupost/")) {
    return NextResponse.redirect(new URL(`/pressupost/ln${url.search}`, url));
  }
  if (pathname === "/consultes/pressupost" || pathname.startsWith("/consultes/pressupost/")) {
    return NextResponse.redirect(new URL("/pressupost", url));
  }

  if (
    pathname.startsWith("/dades") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/pressupost") ||
    pathname.startsWith("/consultes") ||
    pathname === "/"
  ) {
    if (role && !potAccedirPath(role, pathname, navExtra)) {
      return NextResponse.redirect(new URL(homeHref, url));
    }
  }

  const res = NextResponse.next();
  const permitits = resolveGrupsPermitits(role, navExtra);
  const grupParam = url.searchParams.get("grup");
  const currentRaw = req.cookies.get(GRUP_COOKIE_NAME)?.value;
  const current = parseGrupEmpresa(currentRaw);
  let nextGrup = current;
  if (grupParam === "calblay" || grupParam === "fdlc" || grupParam === "consolidat") {
    nextGrup = parseGrupEmpresa(grupParam);
  }
  nextGrup = clampGrupEmpresa(nextGrup, permitits);
  if (currentRaw !== nextGrup) {
    res.cookies.set(GRUP_COOKIE_NAME, nextGrup, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  }

  return res;
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest\\.webmanifest|.*\\.png$|.*\\.ico$).*)",
  ],
};

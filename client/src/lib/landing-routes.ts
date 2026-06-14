export function isLandingPageRoute(pathname: string): boolean {
  return (
    pathname.startsWith("/fast-and-affordable-websites-book-a-call") ||
    pathname.startsWith("/fast-and-affordable-websites-book-a-call-en")
  );
}

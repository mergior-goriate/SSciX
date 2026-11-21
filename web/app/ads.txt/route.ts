export function GET() {
  const publisher = process.env.SSCIX_ADSENSE_PUBLISHER ?? "";
  if (process.env.SSCIX_ADSENSE_ENABLED !== "1" || !/^ca-pub-\d{16}$/.test(publisher)) {
    return new Response(null, { status: 404 });
  }
  return new Response(`google.com, ${publisher.slice(3)}, DIRECT, f08c47fec0942fa0\n`,
    { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

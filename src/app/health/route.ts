// Liveness endpoint used by infra healthchecks (LB / uptime monitors hit
// 127.0.0.1:3302/health on the running container). Intentionally a shallow
// check — it answers "is the Next.js server up and serving?" rather than
// validating downstream services. Add deeper probes only if a monitor
// specifically requires them, since deep checks risk cascading failure
// signals from transient upstream blips.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
}

export function HEAD() {
  return new Response(null, { status: 200 });
}

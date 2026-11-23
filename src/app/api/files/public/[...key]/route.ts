import { mimeFor, readStored } from "@/server/storage";

export async function GET(_: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const key = (await params).key.join("/");
  try {
    const buf = await readStored("public", key);
    return new Response(new Uint8Array(buf), { headers: { "Content-Type": mimeFor(key), "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

// CLD-08: the images the docs pages show, served from the repository's docs/media/.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { MEDIA_DIR, MEDIA_FILE, repositoryRoot } from "../../../../../lib/docs";

export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }): Promise<Response> {
  const { file } = await params;
  if (!MEDIA_FILE.test(file)) return new Response("Not found", { status: 404 });
  try {
    const body = await readFile(join(/*turbopackIgnore: true*/ repositoryRoot(), MEDIA_DIR, file));
    return new Response(new Uint8Array(body), { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=3600" } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

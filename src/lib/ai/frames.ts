import "server-only";
import { spawn } from "child_process";
import { mkdtemp, readdir, readFile, rm } from "fs/promises";
import os from "os";
import path from "path";

/**
 * Videodan birkaç kare çıkarır (yalnızca AI'a görsel bağlam olarak gönderilir, ilan fotoğrafı olarak KULLANILMAZ).
 * ffmpeg kurulu değilse boş liste döner; akış transkript ile devam eder.
 */
export async function extractFrames(videoPath: string, count = 4): Promise<Buffer[]> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "mm-frames-"));
  try {
    const ok = await new Promise<boolean>((resolve) => {
      const p = spawn(process.env.FFMPEG_PATH || "ffmpeg", [
        "-hide_banner", "-loglevel", "error", "-i", videoPath,
        "-vf", "fps=1/4,scale=768:-2", "-frames:v", String(count), "-q:v", "4",
        path.join(dir, "f%02d.jpg"),
      ]);
      const timer = setTimeout(() => p.kill(), 30_000);
      p.on("error", () => { clearTimeout(timer); resolve(false); });
      p.on("close", (code) => { clearTimeout(timer); resolve(code === 0); });
    });
    if (!ok) return [];
    const files = (await readdir(dir)).filter((f) => f.endsWith(".jpg")).sort();
    return Promise.all(files.map((f) => readFile(path.join(dir, f))));
  } catch {
    return [];
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

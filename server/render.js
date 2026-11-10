import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";
import { bin } from "./bin.js";

const exec = promisify(execFile);
const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

export async function renderFilm({ url, filmDir, fps, width, height, duration }) {
  if (!fs.existsSync(chrome)) {
    throw new Error("Google Chrome is required to render frames.");
  }
  const frames = path.join(filmDir, "frames");
  fs.rmSync(frames, { recursive: true, force: true });
  fs.mkdirSync(frames, { recursive: true });

  const browser = await puppeteer.launch({
    executablePath: chrome,
    headless: true,
    args: [
      "--hide-scrollbars",
      "--enable-webgl",
      "--ignore-gpu-blocklist",
      "--use-gl=angle",
      "--use-angle=metal",
      `--window-size=${width},${height}`,
    ],
  });

  try {
    const page = await browser.newPage();
    page.on("pageerror", (error) => {
      console.error("preview error:", error);
    });
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    await page.goto(url, { waitUntil: "networkidle0", timeout: 30000 });
    await page.waitForFunction("window.READY === true", { timeout: 20000 });
    const failed = await page.evaluate(() => window.RENDER_ERROR || null);
    if (failed) throw new Error(failed);

    const count = Math.max(1, Math.ceil(duration * fps));
    for (let i = 0; i < count; i += 1) {
      await page.evaluate((time) => window.render(time), i / fps);
      await page.screenshot({
        path: path.join(frames, `f${String(i).padStart(5, "0")}.jpg`),
        type: "jpeg",
        quality: 86,
      });
    }
  } finally {
    await browser.close();
  }

  const video = path.join(filmDir, "film.mp4");
  const voice = path.join(filmDir, "voice.wav");
  await exec(bin("ffmpeg"), [
    "-y",
    "-framerate",
    String(fps),
    "-i",
    path.join(frames, "f%05d.jpg"),
    "-i",
    voice,
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "160k",
    "-shortest",
    "-movflags",
    "+faststart",
    video,
  ]);
  fs.rmSync(frames, { recursive: true, force: true });
  return video;
}

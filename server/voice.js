import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { bin } from "./bin.js";

const exec = promisify(execFile);

export async function listVoices() {
  const { stdout } = await exec("/usr/bin/say", ["-v", "?"]);
  return stdout
    .split("\n")
    .map((line) => {
      const match = line.match(/^(.+?)\s{2,}(\S+)\s+#/);
      if (!match) return null;
      return { name: match[1].trim(), lang: match[2] };
    })
    .filter(Boolean);
}

export async function synthesize({ text, voice, aiffPath }) {
  await exec("/usr/bin/say", ["-v", voice || "Samantha", "-o", aiffPath, text]);
}

export async function aiffDuration(aiffPath) {
  const { stdout } = await exec("/usr/bin/afinfo", [aiffPath]);
  const match = stdout.match(/estimated duration:\s+([0-9.]+)/);
  if (!match) throw new Error(`Could not read duration of ${aiffPath}`);
  return Number(match[1]);
}

export async function toWav(input, output) {
  await exec(bin("ffmpeg"), ["-y", "-i", input, "-ar", "44100", "-ac", "1", "-c:a", "pcm_s16le", output]);
}

export async function silenceWav(output, seconds) {
  await exec(bin("ffmpeg"), [
    "-y",
    "-f",
    "lavfi",
    "-i",
    "anullsrc=channel_layout=mono:sample_rate=44100",
    "-t",
    seconds.toFixed(3),
    "-c:a",
    "pcm_s16le",
    output,
  ]);
}

export async function concatWav(listFile, output) {
  await exec(bin("ffmpeg"), ["-y", "-f", "concat", "-safe", "0", "-i", listFile, "-c:a", "pcm_s16le", output]);
}

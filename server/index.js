import express from "express";
import fs from "node:fs";
import path from "node:path";
import { bin } from "./bin.js";
import { generateFilm } from "./generate.js";
import {
  filmsDir,
  listScripts,
  loadLibrary,
  readScript,
  root,
  saveLibrary,
  saveScript,
} from "./store.js";
import { listVoices } from "./voice.js";

const app = express();
app.use(express.json({ limit: "2mb" }));

let busy = null;

app.get("/api/status", (_req, res) => {
  res.json({
    ffmpeg: fs.existsSync(bin("ffmpeg")),
    chrome: fs.existsSync("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"),
    busy: Boolean(busy),
  });
});

app.get("/api/voices", async (_req, res, next) => {
  try {
    res.json(await listVoices());
  } catch (error) {
    next(error);
  }
});

app.get("/api/library", (_req, res) => {
  res.json(loadLibrary());
});

app.put("/api/library", (req, res, next) => {
  try {
    res.json(saveLibrary(req.body));
  } catch (error) {
    next(error);
  }
});

app.get("/api/scripts", (_req, res) => {
  res.json(listScripts());
});

app.get("/api/scripts/:id", (req, res, next) => {
  try {
    res.json(readScript(req.params.id));
  } catch (error) {
    next(error);
  }
});

app.put("/api/scripts/:id", (req, res, next) => {
  try {
    const script = { ...req.body, id: req.params.id };
    res.json(saveScript(script));
  } catch (error) {
    next(error);
  }
});

app.post("/api/generate", async (req, res, next) => {
  if (busy) {
    res.status(409).json({ error: "A film is already generating." });
    return;
  }
  busy = req.body.id;
  try {
    const result = await generateFilm({
      id: req.body.id,
      port: app.get("port"),
      render: Boolean(req.body.render),
    });
    res.json(result);
  } catch (error) {
    next(error);
  } finally {
    busy = null;
  }
});

app.use("/vendor/three", express.static(path.join(root, "node_modules/three")));
app.use("/films", express.static(filmsDir));
app.use(express.static(path.join(root, "public")));

app.use((error, _req, res, _next) => {
  res.status(400).json({ error: error.message || "Request failed." });
});

const port = Number(process.env.PORT || 4173);
const server = app.listen(port, "127.0.0.1", () => {
  app.set("port", port);
  console.log(`Video Generator at http://127.0.0.1:${port}`);
});
server.requestTimeout = 0;
server.headersTimeout = 0;

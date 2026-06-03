// ---------------------------------------------------------------------------
// Dashboard snapshot image (PNG) for the status-update email.
//
// Renders a clean "screenshot" of the org's implementation dashboard — overall
// progress + section counts — as a real PNG, server-side, with no headless
// browser. HTML → SVG (satori) → PNG (resvg). The email embeds this image and
// links it to the portal login so recipients see the dashboard at a glance and
// can click through to make updates.
// ---------------------------------------------------------------------------

import satori from "satori";
import { html } from "satori-html";
import { Resvg } from "@resvg/resvg-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

export interface DashboardSnapshotInput {
  orgName: string;
  partnerName?: string;
  live?: boolean;
  pct: number;
  q: number;
  qTotal: number;
  vPass: number;
  vTotal: number;
  tDone: number;
  tTotal: number;
}

type SatoriFont = { name: string; data: Buffer; weight: 400 | 700; style: "normal" };
let fontCache: SatoriFont[] | null = null;

/**
 * Load the bundled sans font (regular + bold). Tries paths that work both in
 * dev (tsx, resolved next to this module) and after the esbuild bundle (process
 * cwd = project root). Throws if none are found — callers treat that as
 * "skip the image" and fall back to a plain link.
 */
function loadFonts(): SatoriFont[] {
  if (fontCache) return fontCache;
  const here = (() => {
    try {
      return path.dirname(fileURLToPath(import.meta.url));
    } catch {
      return "";
    }
  })();
  const dirs = [
    here && path.join(here, "fonts"),
    path.join(process.cwd(), "server/_core/fonts"),
    path.join(process.cwd(), "dist/fonts"),
  ].filter(Boolean) as string[];

  const read = (file: string): Buffer => {
    for (const dir of dirs) {
      try {
        return readFileSync(path.join(dir, file));
      } catch {
        /* try next */
      }
    }
    throw new Error(`Snapshot font not found: ${file} (looked in ${dirs.join(", ")})`);
  };

  fontCache = [
    { name: "NLSans", data: read("Sans-Regular.ttf"), weight: 400, style: "normal" },
    { name: "NLSans", data: read("Sans-Bold.ttf"), weight: 700, style: "normal" },
  ];
  return fontCache;
}

const C = {
  ink: "#18181B",
  ink3: "#8A8A93",
  line: "#E5E5E5",
  track: "#ECECEE",
  purple: "#7C1EBD",
  green: "#16A34A",
};

const esc = (s: string) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Render the dashboard snapshot to a PNG buffer. Returns null if rendering is
 * unavailable (e.g. fonts missing) so the email can fall back gracefully.
 */
export async function renderDashboardSnapshotPng(
  input: DashboardSnapshotInput
): Promise<Buffer | null> {
  let fonts: SatoriFont[];
  try {
    fonts = loadFonts();
  } catch (err) {
    console.warn("[dashboardSnapshot] font load failed, skipping image:", err);
    return null;
  }

  const pct = Math.max(0, Math.min(100, Math.round(input.pct)));
  const accent = input.live ? C.green : C.purple;
  const headline = input.live ? "Live" : `${pct}%`;
  const sub = input.live ? "Live and supported" : "overall onboarding progress";

  const stat = (n: string, label: string, first: boolean) => `
    <div style="display:flex;flex-direction:column;width:33%;${
      first ? "" : `border-left:1px solid ${C.line};`
    }padding-left:${first ? 0 : 16}px;margin-right:10px;">
      <div style="display:flex;font-size:22px;font-weight:700;color:${C.ink};">${n}</div>
      <div style="display:flex;font-size:12px;color:${C.ink3};margin-top:4px;">${label}</div>
    </div>`;

  const markup = html(`
    <div style="display:flex;flex-direction:column;width:100%;height:100%;background:#FFFFFF;padding:30px 34px;font-family:NLSans;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div style="display:flex;font-size:16px;font-weight:700;color:${C.ink};">${esc(input.orgName)} · Implementation</div>
        ${input.partnerName ? `<div style="display:flex;font-size:13px;color:${C.ink3};">${esc(input.partnerName)}</div>` : ""}
      </div>
      <div style="display:flex;align-items:flex-end;margin-top:22px;">
        <div style="display:flex;font-size:48px;font-weight:700;color:${accent};">${headline}</div>
        <div style="display:flex;font-size:14px;color:${C.ink3};margin:0 0 12px 12px;">${sub}</div>
      </div>
      <div style="display:flex;width:100%;height:10px;background:${C.track};border-radius:99px;margin-top:16px;">
        <div style="display:flex;width:${input.live ? 100 : pct}%;height:10px;background:${accent};border-radius:99px;"></div>
      </div>
      <div style="display:flex;margin-top:28px;">
        ${stat(`${input.q} / ${input.qTotal}`, "Questionnaire", true)}
        ${stat(`${input.vPass} / ${input.vTotal}`, "Tests passed", false)}
        ${stat(`${input.tDone} / ${input.tTotal}`, "Tasks done", false)}
      </div>
    </div>`);

  try {
    const svg = await satori(markup as Parameters<typeof satori>[0], {
      width: 600,
      height: 250,
      fonts,
    });
    return Buffer.from(new Resvg(svg, { fitTo: { mode: "width", value: 1200 } }).render().asPng());
  } catch (err) {
    console.warn("[dashboardSnapshot] render failed, skipping image:", err);
    return null;
  }
}

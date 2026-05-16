#!/usr/bin/env node
/**
 * Libère les ports utilisés par les serveurs dev (Next.js + co).
 * Cross-plateforme : Windows (netstat) / macOS / Linux (lsof).
 *
 * Usage : `node scripts/kill-dev-ports.mjs` ou `pnpm clean:ports`.
 *
 * Ce script ne tue que les processus qui écoutent sur les ports listés
 * — il ne touche pas aux process arbitraires.
 */

import { execSync } from "node:child_process";
import { platform } from "node:os";

const PORTS = [3000, 3001, 3002];
const IS_WINDOWS = platform() === "win32";

/**
 * Retourne les PIDs (uniques) qui écoutent sur un port donné.
 * Renvoie un Set vide si rien n'écoute ou si la commande échoue.
 */
function findPidsOnPort(port) {
  try {
    if (IS_WINDOWS) {
      const out = execSync(`netstat -ano -p tcp`, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
      const pids = new Set();
      for (const line of out.split("\n")) {
        // ligne typique : "  TCP    [::]:3000     [::]:0    LISTENING    31556"
        if (!line.includes("LISTENING")) continue;
        if (!line.includes(`:${port} `) && !line.includes(`:${port}\t`)) continue;
        const parts = line.trim().split(/\s+/);
        const pid = Number(parts[parts.length - 1]);
        if (Number.isInteger(pid) && pid > 0) pids.add(pid);
      }
      return pids;
    }
    // POSIX
    const out = execSync(`lsof -ti tcp:${port} -sTCP:LISTEN`, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    return new Set(out.split("\n").map((s) => Number(s.trim())).filter((n) => Number.isInteger(n) && n > 0));
  } catch {
    return new Set();
  }
}

/** Tue un PID sans propager l'erreur si le process n'existe déjà plus. */
function killPid(pid) {
  try {
    if (IS_WINDOWS) execSync(`taskkill /F /PID ${pid}`, { stdio: "ignore" });
    else execSync(`kill -9 ${pid}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

let killed = 0;
for (const port of PORTS) {
  const pids = findPidsOnPort(port);
  if (pids.size === 0) continue;
  for (const pid of pids) {
    if (killPid(pid)) {
      console.log(`[clean:ports] port ${port} libéré (PID ${pid} tué)`);
      killed++;
    }
  }
}

if (killed === 0) console.log("[clean:ports] aucun zombie trouvé sur 3000/3001/3002");

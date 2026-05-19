import express from "express";
import { createClient } from "@supabase/supabase-js";

const app = express();
app.use(express.json());

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ─────────────────────────────────────────────
// Mapa de secciones del form CHALLENGES
// ─────────────────────────────────────────────

const CHALLENGES_SECTIONS = {
  team_culture: {
    ratings: ["xwfM", "mnGy", "ay8y", "3Rvc", "pFak"],
    clarification: "1grN",
  },
  sales_growth: {
    ratings: ["iLAc", "aEaM", "3RtR", "bDFf", "beco", "rLH1"],
    clarification: "6WmP",
  },
  marketing_communication: {
    ratings: ["sNiF", "hKc3", "nWmM", "rvrL", "xm48"],
    clarification: "hPNe",
  },
  product_technology: {
    ratings: ["6TeA", "gzc3", "roKK", "9o36", "dxb3", "h98t"],
    clarification: "a9rP",
  },
};

const DEEP_DIVE_IDS = {
  challenge_name:      "o5A2",
  decision:            "mTxt",
  cost_of_not_solving: "cN3w",
  hypothesis:          "pnnL",
  what_tried:          "gSzy",
  help_needed:         "kyNa",
  expertise_wanted:    "neNn",
  anything_else:       "wxaN",
};

// ─────────────────────────────────────────────
// IDs de preguntas del form OLBI + BRS
// ─────────────────────────────────────────────

const BRS_IDS = new Set([
  "2JzBoBKAF5mwKBQvnC9pLt",
  "4zjVqcZNVveoV2LPSZfkmh",
  "mcARu8qHD45M1oCYAaf4D9",
  "n3NfCPvHe1skZo7rFoR2pX",
  "cej2xjikuM1YDK1sCDCACt",
  "3yrp54p1KzsHQH4bupdhtZ",
]);

const OLBI_IDS = new Set([
  "c1T7bEyu3e2S882jm4L3Ng",
  "iNPnYheMg3YgrthVy9bYtr",
  "cDPmcWHXhw3gYw9cNpMBDR",
  "a41uJUCjYkcPyGrhmV5qfZ",
  "kDnVq63AzisUpLvE3UFPz3",
  "vG6cTq1Pk7V74arkYtf5Na",
  "qFA4ZucuRcUNRohQhYHfqN",
  "piaJTxqrXpYnEmo4icmMA5",
  "8jJ6dg9jhQph9pxPo59LCS",
  "cFyrkW8sMM128NwSzyENuD",
  "sysktbS4ko78t4MJXuRSyu",
  "m7r5fjVU2DAYpM5obdrFCf",
  "1mpmyfP62Ahj5DeofX61fo",
  "wTNW9DQ8nh2pau16cd2BwE",
  "6QXR2YKkstxcBJ4WeBVdt1",
  "obAntgS5TrtYS7pQrDJd6e",
]);

// ─────────────────────────────────────────────
// Helper: búsqueda flexible de Person por nombre
// ─────────────────────────────────────────────

async function findPersonByName(name) {
  if (!name) return null;
  const normalized = name.trim();

  const { data: exact } = await supabase
    .from("Person")
    .select("id, full_name")
    .ilike("full_name", normalized)
    .limit(1);

  if (exact?.length) return exact[0];

  const words = normalized.split(/\s+/).filter(Boolean);
  const candidates = [];

  for (const word of words) {
    const { data } = await supabase
      .from("Person")
      .select("id, full_name")
      .ilike("full_name", `%${word}%`);
    if (data) candidates.push(...data);
  }

  if (!candidates.length) return null;

  const scored = candidates.map((p) => {
    const lower = p.full_name.toLowerCase();
    const score = words.filter((w) => lower.includes(w.toLowerCase())).length;
    return { ...p, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0].score > 0 ? scored[0] : null;
}

// ─────────────────────────────────────────────
// POST /webhook/challenges
// ─────────────────────────────────────────────

app.post("/webhook/challenges", async (req, res) => {
  try {
    const { submission } = req.body;
    const questions = submission?.questions ?? [];

    // Indexar por id para acceso rápido
    const byId = {};
    for (const q of questions) {
      byId[q.id] = { name: q.name, value: q.value };
    }

    const email = byId["kFoF"]?.value;
    if (!email) {
      console.warn("[challenges] No email en el payload");
      return res.status(400).json({ error: "Email no encontrado" });
    }

    // Buscar founder → startup
    const { data: persons, error: personErr } = await supabase
      .from("Person")
      .select("id, full_name, startup_id")
      .ilike("email", email.trim())
      .limit(1);

    if (personErr) throw personErr;
    if (!persons?.length)
      return res.status(404).json({ error: "Person no encontrada", email });

    const person = persons[0];
    if (!person.startup_id)
      return res.status(404).json({ error: "La person no tiene startup asociada" });

    // Construir secciones
    const sections = {};
    for (const [sectionKey, config] of Object.entries(CHALLENGES_SECTIONS)) {
      sections[sectionKey] = {
        ratings: {},
        clarification: byId[config.clarification]?.value ?? null,
      };
      for (const id of config.ratings) {
        if (byId[id]) {
          sections[sectionKey].ratings[byId[id].name] = byId[id].value;
        }
      }
    }

    // Construir deep dive
    const deep_dive = {};
    for (const [fieldKey, id] of Object.entries(DEEP_DIVE_IDS)) {
      deep_dive[fieldKey] = byId[id]?.value ?? null;
    }

    const payload = {
      submitted_at: submission.submissionTime,
      submission_id: submission.submissionId,
      founder: {
        name: byId["oaxk"]?.value,
        company: byId["pGR8"]?.value,
        email,
      },
      sections,
      deep_dive,
    };

    const { error: updateErr } = await supabase
      .from("Startup")
      .update({ challenges: payload })
      .eq("id", person.startup_id);

    if (updateErr) throw updateErr;

    console.log(`[challenges] ✓ ${person.full_name} → startup ${person.startup_id}`);
    return res.status(200).json({ ok: true, startup_id: person.startup_id });
  } catch (err) {
    console.error("[challenges] Error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────
// POST /webhook/olbi-brs
// ─────────────────────────────────────────────

app.post("/webhook/olbi-brs", async (req, res) => {
  try {
    const { submission } = req.body;
    const questions = submission?.questions ?? [];

    const nameQuestion = questions.find(
      (q) =>
        q.id === "fEgcvYwCw2Vd3mK5kJSLr5" ||
        q.name.toLowerCase().includes("founder name")
    );
    const founderName = nameQuestion?.value;

    if (!founderName) {
      console.warn("[olbi-brs] No se encontró Founder Name en el payload");
      return res.status(400).json({ error: "Founder Name no encontrado" });
    }

    const person = await findPersonByName(founderName);
    if (!person)
      return res.status(404).json({ error: "Person no encontrada", name: founderName });

    const brs = {};
    const olbi = {};

    for (const q of questions) {
      if (BRS_IDS.has(q.id)) {
        brs[q.name] = q.value;
      } else if (OLBI_IDS.has(q.id)) {
        olbi[q.name] = q.value;
      }
    }

    const payload = {
      submitted_at: submission.submissionTime,
      submission_id: submission.submissionId,
      brs,
      olbi,
    };

    const { error: updateErr } = await supabase
      .from("Person")
      .update({ olbi_brs: payload })
      .eq("id", person.id);

    if (updateErr) throw updateErr;

    console.log(`[olbi-brs] ✓ ${person.full_name} (${person.id})`);
    return res.status(200).json({ ok: true, person_id: person.id });
  } catch (err) {
    console.error("[olbi-brs] Error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────
// Health check
// ─────────────────────────────────────────────

app.get("/health", (_req, res) => res.json({ status: "ok" }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Webhook server escuchando en :${PORT}`));

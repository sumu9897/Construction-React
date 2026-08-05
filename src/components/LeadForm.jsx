/**
 * The lead form, phone-first. In this market WhatsApp is how deals start, so
 * the phone number is the required field and email is optional. The dial-code
 * picker does double duty: it removes the "how do I write my number" friction
 * for diaspora buyers AND records which country the enquiry came from — the
 * datum that decides where the ad budget goes.
 *
 * Submissions go to info@pmcclb.com through FormSubmit's AJAX endpoint — a
 * static site has no server, and this keeps the enquiry in the inbox the
 * company already reads. (Activated: the confirmation link was clicked.)
 */
import { useState } from "react";
import { company, project } from "../data/content";
import { track } from "../lib/analytics";

const ENDPOINT = `https://formsubmit.co/ajax/${company.email}`;

/**
 * Dial codes the diaspora actually calls from, Lebanon first. The label is
 * what gets recorded as the enquiry's country.
 */
const DIAL_CODES = [
  ["+961", "Lebanon"],
  ["+971", "UAE"],
  ["+966", "Saudi Arabia"],
  ["+974", "Qatar"],
  ["+965", "Kuwait"],
  ["+973", "Bahrain"],
  ["+968", "Oman"],
  ["+962", "Jordan"],
  ["+20", "Egypt"],
  ["+90", "Türkiye"],
  ["+357", "Cyprus"],
  ["+33", "France"],
  ["+44", "United Kingdom"],
  ["+49", "Germany"],
  ["+41", "Switzerland"],
  ["+32", "Belgium"],
  ["+31", "Netherlands"],
  ["+34", "Spain"],
  ["+39", "Italy"],
  ["+30", "Greece"],
  ["+46", "Sweden"],
  ["+1", "USA / Canada"],
  ["+55", "Brazil"],
  ["+52", "Mexico"],
  ["+54", "Argentina"],
  ["+61", "Australia"],
  ["+234", "Nigeria"],
  ["+233", "Ghana"],
  ["+225", "Côte d'Ivoire"],
  ["+221", "Senegal"],
  ["+243", "DR Congo"],
  ["+27", "South Africa"],
];

/** Palette per background: the form sits on bone on the project page, ink in the footer. */
const TONES = {
  light: {
    label: "text-ink/60",
    input:
      "border-ink/25 bg-transparent text-ink placeholder:text-ink/35 focus:border-ink",
    select: "border-ink/25 bg-bone text-ink focus:border-ink",
    button: "bg-pmcc text-bone hover:bg-pmcc/90",
    fine: "text-ink/55",
    link: "text-ink underline underline-offset-4 hover:text-pmcc",
    done: "border-ink/20 text-ink",
  },
  dark: {
    label: "text-smoke",
    input:
      "border-seam bg-transparent text-bone placeholder:text-smoke/60 focus:border-stone",
    select: "border-seam bg-ink text-bone focus:border-stone",
    button: "bg-pmcc text-bone hover:bg-pmcc/90",
    fine: "text-smoke",
    link: "text-bone underline underline-offset-4 hover:text-pmcc",
    done: "border-seam text-bone",
  },
};

export default function LeadForm({ tone = "light", source = "site", showWhatsApp = true }) {
  const t = TONES[tone];
  const [status, setStatus] = useState("idle"); // idle | sending | sent | error

  async function onSubmit(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    if (data._honey) return; // bot filled the invisible field
    const country = DIAL_CODES.find(([code]) => code === data.dial)?.[1] ?? data.dial;
    setStatus("sending");
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          name: data.name,
          phone: `${data.dial} ${data.phone}`,
          country,
          email: data.email || "not provided",
          _subject: `Price list request: ${project.name} (${data.name}, ${country})`,
          _template: "table",
          _captcha: "false",
        }),
      });
      if (!res.ok) throw new Error(`FormSubmit ${res.status}`);
      setStatus("sent");
      track("generate_lead", { source, country });
    } catch {
      setStatus("error");
    }
  }

  const wa = `https://wa.me/${company.whatsapp}?text=${encodeURIComponent(
    `Hello PMCC, please send me the price list and floor plans for ${project.name}.`,
  )}`;

  if (status === "sent") {
    return (
      <div className={`border px-6 py-8 text-center ${t.done}`}>
        <p className="type-display text-2xl">Received.</p>
        <p className={`mt-3 font-sans text-sm leading-relaxed ${t.fine}`}>
          The price list and floor plans are on their way to you.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit}>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block text-left">
          <span className={`font-sans text-xs uppercase tracking-wideish ${t.label}`}>Name</span>
          <input
            name="name"
            type="text"
            required
            autoComplete="name"
            placeholder="Your name"
            className={`mt-2 w-full border px-4 py-3 font-sans text-sm outline-none transition-colors ${t.input}`}
          />
        </label>
        <div className="block text-left">
          <span className={`font-sans text-xs uppercase tracking-wideish ${t.label}`}>
            Phone / WhatsApp
          </span>
          <div className="mt-2 flex gap-2">
            <select
              name="dial"
              defaultValue="+961"
              aria-label="Country code"
              className={`w-[7.5rem] shrink-0 border px-2 py-3 font-sans text-sm outline-none transition-colors ${t.select}`}
            >
              {DIAL_CODES.map(([code, country]) => (
                <option key={code + country} value={code}>
                  {country} {code}
                </option>
              ))}
            </select>
            <input
              name="phone"
              type="tel"
              required
              inputMode="tel"
              pattern="[0-9 ]{5,15}"
              title="Digits only, e.g. 3 616 222"
              autoComplete="tel-national"
              placeholder="3 616 222"
              className={`min-w-0 flex-1 border px-4 py-3 font-sans text-sm outline-none transition-colors ${t.input}`}
            />
          </div>
        </div>
        <label className="block text-left">
          <span className={`font-sans text-xs uppercase tracking-wideish ${t.label}`}>
            Email <span className="normal-case opacity-60">(optional)</span>
          </span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            className={`mt-2 w-full border px-4 py-3 font-sans text-sm outline-none transition-colors ${t.input}`}
          />
        </label>
      </div>

      {/* Honeypot: invisible to people, irresistible to bots. */}
      <input
        type="text"
        name="_honey"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute -left-[9999px] h-0 w-0 opacity-0"
      />

      <div className="mt-6 flex flex-col items-center gap-4">
        <button
          type="submit"
          disabled={status === "sending"}
          className={`inline-flex items-center gap-3 px-8 py-4 font-sans text-sm font-semibold transition-colors disabled:opacity-60 ${t.button}`}
        >
          {status === "sending" ? "Sending…" : "Request the price list"}
        </button>

        {status === "error" && (
          <p className="font-sans text-xs text-pmcc" role="alert">
            That didn&rsquo;t go through. Message us on WhatsApp instead.
          </p>
        )}

        {showWhatsApp && (
          <p className={`font-sans text-xs ${t.fine}`}>
            Prefer to talk?{" "}
            <a
              href={wa}
              target="_blank"
              rel="noreferrer"
              className={t.link}
              onClick={() => track("whatsapp_click", { source: `${source}-form` })}
            >
              Message us on WhatsApp
            </a>
          </p>
        )}
      </div>
    </form>
  );
}

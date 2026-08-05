/**
 * Share the page as a bare URL, on purpose. The browser's own share sheet
 * sends "<page title> <url>" as one message — and WhatsApp only renders the
 * big preview card when the message starts with the link, so the built-in
 * button produces a wall of text with no picture. Sharing url-only is what
 * makes every forward arrive as the card.
 */
import { useState } from "react";
import { track } from "../lib/analytics";

export default function ShareButton({ url, className = "" }) {
  const [copied, setCopied] = useState(false);

  async function onShare() {
    track("share_click", { url });
    if (navigator.share) {
      // url only — no title, no text — so WhatsApp gets a clean link.
      try {
        await navigator.share({ url });
        return;
      } catch {
        return; // user closed the sheet — not a failure worth surfacing
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* clipboard denied: the link is in the address bar anyway */
    }
  }

  return (
    <button type="button" onClick={onShare} className={className}>
      {copied ? "Link copied. Paste it anywhere" : "Share this page"}
      {!copied && (
        <span aria-hidden className="ml-2 inline-block">
          ↗
        </span>
      )}
    </button>
  );
}

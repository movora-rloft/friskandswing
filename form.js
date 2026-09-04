/* Frisk & Swing — trial form
   - POSTs JSON to a Cloudflare Worker that writes to the studio's Google Sheet
   - Honeypot field blocks naive bots
   - Friendly inline error / success states
   - The endpoint is set in window.TRIAL_ENDPOINT (see bottom of file)
*/

(function () {
  const ENDPOINT =
    (typeof window !== "undefined" && window.TRIAL_ENDPOINT) ||
    "/api/trial";

  const form  = document.getElementById("trialForm");
  if (!form) return;
  const msg   = document.getElementById("trialMsg");
  const btn   = document.getElementById("trialSubmit");
  const label = btn.querySelector(".trial__submit-label");

  function setMsg(text, kind) {
    msg.textContent = text;
    msg.dataset.kind = kind || "";
  }
  function setLoading(loading) {
    btn.disabled = loading;
    btn.classList.toggle("is-loading", loading);
    label.textContent = loading ? "Sending…" : "Book my free trial";
  }

  // crude but useful: phone must contain at least 7 digits
  function validPhone(s) {
    return (s || "").replace(/\D/g, "").length >= 7;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // honeypot: if the hidden "company" field is filled, silently succeed
    if (form.elements.company && form.elements.company.value) {
      setMsg("Thanks! We'll be in touch.", "ok");
      form.reset();
      return;
    }

    const data = {
      name:        (form.elements.name.value        || "").trim(),
      whatsapp:    (form.elements.whatsapp.value    || "").trim(),
      dance:       (form.elements.dance.value       || "").trim(),
      experience:  (form.elements.experience.value  || "").trim(),
      day:         (form.elements.day.value         || "").trim(),
      consent:     form.elements.consent.checked === true,
      referrer:    document.referrer || "",
      ua:          navigator.userAgent || "",
      submittedAt: new Date().toISOString()
    };

    if (!data.name)        return setMsg("Please tell us your name.", "err");
    if (!validPhone(data.whatsapp))
                            return setMsg("Please add a valid WhatsApp number with country code.", "err");
    if (!data.dance)       return setMsg("Pick a style you're interested in.", "err");
    if (!data.consent)     return setMsg("Please tick the WhatsApp consent box so we can reach you.", "err");

    setLoading(true);
    setMsg("");

    try {
      const r = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      if (!r.ok) throw new Error("HTTP " + r.status);
      setMsg("Thanks! We'll WhatsApp you within 24 hours to confirm your spot.", "ok");
      form.reset();
    } catch (err) {
      setMsg("Something went wrong on our end. Please message @frisknswing on Instagram and we'll sort you out.", "err");
    } finally {
      setLoading(false);
    }
  });
})();

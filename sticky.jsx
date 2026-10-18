// AUTO-GENEROWANE przez install.sh z sticky.jsx — edytuj szablon, nie ten plik.
// Karteczka: __TITLE__
// Stan monitorów z publicznej strony statusu UptimeRobot: __URL__
//
// Skrypt zwraca JSON: { counts: {down,warn,paused,ok}, subtitle, col_widths: [px…],
//   rows: [{ state, name, cols: [tekst…], url?, tip?, problems: [tekst…] }],
//   generated_at }  albo  { error }.

import { run } from "uebersicht";

export const refreshFrequency = __REFRESH__;

export const command = `cd "__PROJECT_DIR__" && "__PYTHON__" uptime_status.py "__URL__" --json`;

export const className = `top: 0; left: 0;`;

const POS_KEY = "urpos-__SLUG__";
const UI_KEY = "urui-__SLUG__";
const LAST_KEY = "urlast-__SLUG__"; // ostatnie udane dane — pokazywane, gdy skrypt zawiedzie (np. brak sieci)
const DEFAULT_POS = { x: __LEFT__, y: __TOP__ };
const MIN_BODY = 48;

// --- trwały stan UI (localStorage) -----------------------------------------
function loadUI() {
  try { return JSON.parse(localStorage.getItem(UI_KEY)) || {}; }
  catch (e) { return {}; } // brak/zepsuty wpis — startujemy z domyślnych
}
function saveUI(patch) {
  const next = { ...loadUI(), ...patch };
  try { localStorage.setItem(UI_KEY, JSON.stringify(next)); }
  catch (e) { /* tryb prywatny / brak miejsca — stan zostaje tylko w pamięci */ }
}

// --- ostatnie udane dane (fallback offline) ---------------------------------
function parseData(output) {
  try { const d = JSON.parse(output); return d && !d.error && d.rows ? d : null; }
  catch (e) { return null; } // nie-JSON (np. traceback) = brak świeżych danych
}
function loadLast() {
  try { return JSON.parse(localStorage.getItem(LAST_KEY)); }
  catch (e) { return null; } // brak/zepsuty wpis — po prostu nie mamy kopii
}
function saveLast(d) {
  try { localStorage.setItem(LAST_KEY, JSON.stringify(d)); }
  catch (e) { /* brak miejsca — kopia zostaje tylko w pamięci (state.last) */ }
}
// Wynik komendy: udane dane zapamiętujemy, przy błędzie zostaje poprzednia kopia.
function withResult(prev, output, error) {
  const d = error ? null : parseData(output);
  if (d) saveLast(d);
  return { ...prev, busy: false, output, error, last: d || prev.last };
}

// --- stan widgetu -----------------------------------------------------------
const _ui = loadUI();
export const initialState = {
  output: "",
  error: null,
  busy: false,
  last: loadLast(),
  collapsed: !!_ui.collapsed,
  hidden: !!_ui.hidden,
  height: typeof _ui.height === "number" ? _ui.height : null,
};

export const updateState = (event, prev) => {
  switch (event.type) {
    case "UR/SET":       return { ...prev, ...event.patch };
    case "UR/BUSY":      return { ...prev, busy: true };
    case "UR/REFRESHED": return withResult(prev, event.output, null);
    case "UR/ERROR":     return withResult(prev, "", event.error);
    default:
      if ("output" in event || "error" in event) {
        return withResult(prev, event.output, event.error);
      }
      return prev;
  }
};

// --- akcje ------------------------------------------------------------------
function setUI(dispatch, patch) {
  saveUI(patch);
  dispatch({ type: "UR/SET", patch });
}
function refreshNow(dispatch) {
  dispatch({ type: "UR/BUSY" });
  run(command)
    .then((output) => dispatch({ type: "UR/REFRESHED", output }))
    .catch((err) => dispatch({ type: "UR/ERROR", error: String(err) }));
}

// --- przeciąganie pozycji (+ „tapnięcie" przywraca pinezkę) ----------------
function initDrag(el, onTap) {
  if (!el) return;
  if (onTap !== undefined) el.__urTap = onTap;
  if (el.__urInit) return;
  el.__urInit = true;
  let pos;
  try { pos = JSON.parse(localStorage.getItem(POS_KEY)); } catch (e) { pos = null; }
  if (!pos) pos = { ...DEFAULT_POS };
  const apply = () => { el.style.left = pos.x + "px"; el.style.top = pos.y + "px"; };
  apply();
  let drag = false, sx = 0, sy = 0, ox = 0, oy = 0;
  el.addEventListener("mousedown", (e) => {
    if (e.target.closest("a")) return;
    if (e.target.closest("[data-nodrag]")) return;
    drag = true; el.__urMoved = false;
    sx = e.clientX; sy = e.clientY; ox = pos.x; oy = pos.y;
    el.style.cursor = "grabbing";
    e.preventDefault();
  });
  window.addEventListener("mousemove", (e) => {
    if (!drag) return;
    pos.x = ox + (e.clientX - sx);
    pos.y = oy + (e.clientY - sy);
    if (Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy) > 4) el.__urMoved = true;
    apply();
  });
  window.addEventListener("mouseup", () => {
    if (!drag) return;
    drag = false;
    el.style.cursor = "grab";
    localStorage.setItem(POS_KEY, JSON.stringify(pos));
    if (!el.__urMoved && el.__urTap) el.__urTap();
  });
}

// --- zmiana wysokości listy od dołu ----------------------------------------
let bodyEl = null;
const bodyRef = (el) => { if (el) bodyEl = el; };
function startResize(e, dispatch) {
  e.preventDefault();
  const root = e.currentTarget ? e.currentTarget.parentElement : null;
  const lockTop = root ? root.style.top : "";
  const lockLeft = root ? root.style.left : "";
  const pin = () => {
    if (!root) return;
    if (lockTop) root.style.top = lockTop;
    if (lockLeft) root.style.left = lockLeft;
  };
  const startY = e.clientY;
  const startH = bodyEl ? bodyEl.offsetHeight : 0;
  let lastH = startH, moved = false;
  if (bodyEl) bodyEl.style.overflowY = "auto";
  const move = (ev) => {
    moved = true;
    lastH = Math.max(MIN_BODY, startH + (ev.clientY - startY));
    if (bodyEl) bodyEl.style.maxHeight = lastH + "px";
    pin();
  };
  const up = () => {
    window.removeEventListener("mousemove", move);
    window.removeEventListener("mouseup", up);
    pin();
    if (moved) setUI(dispatch, { height: lastH });
  };
  window.addEventListener("mousemove", move);
  window.addEventListener("mouseup", up);
}

// --- style ------------------------------------------------------------------
const rootStyle = {
  position: "fixed", width: "360px", pointerEvents: "auto", cursor: "grab",
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  color: "#ececec", background: "rgba(28,28,30,0.84)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "10px",
  boxShadow: "0 8px 24px rgba(0,0,0,0.35)", padding: "12px 14px",
  fontSize: "12px", lineHeight: 1.45,
};
const pinStyle = {
  position: "fixed", pointerEvents: "auto", cursor: "grab",
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  color: "#ececec", background: "rgba(28,28,30,0.84)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "8px",
  boxShadow: "0 4px 12px rgba(0,0,0,0.28)", padding: "5px 10px",
  fontSize: "12px", fontWeight: 700, whiteSpace: "nowrap", userSelect: "none",
};
const hdr = { borderLeft: "4px solid __ACCENT__", paddingLeft: 8, marginBottom: 8 };
const hdrRow = { display: "flex", alignItems: "center", gap: 8 };
const title = {
  fontWeight: 700, fontSize: 14, letterSpacing: 0.3,
  flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
};
const sub = { fontSize: 11, opacity: 0.7 };
const ctlWrap = { display: "flex", alignItems: "center", gap: 9, flex: "0 0 auto" };
const ctl = { cursor: "pointer", opacity: 0.6, fontSize: 16, lineHeight: 1, userSelect: "none" };
const row = {
  display: "block", textDecoration: "none", color: "inherit",
  padding: "2px 0", borderTop: "1px solid rgba(255,255,255,0.08)",
};
const line = { display: "flex", gap: 6, whiteSpace: "nowrap" };
const nameC = { flex: 1, overflow: "hidden", textOverflow: "ellipsis" };
const num = { fontVariantNumeric: "tabular-nums", opacity: 0.6 };
const prob = { fontSize: 11, opacity: 0.75, paddingLeft: 20, whiteSpace: "nowrap",
               overflow: "hidden", textOverflow: "ellipsis" };
// Uchwyt zmiany wysokości: niewidoczny pas przy dolnej krawędzi (wchodzi w dolny
// padding karteczki); widać go tylko po najechaniu, kursor ↕ podpowiada chwyt.
const handle = { height: 8, margin: "2px 0 -10px", borderRadius: 4, cursor: "ns-resize", background: "transparent" };
const HANDLE_HOVER = "rgba(255,255,255,0.10)";

const ICON = { ok: "🟢", warn: "🟡", down: "🔴", paused: "⏸" };

function dataRow(r, widths) {
  const body = (
    <div>
      <div style={line}>
        <span>{ICON[r.state] || "?"}</span>
        <span style={nameC}>{r.name}</span>
        {r.cols.map((c, i) => (
          <span style={{ ...num, width: widths[i] || "auto", textAlign: "right" }} key={i}>{c}</span>
        ))}
      </div>
      {r.problems.map((p, i) => <div style={prob} key={i}>· {p}</div>)}
    </div>
  );
  // Wiersz z adresem = link (klik otwiera stronę); bez adresu = zwykły blok z dymkiem.
  return r.url
    ? <a style={row} href={r.url} title={r.tip || r.url} key={r.name}>{body}</a>
    : <div style={row} title={r.tip || ""} key={r.name}>{body}</div>;
}

// --- render -----------------------------------------------------------------
export const render = (state, dispatch) => {
  const { output, error, busy, collapsed, hidden, height, last } = state;

  if (hidden) {
    return (
      <div style={pinStyle} ref={(el) => initDrag(el, () => setUI(dispatch, { hidden: false }))}>
        📌 __TITLE__
      </div>
    );
  }

  // Świeże dane, a gdy skrypt zawiódł — ostatnia zapamiętana kopia.
  const fresh = error ? null : parseData(output);
  let parseErr = null;
  if (!error && output && !fresh) {
    let j = null;
    try { j = JSON.parse(output); }
    catch (e) { j = null; } // skrypt wypisał nie-JSON (np. traceback) — pokażemy surowy tekst
    parseErr = j && j.error ? j.error : output.slice(0, 200);
  }
  // Z tracebacku/komunikatu zostaw ostatnią niepustą linię (sedno błędu).
  const errText = error ? String(error).trim().split("\n").filter(Boolean).pop() || "?" : parseErr;
  const d = fresh || last;
  const stale = !fresh && !!d && !!errText;
  const c = d && d.counts;

  const controls = (
    <span style={ctlWrap}>
      <span style={ctl} data-nodrag="1" title="Odśwież teraz"
            onClick={() => refreshNow(dispatch)}>{busy ? "⏳" : "⟳"}</span>
      <span style={ctl} data-nodrag="1" title={collapsed ? "Rozwiń" : "Zwiń"}
            onClick={() => setUI(dispatch, { collapsed: !collapsed })}>{collapsed ? "▸" : "▾"}</span>
      <span style={ctl} data-nodrag="1" title="Ukryj (zostanie pinezka)"
            onClick={() => setUI(dispatch, { hidden: true })}>✕</span>
    </span>
  );

  const countsLine = c
    ? <span>
        {stale ? "📴 " : ""}{c.down > 0 ? `🔴 ${c.down} · ` : ""}{c.warn > 0 ? `🟡 ${c.warn} · ` : ""}🟢 {c.ok}
        {c.paused > 0 ? ` · ⏸ ${c.paused}` : ""}
      </span>
    : <span>{errText ? "⚠️ błąd" : "—"}</span>;

  if (collapsed) {
    return (
      <div style={{ ...rootStyle, padding: "8px 14px" }} ref={(el) => initDrag(el, null)}>
        <div style={{ ...hdr, marginBottom: 0, ...hdrRow }}>
          <span style={title}>__TITLE__</span>
          <span style={{ ...sub, flex: "0 0 auto" }}>{countsLine}</span>
          {controls}
        </div>
      </div>
    );
  }

  return (
    <div style={rootStyle} ref={(el) => initDrag(el, null)}>
      <div style={hdr}>
        <div style={hdrRow}>
          <div style={title}>__TITLE__</div>
          {controls}
        </div>
        <div style={sub}>
          {countsLine}{d && d.subtitle ? ` · ${d.subtitle}` : ""}
        </div>
      </div>

      <div ref={bodyRef}
           style={{ maxHeight: height ? height + "px" : "none",
                    overflowY: height ? "auto" : "visible" }}>
        {stale && (
          <div style={{ ...sub, marginBottom: 4 }} title={String(error || parseErr)}>
            📴 nie udało się odświeżyć — dane z {d.generated_at ? d.generated_at.slice(0, 16).replace("T", " ") : "?"}
          </div>
        )}
        {!d && errText && <div style={sub} title={String(error || parseErr)}>⚠️ błąd: {errText}</div>}
        {!d && !errText && <div style={sub}>sprawdzam…</div>}
        {d && d.rows.length === 0 && <div style={sub}>brak pozycji</div>}
        {d && d.rows.map((r) => dataRow(r, d.col_widths || []))}
        {d && d.generated_at && (
          <div style={{ ...sub, marginTop: 8, textAlign: "right" }}>{d.generated_at.slice(11, 16)}</div>
        )}
      </div>

      <div style={handle} data-nodrag="1"
           onMouseEnter={(e) => { e.currentTarget.style.background = HANDLE_HOVER; }}
           onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
           title="Przeciągnij = zmień wysokość · dwuklik = auto"
           onMouseDown={(e) => startResize(e, dispatch)}
           onDoubleClick={() => {
             setUI(dispatch, { height: null });
             if (bodyEl) { bodyEl.style.maxHeight = "none"; bodyEl.style.overflowY = "visible"; }
           }} />
    </div>
  );
};

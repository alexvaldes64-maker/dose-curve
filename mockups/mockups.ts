// Three Today-screen directions rendered from the real model with a seeded day.
import { area, curveMonotoneX, curveMonotoneY, line } from 'd3-shape'
import { HOUR, computeDay, levelAt, phases, phaseAt, type Phase, type PhaseSegment, type Sample } from '../src/lib/model'
import { atTime, dayWindow, fmtHour, fmtTime } from '../src/lib/time'

const day = new Date()
const params = { referenceMg: 20, model: 'simple' as const, halfLifeHours: 11, kaPerHour: 1, toleranceRate: 0.12 }
const { start, end } = dayWindow(day, '07:00', '23:00')
const doseAt = atTime(day, '09:30')
const doses = [{ mg: 20, takenAt: new Date(doseAt).toISOString() }]
const checkinAt = atTime(day, '12:05')
const now = atTime(day, '12:30')
const samples = computeDay(doses, params, start, end, 5)
const segs = phases(samples)
const phaseNow = phaseAt(segs, now)
const pctNow = Math.round(levelAt(samples, now))

const LABEL: Record<Phase, string> = {
  Onset: 'Kicking in',
  Peak: 'Peak',
  Taper: 'Wearing off',
  Comedown: 'Fading',
  Clear: 'Clear',
}
const active = segs.filter((s) => s.phase !== 'Clear')
const peak = segs.find((s) => s.phase === 'Peak')!
const lastActive = active[active.length - 1]
const clearBy = lastActive.end

function statusLine(): string {
  if (phaseNow === 'Peak') return `Peak window ends around ${fmtTime(peak.end)}.`
  if (phaseNow === 'Onset') return `Building toward peak around ${fmtTime(peak.start)}.`
  if (phaseNow === 'Clear') return 'Nothing active right now.'
  return `Estimated clear by ${fmtTime(clearBy)}.`
}


// Vertical geometry shared by directions 1 and 2
function vgeo(pxPerHour: number, left: number, plotW: number, top: number) {
  return {
    y: (t: number) => top + ((t - start) / HOUR) * pxPerHour,
    x: (e: number) => left + (Math.min(120, Math.max(0, e)) / 120) * plotW,
    h: top + ((end - start) / HOUR) * pxPerHour + 80,
  }
}

function hourTicks() {
  const out: number[] = []
  for (let t = Math.ceil(start / HOUR) * HOUR; t <= end; t += HOUR) out.push(t)
  return out
}

// ---------------------------------------------------------------------------
// 1. Daylight: dark midnight, each phase its own hue, dawn to dusk arc
// ---------------------------------------------------------------------------
function daylight(): string {
  const C = { bg: '#0F1626', surface: '#182136', text: '#EEF1F7', muted: '#8B93A7', line: '#25304A' }
  const P: Record<Phase, string> = { Onset: '#6FB7FF', Peak: '#FFB13B', Taper: '#F27FA5', Comedown: '#9A86E8', Clear: '#3A4560' }
  const font = "'Bricolage Grotesque', sans-serif"
  const W = 390
  const g = vgeo(104, 56, 200, 0)
  const nowY = g.y(now)
  const viewTop = 300 // timeline viewport starts under header
  const viewH = 844 - viewTop - 72
  const shift = viewTop + viewH * 0.6 - nowY

  const gradStops = segs
    .flatMap((s) => [
      `<stop offset="${(g.y(s.start) / g.h).toFixed(4)}" stop-color="${P[s.phase]}"/>`,
      `<stop offset="${(g.y(s.end) / g.h).toFixed(4)}" stop-color="${P[s.phase]}"/>`,
    ])
    .join('')
  const fill = area<Sample>().x0(() => g.x(0)).x1((s) => g.x(s.effect)).y((s) => g.y(s.t)).curve(curveMonotoneY)(samples)
  const edge = line<Sample>().x((s) => g.x(s.effect)).y((s) => g.y(s.t)).curve(curveMonotoneY)(samples)

  const bands = segs
    .filter((s) => s.phase !== 'Clear')
    .map((s) => `<rect x="0" y="${g.y(s.start)}" width="${W}" height="${g.y(s.end) - g.y(s.start)}" fill="${P[s.phase]}" opacity="0.07"/>`)
    .join('')
  const bandLabels = segs
    .filter((s) => s.phase !== 'Clear')
    .map(
      (s) => `<text x="${W - 16}" y="${g.y(s.start) + 20}" text-anchor="end" fill="${P[s.phase]}" font-size="13" font-weight="600">${LABEL[s.phase]}</text>
              <text x="${W - 16}" y="${g.y(s.start) + 37}" text-anchor="end" fill="${C.muted}" font-size="12">${fmtTime(s.start)}</text>`,
    )
    .join('')
  const ticks = hourTicks()
    .map((t) => `<text x="18" y="${g.y(t) + 4}" fill="${C.muted}" font-size="12">${fmtHour(t)}</text><line x1="44" x2="50" y1="${g.y(t)}" y2="${g.y(t)}" stroke="${C.line}"/>`)
    .join('')
  const doseY = g.y(doseAt)
  const ci = { x: g.x(levelAt(samples, checkinAt)), y: g.y(checkinAt) }

  const timeline = `<svg width="${W}" height="${g.h}" style="position:absolute;left:0;top:${shift}px;font-family:${font}">
    <defs><linearGradient id="dl" x1="0" y1="0" x2="0" y2="${g.h}" gradientUnits="userSpaceOnUse">${gradStops}</linearGradient>
    <linearGradient id="dlf" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#0F1626" stop-opacity="0"/><stop offset="1" stop-color="#0F1626" stop-opacity="0.55"/></linearGradient></defs>
    ${bands}${ticks}${bandLabels}
    <line x1="${g.x(0)}" x2="${g.x(0)}" y1="${g.y(start)}" y2="${g.y(end)}" stroke="${C.line}"/>
    <path d="${fill}" fill="url(#dl)" opacity="0.38"/>
    <path d="${edge}" fill="none" stroke="url(#dl)" stroke-width="3" stroke-linecap="round"/>
    <circle cx="${g.x(0)}" cy="${doseY}" r="5" fill="${C.text}" stroke="${C.bg}" stroke-width="2"/>
    <text x="${g.x(0) + 12}" y="${doseY + 4}" fill="${C.text}" font-size="13" font-weight="600">20 mg <tspan fill="${C.muted}" font-weight="400">at 9:30a</tspan></text>
    <circle cx="${ci.x}" cy="${ci.y}" r="5" fill="${C.text}"/>
    <line x1="0" x2="${W}" y1="${nowY}" y2="${nowY}" stroke="${C.text}" stroke-width="1"/>
    <rect x="12" y="${nowY - 10}" width="40" height="20" rx="10" fill="${C.text}"/>
    <text x="32" y="${nowY + 4}" text-anchor="middle" fill="${C.bg}" font-size="11" font-weight="700">Now</text>
    <line x1="${g.x(0)}" x2="${W}" y1="${g.y(end)}" y2="${g.y(end)}" stroke="${C.line}" stroke-dasharray="3 4"/>
    <text x="${g.x(0)}" y="${g.y(end) + 22}" fill="${C.text}" font-size="13" font-weight="600">Bedtime 11p <tspan fill="${C.muted}" font-weight="400">  blood level about ${Math.round(levelAt(samples, end, 'plasma'))}%</tspan></text>
  </svg>`

  // Span strip
  const sx = (t: number) => 16 + ((t - start) / (end - start)) * (W - 32)
  const strip = segs
    .map((s) => `<div style="position:absolute;left:${sx(s.start)}px;width:${sx(s.end) - sx(s.start)}px;top:0;height:10px;background:${P[s.phase]};opacity:${s.phase === 'Clear' ? 0.5 : 1}"></div>`)
    .join('')

  return `<div class="phone" style="background:${C.bg};font-family:${font};color:${C.text}">
    ${timeline}
    <div style="position:absolute;inset:0 0 auto 0;height:${viewTop}px;background:linear-gradient(${C.bg} 88%, ${C.bg}00);padding:56px 16px 0;box-sizing:border-box">
      <div style="font-size:15px;color:${C.muted}">Adderall IR, today</div>
      <div style="font-size:64px;line-height:1;font-weight:750;font-variation-settings:'wdth' 85;letter-spacing:-0.02em;color:${P[phaseNow]};margin-top:6px">${LABEL[phaseNow]}</div>
      <div style="font-size:17px;margin-top:8px">${pctNow}% of a typical peak. ${statusLine()}</div>
      <div style="position:relative;height:10px;margin-top:22px;border-radius:5px;overflow:hidden">${strip}</div>
      <div style="position:relative;height:16px;margin-top:4px">
        <div style="position:absolute;left:${sx(now) - 16}px;top:-18px;width:2px;height:16px;background:${C.text};margin-left:15px"></div>
        <span style="position:absolute;left:16px;font-size:12px;color:${C.muted}">7a</span>
        <span style="position:absolute;left:${sx(peak.start) - 16}px;font-size:12px;color:${P.Peak}">${fmtTime(peak.start)}</span>
        <span style="position:absolute;left:${sx(clearBy) - 30}px;font-size:12px;color:${C.muted}">clear ${fmtTime(clearBy)}</span>
        <span style="position:absolute;right:0;font-size:12px;color:${C.muted}">11p</span>
      </div>
    </div>
    ${tabbar(C.bg, C.text, C.muted, C.line, font)}
    ${fab(P.Peak, C.bg)}
  </div>`
}

// ---------------------------------------------------------------------------
// 2. Rx chart: cool paper, ink silhouette, cobalt peak, phase brackets
// ---------------------------------------------------------------------------
function rxChart(): string {
  const C = { bg: '#EEF1F4', ink: '#14161B', muted: '#5E6573', rule: '#C9CED6', cobalt: '#2343F5' }
  const font = "'Archivo', sans-serif"
  const W = 390
  const g = vgeo(100, 92, 190, 0)
  const nowY = g.y(now)
  const viewTop = 268
  const viewH = 844 - viewTop - 72
  const shift = viewTop + viewH * 0.66 - nowY

  const fill = area<Sample>().x0(() => g.x(0)).x1((s) => g.x(s.effect)).y((s) => g.y(s.t)).curve(curveMonotoneY)(samples)
  const edge = line<Sample>().x((s) => g.x(s.effect)).y((s) => g.y(s.t)).curve(curveMonotoneY)(samples)
  const brackets = segs
    .filter((s) => s.phase !== 'Clear')
    .map((s) => {
      const y1 = g.y(s.start) + 3
      const y2 = g.y(s.end) - 3
      const col = s.phase === 'Peak' ? C.cobalt : C.ink
      return `<path d="M 80 ${y1} h -6 V ${y2} h 6" fill="none" stroke="${col}" stroke-width="1.5"/>
        <text transform="translate(66 ${(y1 + y2) / 2}) rotate(-90)" text-anchor="middle" fill="${col}" font-size="12" font-weight="650" font-stretch="80%">${LABEL[s.phase]}</text>`
    })
    .join('')
  const ticks = hourTicks()
    .map((t) => `<text x="16" y="${g.y(t) + 4}" fill="${C.muted}" font-size="12" font-stretch="85%">${fmtHour(t)}</text><line x1="${g.x(0)}" x2="${W - 16}" y1="${g.y(t)}" y2="${g.y(t)}" stroke="${C.rule}" stroke-width="0.75"/>`)
    .join('')
  const doseY = g.y(doseAt)
  const ci = { x: g.x(levelAt(samples, checkinAt)), y: g.y(checkinAt) }

  const timeline = `<svg width="${W}" height="${g.h}" style="position:absolute;left:0;top:${shift}px;font-family:${font}">
    <defs>
      <pattern id="hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="5" stroke="${C.ink}" stroke-width="1.4"/></pattern>
      <clipPath id="peakclip"><rect x="0" y="${g.y(peak.start)}" width="${W}" height="${g.y(peak.end) - g.y(peak.start)}"/></clipPath>
    </defs>
    ${ticks}
    <path d="${fill}" fill="url(#hatch)" opacity="0.55"/>
    <path d="${fill}" fill="${C.cobalt}" clip-path="url(#peakclip)"/>
    <path d="${edge}" fill="none" stroke="${C.ink}" stroke-width="2"/>
    <line x1="${g.x(0)}" x2="${g.x(0)}" y1="${g.y(start)}" y2="${g.y(end)}" stroke="${C.ink}" stroke-width="1.5"/>
    ${brackets}
    <circle cx="${g.x(0)}" cy="${doseY}" r="6" fill="${C.ink}"/>
    <text x="${W - 16}" y="${doseY + 4}" text-anchor="end" fill="${C.ink}" font-size="14" font-weight="650">Took 20 mg, 9:30a</text>
    <rect x="${ci.x - 5}" y="${ci.y - 5}" width="10" height="10" fill="${C.bg}" stroke="${C.ink}" stroke-width="2"/>
    <text x="${W - 16}" y="${ci.y + 4}" text-anchor="end" fill="${C.ink}" font-size="13">Focus 5, mood 4</text>
    <line x1="0" x2="${W}" y1="${nowY}" y2="${nowY}" stroke="${C.ink}" stroke-width="2"/>
    <text x="16" y="${nowY - 8}" fill="${C.ink}" font-size="12" font-weight="700">Now ${fmtTime(now)}</text>
    <line x1="16" x2="${W - 16}" y1="${g.y(end)}" y2="${g.y(end)}" stroke="${C.ink}" stroke-width="2"/>
    <text x="16" y="${g.y(end) + 22}" fill="${C.ink}" font-size="14" font-weight="700">Bedtime</text>
    <text x="${W - 16}" y="${g.y(end) + 22}" text-anchor="end" fill="${C.muted}" font-size="13">Est. blood level ${Math.round(levelAt(samples, end, 'plasma'))}%</text>
  </svg>`

  return `<div class="phone" style="background:${C.bg};font-family:${font};color:${C.ink}">
    ${timeline}
    <div style="position:absolute;inset:0 0 auto 0;height:${viewTop}px;background:${C.bg};padding:56px 16px 0;box-sizing:border-box;border-bottom:2px solid ${C.ink}">
      <div style="display:flex;justify-content:space-between;align-items:baseline;border-bottom:1px solid ${C.ink};padding-bottom:8px">
        <span style="font-size:17px;font-weight:700;font-stretch:90%">Adderall IR 20 mg</span>
        <span style="font-size:14px;color:${C.muted}">${day.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</span>
      </div>
      <div style="font-size:54px;line-height:0.95;font-weight:800;font-stretch:72%;letter-spacing:-0.01em;margin-top:16px">${LABEL[phaseNow]}<br/><span style="color:${C.cobalt}">until ${fmtTime(peak.end)}</span></div>
      <div style="display:grid;grid-template-columns:0.8fr 1.4fr 0.8fr;margin-top:18px;border-top:1px solid ${C.rule}">
        ${[
          ['Kicked in', fmtTime(active[0].start)],
          ['Peak', `${fmtTime(peak.start)} to ${fmtTime(peak.end)}`],
          ['Clear by', fmtTime(clearBy)],
        ]
          .map(([k, v], i) => `<div style="padding:8px 0 0 ${i ? 10 : 0}px;${i ? `border-left:1px solid ${C.rule};` : ''}"><div style="font-size:12px;color:${C.muted}">${k}</div><div style="font-size:15px;font-weight:650;margin-top:2px;${k === 'Peak' ? `color:${C.cobalt}` : ''}">${v}</div></div>`)
          .join('')}
      </div>
    </div>
    ${tabbar(C.bg, C.ink, C.muted, C.ink, font)}
    ${fab(C.ink, C.bg)}
  </div>`
}

// ---------------------------------------------------------------------------
// 3. Glance: span-first. A horizontal hill of the whole day, phases as a sequence
// ---------------------------------------------------------------------------
function glance(): string {
  const C = { bg: '#160F1E', surface: '#21182C', text: '#F6F1FA', muted: '#9A8FA8', line: '#33284A' }
  const P: Record<Phase, string> = { Onset: '#7DD3FC', Peak: '#FDE047', Taper: '#FB923C', Comedown: '#F472B6', Clear: '#4A3D5C' }
  const font = "'Schibsted Grotesk', sans-serif"
  const W = 390
  const top = 210
  const H = 190
  const x = (t: number) => 16 + ((t - start) / (end - start)) * (W - 32)
  const y = (e: number) => top + H - (Math.min(120, Math.max(0, e)) / 120) * H
  const fill = area<Sample>().x((s) => x(s.t)).y0(() => y(0)).y1((s) => y(s.effect)).curve(curveMonotoneX)(samples)
  const edge = line<Sample>().x((s) => x(s.t)).y((s) => y(s.effect)).curve(curveMonotoneX)(samples)
  const stops = segs
    .flatMap((s) => [
      `<stop offset="${((x(s.start) - 16) / (W - 32)).toFixed(4)}" stop-color="${P[s.phase]}"/>`,
      `<stop offset="${((x(s.end) - 16) / (W - 32)).toFixed(4)}" stop-color="${P[s.phase]}"/>`,
    ])
    .join('')
  const ticks = hourTicks()
    .filter((t) => new Date(t).getHours() % 3 === 1)
    .map((t) => `<text x="${x(t)}" y="${top + H + 20}" text-anchor="middle" fill="${C.muted}" font-size="12">${fmtHour(t)}</text>`)
    .join('')
  const seq = active
    .map((s: PhaseSegment) => {
      const isNow = s.phase === phaseNow
      const when = s.phase === 'Onset' ? `from ${fmtTime(s.start)}` : `${fmtTime(s.start)} to ${fmtTime(s.end)}`
      return `<div style="display:grid;grid-template-columns:14px 1fr auto;gap:12px;align-items:center;padding:13px 0;border-top:1px solid ${C.line}">
        <span style="width:12px;height:12px;border-radius:6px;background:${P[s.phase]}"></span>
        <span style="font-size:17px;font-weight:${isNow ? 700 : 500}">${LABEL[s.phase]}${isNow ? ` <span style="font-size:13px;font-weight:600;color:${C.bg};background:${P[s.phase]};border-radius:10px;padding:2px 8px;margin-left:6px">now</span>` : ''}</span>
        <span style="font-size:15px;color:${C.muted}">${when}</span>
      </div>`
    })
    .join('')

  return `<div class="phone" style="background:${C.bg};font-family:${font};color:${C.text}">
    <div style="padding:56px 16px 0">
      <div style="font-size:15px;color:${C.muted}">Today, 20 mg at 9:30a</div>
      <div style="font-size:46px;font-weight:800;line-height:1.02;letter-spacing:-0.02em;margin-top:6px">${LABEL[phaseNow]}, ${pctNow}%</div>
      <div style="font-size:16px;color:${C.muted};margin-top:6px">${statusLine()}</div>
    </div>
    <svg width="${W}" height="${top + H + 34}" style="position:absolute;left:0;top:0;font-family:${font}">
      <defs><linearGradient id="gl" x1="16" x2="${W - 16}" y1="0" y2="0" gradientUnits="userSpaceOnUse">${stops}</linearGradient></defs>
      <line x1="16" x2="${W - 16}" y1="${y(100)}" y2="${y(100)}" stroke="${C.line}" stroke-dasharray="2 4"/>
      <text x="${W - 16}" y="${y(100) - 6}" text-anchor="end" fill="${C.muted}" font-size="11">typical peak</text>
      <path d="${fill}" fill="url(#gl)" opacity="0.85"/>
      <path d="${edge}" fill="none" stroke="${C.text}" stroke-opacity="0.9" stroke-width="1.5"/>
      <line x1="16" x2="${W - 16}" y1="${y(0)}" y2="${y(0)}" stroke="${C.line}"/>
      <line x1="${x(now)}" x2="${x(now)}" y1="${top - 6}" y2="${y(0) + 4}" stroke="${C.text}" stroke-width="2"/>
      <circle cx="${x(now)}" cy="${y(levelAt(samples, now))}" r="6" fill="${C.text}" stroke="${C.bg}" stroke-width="2"/>
      <circle cx="${x(doseAt)}" cy="${y(0)}" r="5" fill="${C.text}"/>
      <circle cx="${x(checkinAt)}" cy="${y(0) + 10}" r="4" fill="${P.Onset}"/>
      ${ticks}
    </svg>
    <div style="position:absolute;left:16px;right:16px;top:${top + H + 52}px">
      ${seq}
      <div style="border-top:1px solid ${C.line};padding-top:16px;display:flex;justify-content:space-between;font-size:15px">
        <span style="color:${C.muted}">Bedtime 11p</span><span>blood level about ${Math.round(levelAt(samples, end, 'plasma'))}%</span>
      </div>
      <button style="margin-top:22px;width:calc(100% - 72px);padding:14px;border-radius:14px;border:1px solid ${C.line};background:${C.surface};color:${C.text};font:600 15px ${font}">Show hour by hour</button>
    </div>
    ${tabbar(C.bg, C.text, C.muted, C.line, font)}
    ${fab(P.Peak, C.bg)}
  </div>`
}

function tabbar(bg: string, on: string, off: string, rule: string, font: string) {
  const items = ['Today', 'Log', 'History', 'Learn']
  return `<div style="position:absolute;left:0;right:0;bottom:0;height:72px;background:${bg};border-top:1px solid ${rule};display:grid;grid-template-columns:repeat(4,1fr);font-family:${font}">
    ${items.map((t, i) => `<div style="display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:${i ? 500 : 700};color:${i ? off : on}">${t}</div>`).join('')}
  </div>`
}
function fab(bg: string, fg: string) {
  return `<div style="position:absolute;right:16px;bottom:90px;width:56px;height:56px;border-radius:28px;background:${bg};color:${fg};display:grid;place-items:center;font-size:30px;font-weight:300">+</div>`
}


const row = document.getElementById('row')!
row.innerHTML = [
  ['1. Daylight', 'Each phase gets its own hue, dawn blue to amber peak to dusk. The big word tells you where you are.', daylight()],
  ['2. Rx chart', 'Reads like a printed pharmacy chart. Ink silhouette, peak filled cobalt, phases bracketed in the margin.', rxChart()],
  ['3. Glance', 'The whole day as one hill you read in two seconds, then the phases as a short list. Hour by hour on demand.', glance()],
]
  .map(([h, p, html]) => `<div class="col"><h2>${h}</h2><p>${p}</p>${html}</div>`)
  .join('')

/* VRT Basics: routing, settings UI, session runner and symptom log. */
(function () {
  'use strict';

  const EXERCISES = window.VRT.exercises;
  const byId = Object.fromEntries(EXERCISES.map((e) => [e.id, e]));
  const view = document.getElementById('view');

  /* ---------- Storage ---------- */

  const store = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem(key);
        return v == null ? fallback : JSON.parse(v);
      } catch (e) {
        return fallback;
      }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage full or blocked */ }
    },
  };

  const getHistory = () => store.get('vrt.history', []);

  /* ---------- Analytics ---------- */

  // GoatCounter site code, e.g. 'vrt-basics' for https://vrt-basics.goatcounter.com.
  // Leave empty to disable. Only page views and anonymous exercise start/finish
  // events are sent: no cookies, no settings, no symptom ratings or notes.
  const GOATCOUNTER_CODE = 'michaelyuan';

  const analytics = {
    queue: [],
    init() {
      if (!GOATCOUNTER_CODE) return;
      window.goatcounter = { no_onload: true };
      const script = document.createElement('script');
      script.async = true;
      script.src = 'https://gc.zgo.at/count.js';
      script.dataset.goatcounter = `https://${GOATCOUNTER_CODE}.goatcounter.com/count`;
      script.onload = () => this.queue.splice(0).forEach((vars) => this.send(vars));
      document.head.appendChild(script);
    },
    send(vars) {
      if (!GOATCOUNTER_CODE) return;
      if (window.goatcounter && window.goatcounter.count) window.goatcounter.count(vars);
      else this.queue.push(vars);
    },
    page(path, title) { this.send({ path, title }); },
    event(name) { this.send({ path: name, title: name, event: true }); },
  };
  analytics.init();

  function loadSettings(ex) {
    const saved = store.get(`vrt.settings.${ex.id}`, {});
    const values = {};
    for (const s of ex.settings) {
      const v = saved[s.key];
      const valid = s.type === 'select' ? s.options.some(([o]) => o === v)
        : s.type === 'toggle' ? typeof v === 'boolean'
          : typeof v === 'number' && v >= s.min && v <= s.max;
      values[s.key] = valid ? v : s.default;
    }
    return values;
  }

  /* ---------- Sound ---------- */

  const sound = {
    ctx: null,
    enabled: store.get('vrt.sound', true),
    unlock() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) this.ctx = new AC();
      }
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    },
    beep(freq = 880, dur = 0.06, vol = 0.18) {
      if (!this.enabled || !this.ctx) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain).connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    },
    speak(text) {
      if (!this.enabled || !('speechSynthesis' in window)) return;
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1.05;
      speechSynthesis.speak(u);
    },
  };

  const soundBtn = document.getElementById('soundToggle');
  function renderSoundBtn() {
    soundBtn.setAttribute('aria-pressed', String(sound.enabled));
    soundBtn.title = sound.enabled ? 'Sound cues on' : 'Sound cues off';
  }
  soundBtn.addEventListener('click', () => {
    sound.enabled = !sound.enabled;
    store.set('vrt.sound', sound.enabled);
    if (sound.enabled) { sound.unlock(); sound.beep(880, 0.06); }
    renderSoundBtn();
  });
  renderSoundBtn();

  /* ---------- Helpers ---------- */

  function esc(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function fmtTime(sec) {
    sec = Math.max(0, Math.ceil(sec));
    return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  }

  function fmtValue(s, v) {
    if (s.type === 'range') return s.unit ? `${v} ${s.unit}` : String(v);
    return String(v);
  }

  /* ---------- Views ---------- */

  function renderHome() {
    const cards = EXERCISES.map((ex) => `
      <a class="card ex-card" href="#/ex/${ex.id}">
        <div class="ex-icon">${ex.icon}</div>
        <span class="tag">${esc(ex.tag)}</span>
        <h2>${esc(ex.title)}</h2>
        <p>${esc(ex.short)}</p>
        <span class="go">Start exercise →</span>
      </a>`).join('');

    view.innerHTML = `
      <section class="hero">
        <h1>Vestibular rehabilitation basics</h1>
        <p>Guided, on-screen practice for the core vestibular rehabilitation therapy (VRT) exercises: gaze stabilization, eye movements, convergence and visual motion. Each exercise has adjustable tempo, timers, audio cues and a symptom log.</p>
        <div class="callout warn">
          <p><strong>Talk to a clinician first.</strong> VRT works best when a vestibular physical therapist prescribes the exercises and the dose for your condition. Stop at once and get medical help if you have sudden severe dizziness, a new headache, changes in speech or vision, weakness or numbness, or a fall. <a href="#/about">Read the safety notes</a>.</p>
        </div>
      </section>
      <h2 class="section-title">Exercises</h2>
      <div class="grid">${cards}</div>
      <h2 class="section-title">Getting set up</h2>
      <div class="how-grid">
        <div class="card"><h3>Distance</h3><p>Sit about an arm’s length (about 1 m / 3 ft) from the screen, with the centre of the screen at eye level.</p></div>
        <div class="card"><h3>Safety first</h3><p>Start seated, with a chair or wall near you. Stand or walk only when your clinician advises it.</p></div>
        <div class="card"><h3>Dose</h3><p>Short, frequent sessions work best. Mild dizziness that settles within about 15–30 minutes is normal.</p></div>
        <div class="card"><h3>Track it</h3><p>Rate your symptoms before and after each set. Then review your progress in the <a href="#/log">log</a>.</p></div>
      </div>`;
  }

  function renderExercise(ex) {
    const values = loadSettings(ex);
    view.innerHTML = `
      <a class="back" href="#/">← All exercises</a>
      <div class="ex-header">
        <span class="tag">${esc(ex.tag)}</span>
        <h1>${esc(ex.title)}</h1>
        <p class="lede">${esc(ex.lede)}</p>
      </div>
      <div class="ex-grid">
        <section class="card">
          <h2>How to do it</h2>
          <ol class="steps">${ex.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
          <h3>Tips</h3>
          <ul class="tips">${ex.tips.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
          <div class="callout warn"><p>${esc(ex.caution)}</p></div>
        </section>
        <aside class="card settings">
          <h2>Settings</h2>
          <form id="settingsForm" onsubmit="return false"></form>
          <hr class="divider">
          <div class="field">
            <label for="beforeRange">Symptoms right now <span class="muted">(0 = none, 10 = worst)</span></label>
            <div class="range-row">
              <input type="range" id="beforeRange" min="0" max="10" step="1" value="0">
              <output id="beforeOut">0</output>
            </div>
          </div>
          <button class="btn primary big" id="startBtn" type="button">Start</button>
          <div class="start-meta">
            <label class="toggle"><input type="checkbox" id="fsToggle" ${store.get('vrt.fullscreen', true) ? 'checked' : ''}> Full screen</label>
            <button type="button" class="link-btn" id="resetBtn">Reset to defaults</button>
          </div>
          <p class="kbd-hint"><kbd>Space</kbd> pause / resume · <kbd>Esc</kbd> stop</p>
        </aside>
      </div>`;

    const form = document.getElementById('settingsForm');
    renderSettings(ex, values, form);

    const before = document.getElementById('beforeRange');
    const beforeOut = document.getElementById('beforeOut');
    before.addEventListener('input', () => { beforeOut.textContent = before.value; });

    document.getElementById('fsToggle').addEventListener('change', (e) => store.set('vrt.fullscreen', e.target.checked));

    document.getElementById('resetBtn').addEventListener('click', () => {
      store.set(`vrt.settings.${ex.id}`, {});
      Object.assign(values, loadSettings(ex));
      renderSettings(ex, values, form);
    });

    document.getElementById('startBtn').addEventListener('click', () => {
      // A warning (e.g. photosensitivity) is confirmed once per browser session.
      const warning = ex.confirm ? ex.confirm(values) : '';
      if (warning && sessionStorage.getItem('vrt.confirmed') !== warning) {
        if (!window.confirm(warning)) return;
        sessionStorage.setItem('vrt.confirmed', warning);
      }
      startSession(ex, { ...values }, {
        before: Number(before.value),
        fullscreen: document.getElementById('fsToggle').checked,
      });
    });
  }

  function renderSettings(ex, values, form) {
    form.innerHTML = '';
    const rows = [];

    for (const s of ex.settings) {
      const id = `set-${s.key}`;
      const field = document.createElement('div');
      field.className = 'field';
      let input;

      if (s.type === 'range') {
        field.innerHTML = `
          <label for="${id}">${esc(s.label)}</label>
          <div class="range-row">
            <input type="range" id="${id}" min="${s.min}" max="${s.max}" step="${s.step}" value="${values[s.key]}">
            <output>${esc(fmtValue(s, values[s.key]))}</output>
          </div>`;
        input = field.querySelector('input');
        const out = field.querySelector('output');
        input.addEventListener('input', () => {
          values[s.key] = Number(input.value);
          out.textContent = fmtValue(s, values[s.key]);
          changed();
        });
      } else if (s.type === 'select') {
        field.innerHTML = `
          <label for="${id}">${esc(s.label)}</label>
          <select id="${id}">${s.options.map(([v, l]) => `<option value="${esc(v)}" ${v === values[s.key] ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
        input = field.querySelector('select');
        input.addEventListener('change', () => { values[s.key] = input.value; changed(); });
      } else if (s.type === 'toggle') {
        field.innerHTML = `<label class="toggle"><input type="checkbox" id="${id}" ${values[s.key] ? 'checked' : ''}> ${esc(s.label)}</label>`;
        input = field.querySelector('input');
        input.addEventListener('change', () => { values[s.key] = input.checked; changed(); });
      }

      if (s.hint) {
        const hint = document.createElement('div');
        hint.className = 'field-hint';
        hint.textContent = s.hint;
        field.appendChild(hint);
      }
      form.appendChild(field);
      rows.push([s, field]);
    }

    function applyVisibility() {
      for (const [s, field] of rows) field.hidden = s.showIf ? !s.showIf(values) : false;
    }
    function changed() {
      store.set(`vrt.settings.${ex.id}`, values);
      applyVisibility();
    }
    applyVisibility();
  }

  function renderLog() {
    const history = getHistory();
    if (!history.length) {
      view.innerHTML = `
        <div class="hero"><h1>Practice log</h1></div>
        <div class="card empty">
          <p>No sessions yet. After each exercise you can save your symptom rating and notes here.</p>
          <a class="btn primary" href="#/">Choose an exercise</a>
        </div>`;
      return;
    }

    const now = Date.now();
    const week = history.filter((r) => now - new Date(r.date).getTime() < 7 * 864e5);
    const totalMin = Math.round(history.reduce((a, r) => a + r.duration, 0) / 60);
    const withBoth = history.filter((r) => r.before != null && r.after != null);
    const avgChange = withBoth.length
      ? (withBoth.reduce((a, r) => a + (r.after - r.before), 0) / withBoth.length).toFixed(1)
      : '—';

    const rows = history.slice().reverse().map((r) => {
      const d = new Date(r.date);
      const diff = r.after - r.before;
      const cls = diff > 0 ? 'up' : diff < 0 ? 'down' : '';
      const sign = diff > 0 ? `+${diff}` : String(diff);
      return `
        <tr>
          <td>${esc(d.toLocaleDateString())}<br><span class="muted">${esc(d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))}</span></td>
          <td><strong>${esc(r.title)}</strong><br><span class="muted">${esc(r.summary || '')}</span></td>
          <td>${esc(fmtTime(r.duration))}${r.stat ? `<br><span class="muted">${esc(r.stat)}</span>` : ''}</td>
          <td class="sym">${r.before} → ${r.after} <span class="${cls}">(${sign})</span></td>
          <td>${esc(r.notes || '')}</td>
        </tr>`;
    }).join('');

    view.innerHTML = `
      <div class="hero"><h1>Practice log</h1><p>Saved in this browser only. Export a copy to share with your clinician.</p></div>
      <div class="stats">
        <div class="card stat"><div class="num">${history.length}</div><div class="lbl">sessions in total</div></div>
        <div class="card stat"><div class="num">${week.length}</div><div class="lbl">sessions in the last 7 days</div></div>
        <div class="card stat"><div class="num">${totalMin}</div><div class="lbl">minutes practised</div></div>
        <div class="card stat"><div class="num">${avgChange}</div><div class="lbl">average symptom change per session</div></div>
      </div>
      <div class="log-actions">
        <button class="btn" id="exportBtn" type="button">Export CSV</button>
        <button class="btn danger" id="clearBtn" type="button">Clear log</button>
      </div>
      <div class="card table-wrap">
        <table>
          <thead><tr><th>Date</th><th>Exercise</th><th>Duration</th><th>Symptoms</th><th>Notes</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;

    document.getElementById('exportBtn').addEventListener('click', exportCsv);
    document.getElementById('clearBtn').addEventListener('click', () => {
      if (window.confirm('Delete all saved sessions from this browser? This cannot be undone.')) {
        store.set('vrt.history', []);
        renderLog();
      }
    });
  }

  function exportCsv() {
    const header = ['date', 'exercise', 'details', 'duration_s', 'progress', 'symptoms_before', 'symptoms_after', 'notes'];
    const cell = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
    const lines = getHistory().map((r) => [r.date, r.title, r.summary, Math.round(r.duration), r.stat, r.before, r.after, r.notes].map(cell).join(','));
    const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vrt-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function renderAbout() {
    view.innerHTML = `
      <div class="prose">
        <div class="hero" style="padding-bottom:0"><h1>Safety &amp; about</h1></div>

        <h2>What is vestibular rehabilitation?</h2>
        <p>Vestibular rehabilitation therapy (VRT) is exercise-based treatment for dizziness, vertigo, imbalance and blurred vision during head movement. These problems often come from inner-ear (vestibular) disorders or a concussion. The exercises use the brain’s ability to adapt: when you repeat the movements that cause mild symptoms, the brain slowly recalibrates.</p>

        <h2>The exercises in this app</h2>
        <ul>
          <li><strong>VOR ×1 and ×2 (gaze stabilization):</strong> train the vestibulo-ocular reflex, so that your vision stays clear while your head moves.</li>
          <li><strong>Saccades:</strong> train fast, accurate eye jumps between targets.</li>
          <li><strong>Smooth pursuit:</strong> train your eyes to follow a moving object steadily. The “head and eyes together” mode trains VOR cancellation.</li>
          <li><strong>Convergence:</strong> trains both eyes to turn in together for near focus.</li>
          <li><strong>Optokinetic training:</strong> uses gradual exposure to large moving patterns, to reduce visually triggered dizziness.</li>
        </ul>

        <h2>Before you start</h2>
        <ul>
          <li>Get an assessment from a clinician. Some conditions, such as BPPV (benign paroxysmal positional vertigo), need different treatment, for example repositioning manoeuvres.</li>
          <li>Start seated, in a safe and clear area. Do standing exercises next to a counter or a corner, or with another person near you.</li>
          <li>Wear your usual glasses. Make sure that the room is well lit.</li>
        </ul>

        <h2>What to expect</h2>
        <ul>
          <li>A mild, short-lived increase in dizziness during and after the exercises is common and expected. It should settle within about 15–30 minutes.</li>
          <li>If your symptoms are still higher after this time, do less next time: use a slower tempo, a shorter duration or an easier position.</li>
          <li>Most people improve over weeks, not days. Practise regularly.</li>
        </ul>

        <div class="callout warn">
          <p><strong>Stop and get emergency help</strong> if you have sudden severe vertigo with a new headache, double vision, slurred speech, facial droop, weakness or numbness, trouble walking, or chest pain.</p>
          <p><strong>Stop and contact your clinician</strong> if you fall, if your symptoms are much worse after exercise and stay that way, or if you have new hearing loss, ringing, or ear pain or fullness.</p>
        </div>

        <h2>Privacy</h2>
        <p>Your settings, symptom ratings and notes are kept only in this browser (localStorage). They are never sent anywhere.</p>
        <p>To see whether people use the app, it counts page views and which exercises are started and finished, using <a href="https://www.goatcounter.com" target="_blank" rel="noopener">GoatCounter</a>. GoatCounter uses no cookies and does not collect personal data. It cannot identify you.</p>

        <h2>Further reading</h2>
        <ul>
          <li>Hall CD, Herdman SJ, Whitney SL, et al. <em>Vestibular Rehabilitation for Peripheral Vestibular Hypofunction: An Updated Clinical Practice Guideline.</em> J Neurol Phys Ther. 2022;46(2):118–177.</li>
          <li>Vestibular Disorders Association (VeDA): <a href="https://vestibular.org" target="_blank" rel="noopener">vestibular.org</a></li>
        </ul>
      </div>`;
  }

  // Set FEEDBACK_FORM_URL to a no-account form (e.g. Tally or Google Forms) to
  // offer it alongside GitHub issues.
  const REPO_URL = 'https://github.com/mikeyyuan/vrt-basics';
  const FEEDBACK_FORM_URL = '';

  function renderFeedback() {
    const form = FEEDBACK_FORM_URL ? `
      <div class="card">
        <h2>Quick feedback form</h2>
        <p class="muted">No account needed. It takes about a minute.</p>
        <a class="btn primary" href="${esc(FEEDBACK_FORM_URL)}" target="_blank" rel="noopener" data-track="feedback-form">Open the feedback form</a>
      </div>` : '';
    view.innerHTML = `
      <div class="prose">
        <div class="hero" style="padding-bottom:0">
          <h1>Feedback</h1>
          <p>Did an exercise help? Was something confusing, or did something not work on your device? Do you have an idea for a new exercise? Your feedback helps improve the app.</p>
        </div>
        <div class="callout warn"><p><strong>Do not include personal health information.</strong> GitHub feedback is public. For questions about your own symptoms or treatment, talk to your clinician.</p></div>
        <div class="how-grid">
          ${form}
          <div class="card">
            <h2>Suggest an idea or give feedback</h2>
            <p class="muted">Needs a free GitHub account.</p>
            <a class="btn${FEEDBACK_FORM_URL ? '' : ' primary'}" href="${REPO_URL}/issues/new?template=feedback.yml" target="_blank" rel="noopener" data-track="feedback-github">Give feedback on GitHub</a>
          </div>
          <div class="card">
            <h2>Report a problem</h2>
            <p class="muted">Something broken or displayed wrong? Tell us your device and browser.</p>
            <a class="btn" href="${REPO_URL}/issues/new?template=bug.yml" target="_blank" rel="noopener" data-track="feedback-bug">Report a bug</a>
          </div>
        </div>
      </div>`;
    view.querySelectorAll('[data-track]').forEach((a) => a.addEventListener('click', () => analytics.event(a.dataset.track)));
  }

  /* ---------- Router ---------- */

  function route() {
    if (session) endSession(false);
    const [page, id] = location.hash.replace(/^#\/?/, '').split('/');
    let nav = 'home';
    if (page === 'ex' && byId[id]) {
      renderExercise(byId[id]);
      document.title = `${byId[id].title} — VRT Basics`;
    } else if (page === 'log') {
      renderLog(); nav = 'log';
      document.title = 'Log — VRT Basics';
    } else if (page === 'feedback') {
      renderFeedback(); nav = 'feedback';
      document.title = 'Feedback — VRT Basics';
    } else if (page === 'about') {
      renderAbout(); nav = 'about';
      document.title = 'Safety & about — VRT Basics';
    } else {
      renderHome();
      document.title = 'VRT Basics — Vestibular Rehabilitation Exercises';
    }
    document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === nav));
    analytics.page(page === 'ex' && byId[id] ? `/ex/${id}` : nav === 'home' ? '/' : `/${nav}`, document.title);
    window.scrollTo(0, 0);
  }

  /* ---------- Session runner ---------- */

  const stage = document.getElementById('stage');
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const hud = {
    title: document.getElementById('hudTitle'),
    stat: document.getElementById('hudStat'),
    cue: document.getElementById('hudCue'),
    time: document.getElementById('hudTime'),
    countdown: document.getElementById('countdown'),
    paused: document.getElementById('pausedOverlay'),
    pauseBtn: document.getElementById('pauseBtn'),
    stopBtn: document.getElementById('stopBtn'),
  };
  let session = null;
  let wakeLock = null;
  let idleTimer = 0;

  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', () => { if (session) resizeCanvas(); });
  document.addEventListener('fullscreenchange', () => { if (session) resizeCanvas(); });

  async function requestWakeLock() {
    try {
      if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen');
    } catch (e) { /* not allowed; ignore */ }
  }
  function releaseWakeLock() {
    if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
  }

  function setCue(text) {
    hud.cue.textContent = text || '';
    hud.cue.hidden = !text;
  }

  function startSession(ex, settings, opts) {
    sound.unlock();
    if (document.activeElement) document.activeElement.blur();
    stage.hidden = false;
    document.body.classList.add('in-session');
    if (opts.fullscreen && stage.requestFullscreen && !document.fullscreenElement) {
      stage.requestFullscreen().catch(() => {});
    }
    requestWakeLock();
    resizeCanvas();

    hud.title.textContent = ex.title;
    hud.stat.textContent = '';
    setCue(ex.cue ? ex.cue(settings) : '');

    const s = {
      ex, settings,
      before: opts.before,
      t: 0,
      state: 'countdown',
      countdown: 3,
      lastCount: 0,
      paused: false,
      stat: '',
      last: performance.now(),
      raf: 0,
    };
    session = s;
    const api = {
      beep: (f, d) => sound.beep(f, d),
      speak: (text) => { if (settings.voice) sound.speak(text); },
      setStat: (text) => { s.stat = text; hud.stat.textContent = text; },
      setCue,
      finish: () => endSession(true),
    };
    s.inst = ex.create(settings, api);
    analytics.event(`start-${ex.id}`);
    setPaused(false);
    poke();
    s.raf = requestAnimationFrame(frame);
  }

  function frame(now) {
    const s = session;
    if (!s) return;
    const dt = Math.min(0.1, Math.max(0, (now - s.last) / 1000));
    s.last = now;

    if (!s.paused) {
      if (s.state === 'countdown') {
        s.countdown -= dt;
        const n = Math.ceil(s.countdown);
        if (n > 0 && n !== s.lastCount) {
          s.lastCount = n;
          sound.beep(520, 0.09);
        }
        if (s.countdown <= 0) {
          s.state = 'active';
          sound.beep(1040, 0.14);
        }
      } else {
        s.t += dt;
        s.inst.update(s.t, dt);
        if (session !== s) return; // the exercise finished itself
        if (s.settings.duration && s.t >= s.settings.duration) {
          endSession(true);
          return;
        }
      }
    }

    const w = stage.clientWidth;
    const h = stage.clientHeight;
    ctx.clearRect(0, 0, w, h);
    s.inst.draw(ctx, w, h, s.t);

    hud.countdown.hidden = s.state !== 'countdown';
    if (s.state === 'countdown') hud.countdown.textContent = String(Math.max(1, Math.ceil(s.countdown)));
    hud.time.textContent = s.settings.duration ? fmtTime(s.settings.duration - s.t) : fmtTime(s.t);

    s.raf = requestAnimationFrame(frame);
  }

  function setPaused(paused) {
    if (!session) return;
    session.paused = paused;
    hud.paused.hidden = !paused;
    hud.pauseBtn.textContent = paused ? 'Resume' : 'Pause';
    if (paused && 'speechSynthesis' in window) speechSynthesis.cancel();
    poke();
  }

  function endSession(completed) {
    const s = session;
    if (!s) return;
    cancelAnimationFrame(s.raf);
    session = null;
    stage.hidden = true;
    stage.classList.remove('idle');
    clearTimeout(idleTimer);
    document.body.classList.remove('in-session');
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    releaseWakeLock();
    if (completed) {
      sound.beep(1040, 0.25);
      analytics.event(`complete-${s.ex.id}`);
    }
    if (s.t >= 3) showEndDialog(s, completed);
  }

  // Fade the HUD and hide the cursor after a few seconds without input.
  function poke() {
    stage.classList.remove('idle');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (session && !session.paused) stage.classList.add('idle');
    }, 2500);
  }

  // Blur after clicks so a later Space press doesn't also activate the button.
  hud.pauseBtn.addEventListener('click', () => { hud.pauseBtn.blur(); setPaused(!session.paused); });
  hud.stopBtn.addEventListener('click', () => endSession(false));
  stage.addEventListener('pointermove', poke);
  stage.addEventListener('pointerdown', poke);

  document.addEventListener('keydown', (e) => {
    if (!session) return;
    if (e.code === 'Space') {
      e.preventDefault();
      setPaused(!session.paused);
    } else if (e.key === 'Escape') {
      endSession(false);
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && session) setPaused(true);
    else if (!document.hidden && session && wakeLock === null) requestWakeLock();
  });

  /* ---------- End-of-session dialog ---------- */

  const dlg = document.getElementById('endDialog');
  const afterRange = document.getElementById('afterRange');
  const afterOut = document.getElementById('afterOut');
  const endAdvice = document.getElementById('endAdvice');
  let pendingRecord = null;

  function updateAdvice() {
    const before = pendingRecord ? pendingRecord.before : 0;
    const after = Number(afterRange.value);
    afterOut.textContent = afterRange.value;
    if (after >= 7) {
      endAdvice.hidden = false;
      endAdvice.className = 'callout warn';
      endAdvice.textContent = 'Your symptoms are high. Sit down and rest until they settle. Next time, make the exercise easier (slower, shorter, or seated). Contact your clinician if they do not settle.';
    } else if (after - before >= 3) {
      endAdvice.hidden = false;
      endAdvice.className = 'callout warn';
      endAdvice.textContent = 'Your symptoms went up quite a lot. Rest before the next set. If they have not settled within about 15–30 minutes, make the exercise easier next time.';
    } else {
      endAdvice.hidden = true;
    }
  }
  afterRange.addEventListener('input', updateAdvice);

  function showEndDialog(s, completed) {
    pendingRecord = {
      date: new Date().toISOString(),
      exerciseId: s.ex.id,
      title: s.ex.title,
      summary: s.ex.summarize ? s.ex.summarize(s.settings) : '',
      duration: Math.round(s.t * 10) / 10,
      stat: s.stat,
      before: s.before,
      after: s.before,
      notes: '',
    };
    document.getElementById('endTitle').textContent = completed ? 'Session complete' : 'Session stopped';
    document.getElementById('endSummary').textContent =
      [`${s.ex.title}`, fmtTime(s.t), s.stat].filter(Boolean).join(' · ');
    afterRange.value = String(s.before);
    document.getElementById('endNotes').value = '';
    updateAdvice();
    dlg.returnValue = '';
    dlg.showModal();
  }

  dlg.addEventListener('close', () => {
    if (dlg.returnValue === 'save' && pendingRecord) {
      pendingRecord.after = Number(afterRange.value);
      pendingRecord.notes = document.getElementById('endNotes').value.trim();
      const history = getHistory();
      history.push(pendingRecord);
      store.set('vrt.history', history);
      if (location.hash.startsWith('#/log')) renderLog();
    }
    pendingRecord = null;
  });

  /* ---------- Boot ---------- */

  window.addEventListener('hashchange', route);
  route();
})();

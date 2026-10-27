/*
 * Exercise definitions for VRT Basics.
 *
 * Each exercise provides metadata for the UI (text, settings schema) and a
 * create(settings, api) factory. The factory returns an object with:
 *   update(t, dt)        - advance state; t = active seconds since start
 *   draw(ctx, w, h, t)   - render one frame in CSS pixels
 * The api object lets an exercise play cues and report progress:
 *   api.beep(freq, dur), api.speak(text), api.setStat(text),
 *   api.setCue(text), api.finish()
 */
(function () {
  'use strict';

  const COLORS = {
    bg: '#f4f1ea',
    ink: '#1c2830',
    accent: '#c2410c',
    faint: 'rgba(28, 40, 48, 0.14)',
    guide: '#0f766e',
  };
  const FONT = '"Segoe UI", system-ui, -apple-system, Roboto, Arial, sans-serif';

  // Letters chosen to be easy to tell apart at a glance.
  const LETTERS = 'ABCDEFHKLNPRTUXZ';
  function randLetter(prev) {
    let c;
    do { c = LETTERS[Math.floor(Math.random() * LETTERS.length)]; } while (c === prev);
    return c;
  }

  const SIZE = { small: 0.035, medium: 0.055, large: 0.085 };
  const AMPLITUDE = { small: 0.18, medium: 0.28, large: 0.38 };
  const HUD_CLEARANCE = 72;

  // Largest offsets from centre that keep a target of radius r clear of the
  // screen edges and the HUD bar.
  function extent(w, h, r) {
    return {
      x: Math.max(0, w / 2 - r * 1.4 - 16),
      y: Math.max(0, h / 2 - Math.max(r * 1.4, HUD_CLEARANCE)),
    };
  }

  const ease = (x) => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, x)));

  /* ---------- Drawing helpers ---------- */

  let busyPattern = null;
  function getBusyPattern(ctx) {
    if (busyPattern) return busyPattern;
    const n = 44;
    const c = document.createElement('canvas');
    c.width = c.height = n * 2;
    const g = c.getContext('2d');
    g.fillStyle = '#ddd6c6';
    g.fillRect(0, 0, n * 2, n * 2);
    g.fillStyle = '#c3b9a4';
    g.fillRect(0, 0, n, n);
    g.fillRect(n, n, n, n);
    g.strokeStyle = 'rgba(28, 40, 48, 0.28)';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(n * 0.5, n * 1.5, n * 0.28, 0, Math.PI * 2);
    g.moveTo(n * 1.2, n * 0.2);
    g.lineTo(n * 1.8, n * 0.8);
    g.moveTo(n * 1.8, n * 0.2);
    g.lineTo(n * 1.2, n * 0.8);
    g.stroke();
    busyPattern = ctx.createPattern(c, 'repeat');
    return busyPattern;
  }

  function drawBackground(ctx, w, h, kind) {
    ctx.fillStyle = kind === 'busy' ? getBusyPattern(ctx) : COLORS.bg;
    ctx.fillRect(0, 0, w, h);
  }

  function drawTarget(ctx, x, y, r, kind, letter, color) {
    color = color || COLORS.ink;
    ctx.save();
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    if (kind === 'dot') {
      ctx.beginPath();
      ctx.arc(x, y, r * 0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(x, y, r * 0.14, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === 'cross') {
      ctx.lineWidth = Math.max(3, r * 0.22);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x - r * 0.75, y);
      ctx.lineTo(x + r * 0.75, y);
      ctx.moveTo(x, y - r * 0.75);
      ctx.lineTo(x, y + r * 0.75);
      ctx.stroke();
    } else {
      ctx.font = `800 ${Math.round(r * 1.7)}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(4, r * 0.18);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.strokeText(letter, x, y);
      ctx.fillText(letter, x, y);
    }
    ctx.restore();
  }

  // Pacing guide: a track with a dot that shows where the head should be.
  // p runs from -1 (left / up) to 1 (right / down).
  function drawPacer(ctx, w, h, p, axis, label) {
    const m = Math.min(w, h);
    const horiz = axis === 'horizontal';
    const len = horiz ? Math.min(w * 0.5, 420) : Math.min(h * 0.5, 320);
    const cx = horiz ? w / 2 : w - Math.max(44, m * 0.07);
    const cy = horiz ? h - Math.max(48, m * 0.09) : h / 2;
    ctx.save();
    ctx.strokeStyle = 'rgba(15, 118, 110, 0.28)';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (horiz) {
      ctx.moveTo(cx - len / 2, cy);
      ctx.lineTo(cx + len / 2, cy);
    } else {
      ctx.moveTo(cx, cy - len / 2);
      ctx.lineTo(cx, cy + len / 2);
    }
    ctx.stroke();
    const px = horiz ? cx + (p * len) / 2 : cx;
    const py = horiz ? cy : cy + (p * len) / 2;
    ctx.fillStyle = COLORS.guide;
    ctx.beginPath();
    ctx.arc(px, py, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = `600 13px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    if (horiz) {
      ctx.fillText(label, cx, cy - 18);
    } else {
      ctx.fillText(label, cx, cy - len / 2 - 18);
    }
    ctx.restore();
  }

  function drawLabel(ctx, text, x, y, size, color) {
    ctx.save();
    ctx.font = `700 ${size}px ${FONT}`;
    ctx.fillStyle = color || COLORS.ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  /* ---------- Optokinetic patterns ---------- */

  const OKN_COLORS = {
    high: ['#141414', '#f2f2f2'],
    low: ['#7a7a7a', '#a3a3a3'],
  };
  const OKN_WIDTH = { narrow: 0.04, medium: 0.07, wide: 0.11 };
  const OKN_ANGLE = {
    right: 0, 'down-right': Math.PI / 4, down: Math.PI / 2, 'down-left': (3 * Math.PI) / 4,
    left: Math.PI, 'up-left': (-3 * Math.PI) / 4, up: -Math.PI / 2, 'up-right': -Math.PI / 4,
  };
  const OKN_LINEAR = ['stripes', 'checker', 'dots'];
  const OKN_PATTERN_LABEL = {
    stripes: 'stripes', checker: 'checkerboard', dots: 'dot field', rotate: 'roll', flow: 'optic flow',
  };
  const OKN_MOTION_LABEL = { constant: 'steady', alternate: 'reversing', oscillate: 'back and forth' };
  const OKN_PHOTOSENSITIVITY = 'Photosensitivity warning: moving high-contrast patterns can trigger seizures in people with photosensitive epilepsy. They can also cause strong dizziness or nausea. Do not use this exercise if you have photosensitive epilepsy. Have someone near you if you do it standing.';
  const OKN_CONFIRM = 'Optokinetic patterns can strongly provoke dizziness or nausea and may trigger seizures in people with photosensitive epilepsy.\n\nDo not continue if you have photosensitive epilepsy. Sit down with support before you start.\n\nContinue?';

  const mod = (a, n) => ((a % n) + n) % n;

  // Distance travelled after t seconds at unit speed for each motion style.
  // 'alternate' reverses sharply every period; 'oscillate' eases back and forth.
  function travel(t, motion, period) {
    if (motion === 'alternate') return period - Math.abs(mod(t, 2 * period) - period);
    if (motion === 'oscillate') return (period / Math.PI) * (1 - Math.cos((Math.PI * t) / period));
    return t;
  }

  // Keys get a prefix (e.g. 'bg' -> 'bgPattern') when the pattern is the
  // background for another task, so they don't clash with its settings.
  const prefixed = (prefix, name) => (prefix ? prefix + name[0].toUpperCase() + name.slice(1) : name);

  // `when` (optional) hides all of these settings unless it returns true.
  function oknSettings(prefix, labelPrefix, when) {
    const k = (name) => prefixed(prefix, name);
    const L = (label) => (labelPrefix ? `${labelPrefix} ${label.toLowerCase()}` : label);
    const list = [
      {
        key: k('pattern'), label: L('Pattern'), type: 'select', default: 'stripes',
        options: [
          ['stripes', 'Stripes'],
          ['checker', 'Checkerboard'],
          ['dots', 'Dot field'],
          ['rotate', 'Rotating dots (roll)'],
          ['flow', 'Optic flow (moving forward / back)'],
        ],
      },
      {
        key: k('direction'), label: L('Direction'), type: 'select', default: 'left',
        options: [
          ['left', 'Left ←'], ['right', 'Right →'], ['up', 'Up ↑'], ['down', 'Down ↓'],
          ['up-left', 'Up-left ↖'], ['up-right', 'Up-right ↗'], ['down-left', 'Down-left ↙'], ['down-right', 'Down-right ↘'],
        ],
        showIf: (s) => OKN_LINEAR.includes(s[k('pattern')]),
      },
      {
        key: k('rotation'), label: L('Rotation'), type: 'select', default: 'cw',
        options: [['cw', 'Clockwise ↻'], ['ccw', 'Counter-clockwise ↺']],
        showIf: (s) => s[k('pattern')] === 'rotate',
      },
      {
        key: k('flow'), label: L('Direction'), type: 'select', default: 'forward',
        options: [['forward', 'Forward (expanding)'], ['backward', 'Backward (contracting)']],
        showIf: (s) => s[k('pattern')] === 'flow',
      },
      {
        key: k('motion'), label: L('Motion'), type: 'select', default: 'constant',
        options: [['constant', 'Steady, one direction'], ['alternate', 'Reverse every few seconds'], ['oscillate', 'Smooth back and forth']],
      },
      {
        key: k('period'), label: L('Time before reversing'), type: 'range', min: 2, max: 20, step: 1, unit: 's', default: 6,
        showIf: (s) => s[k('motion')] !== 'constant',
      },
      { key: k('speed'), label: L('Speed'), type: 'range', min: 1, max: 10, step: 1, unit: '', default: 3 },
      {
        key: k('width'), label: L('Stripe / dot size'), type: 'select', default: 'medium',
        options: [['narrow', 'Small'], ['medium', 'Medium'], ['wide', 'Large']],
      },
      {
        key: k('contrast'), label: L('Contrast'), type: 'select', default: 'low',
        options: [['low', 'Low (gentler)'], ['high', 'High']],
      },
    ];
    if (!when) return list;
    return list.map((item) => ({ ...item, showIf: (s) => when(s) && (!item.showIf || item.showIf(s)) }));
  }

  function oknConfig(s, prefix) {
    const c = {};
    for (const name of ['pattern', 'direction', 'rotation', 'flow', 'motion', 'period', 'speed', 'width', 'contrast']) {
      c[name] = s[prefixed(prefix, name)];
    }
    return c;
  }

  function oknSummary(c) {
    const dir = c.pattern === 'rotate' ? c.rotation : c.pattern === 'flow' ? c.flow : c.direction;
    return `${OKN_PATTERN_LABEL[c.pattern]} · ${dir} · ${OKN_MOTION_LABEL[c.motion]} · speed ${c.speed} · ${c.contrast} contrast`;
  }

  function createOknBackground(c) {
    const dots = Array.from({ length: 260 }, () => ({
      x: Math.random(),
      y: Math.random(),
      z: Math.random(),
      a: Math.random() * Math.PI * 2,
      rr: Math.sqrt(Math.random()),
      r: 0.6 + Math.random() * 0.8,
    }));
    const [c1, c2] = OKN_COLORS[c.contrast];
    const dist = (t) => travel(t, c.motion, c.period) * c.speed;

    // Stripes, checkerboard and dots: draw in a frame rotated to the motion
    // direction, so motion is always along +x there.
    function drawLinear(ctx, w, h, t, m) {
      const R = Math.hypot(w, h) / 2 + 2;
      const d = dist(t) * m * 0.06;
      const sw = m * OKN_WIDTH[c.width];
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.rotate(OKN_ANGLE[c.direction]);
      if (c.pattern === 'stripes') {
        const period = sw * 2;
        const off = mod(d, period);
        for (let x = -R - period + off; x < R; x += period) ctx.fillRect(x, -R, sw, 2 * R);
      } else if (c.pattern === 'checker') {
        const off = mod(d, sw * 2);
        const n = Math.ceil(R / sw) + 2;
        for (let i = -n; i < n; i++) {
          for (let j = -n; j < n; j++) {
            if (mod(i + j, 2) === 0) ctx.fillRect(i * sw + off, j * sw, sw, sw);
          }
        }
      } else {
        const L = 2 * R;
        const base = m * OKN_WIDTH[c.width] * 0.3;
        for (const p of dots) {
          ctx.beginPath();
          ctx.arc(mod(p.x * L + d, L) - R, p.y * L - R, base * p.r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    function drawRotate(ctx, w, h, t, m) {
      const turn = dist(t) * 0.06 * (c.rotation === 'ccw' ? -1 : 1);
      const R = Math.hypot(w, h) / 2;
      const base = m * OKN_WIDTH[c.width] * 0.45;
      for (const p of dots) {
        const ang = p.a + turn;
        const rad = p.rr * R;
        ctx.beginPath();
        ctx.arc(w / 2 + Math.cos(ang) * rad, h / 2 + Math.sin(ang) * rad, base * p.r * (0.25 + p.rr), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Optic flow: dots in 3D space projected towards the centre. Bringing the
    // dots nearer makes the field expand, as when walking forward.
    function drawFlow(ctx, w, h, t, m) {
      const NEAR = 0.08;
      const f = m * 0.5;
      const dz = dist(t) * 0.05 * (c.flow === 'backward' ? -1 : 1);
      const base = m * OKN_WIDTH[c.width] * 0.14;
      for (const p of dots) {
        const z = NEAR + (1 - NEAR) * mod(p.z - dz, 1);
        const x = w / 2 + ((p.x * 4 - 2) * f) / z;
        const y = h / 2 + ((p.y * 4 - 2) * f) / z;
        const r = Math.min((base * p.r) / z, base * 14);
        if (x < -r || x > w + r || y < -r || y > h + r) continue;
        // Fade dots in and out at both ends of the depth range so they don't pop.
        ctx.globalAlpha = Math.max(0, Math.min(1, (z - NEAR) / 0.15, (1 - z) / 0.15));
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    return {
      draw(ctx, w, h, t) {
        const m = Math.min(w, h);
        ctx.fillStyle = c1;
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = c2;
        if (c.pattern === 'rotate') drawRotate(ctx, w, h, t, m);
        else if (c.pattern === 'flow') drawFlow(ctx, w, h, t, m);
        else drawLinear(ctx, w, h, t, m);
      },
    };
  }

  function drawFixation(ctx, w, h) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 8, 0, Math.PI * 2);
    ctx.fill();
  }

  /* ---------- Backgrounds for target exercises ---------- */

  const BACKGROUND_SETTINGS = [
    {
      key: 'background', label: 'Background', type: 'select', default: 'plain',
      options: [['plain', 'Plain'], ['busy', 'Busy pattern (harder)'], ['okn', 'Moving pattern (optokinetic, hardest)']],
    },
    ...oknSettings('bg', 'Background', (s) => s.background === 'okn'),
  ];
  const BACKGROUND_TIP = 'The “Moving pattern” background adds optokinetic stimulation and is the hardest option. Photosensitivity warning: do not use it if you have photosensitive epilepsy.';
  const backgroundSummary = (s) => (s.background === 'okn'
    ? `moving ${OKN_PATTERN_LABEL[s.bgPattern]} background`
    : `${s.background} background`);
  const backgroundConfirm = (s) => (s.background === 'okn' ? OKN_CONFIRM : '');

  // Draws the chosen background, and targets on top of it. On a moving
  // pattern each target sits on a solid disc so it stays readable.
  function createBackdrop(s) {
    const okn = s.background === 'okn' ? createOknBackground(oknConfig(s, 'bg')) : null;
    return {
      draw(ctx, w, h, t) {
        if (okn) okn.draw(ctx, w, h, t);
        else drawBackground(ctx, w, h, s.background);
      },
      target(ctx, x, y, r, kind, letter) {
        if (okn) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
          ctx.beginPath();
          ctx.arc(x, y, r * 1.35, 0, Math.PI * 2);
          ctx.fill();
        }
        drawTarget(ctx, x, y, r, kind, letter);
      },
    };
  }

  /* ---------- Shared settings ---------- */

  const S = {
    duration: (def, min, max) => ({
      key: 'duration', label: 'Duration', type: 'range',
      min: min || 15, max: max || 300, step: 15, unit: 's', default: def,
    }),
    bpm: (def) => ({
      key: 'bpm', label: 'Tempo (head turns per minute)', type: 'range',
      min: 40, max: 200, step: 5, unit: 'bpm', default: def,
      hint: 'One beep for each head turn. Go only as fast as the target stays clear.',
    }),
    axis: {
      key: 'axis', label: 'Head movement', type: 'select', default: 'horizontal',
      options: [['horizontal', 'Side to side (turning “no”)'], ['vertical', 'Up and down (nodding “yes”)']],
    },
    target: {
      key: 'target', label: 'Target', type: 'select', default: 'letter',
      options: [['letter', 'Letter (changes every few seconds)'], ['cross', 'Cross'], ['dot', 'Dot']],
    },
    size: {
      key: 'size', label: 'Target size', type: 'select', default: 'medium',
      options: [['small', 'Small (harder)'], ['medium', 'Medium'], ['large', 'Large (easier)']],
    },
    pacer: { key: 'pacer', label: 'Show head pacing guide', type: 'toggle', default: true },
  };

  const AXIS_LABEL = { horizontal: 'side to side', vertical: 'up/down' };
  const PROGRESSION = 'Progress slowly, as advised: sitting → standing with feet apart → feet together → one foot in front of the other → standing on a soft surface → walking.';

  /* ---------- Exercises ---------- */

  const vor1 = {
    id: 'vor1',
    tag: 'Gaze stabilization',
    title: 'VOR ×1',
    short: 'Keep your eyes on a still target while you turn your head.',
    lede: 'The vestibulo-ocular reflex (VOR) keeps your vision steady when your head moves. In VOR ×1 the target stays still and your head moves, so your eyes must turn the opposite way to keep the letter clear.',
    steps: [
      'Sit about an arm’s length (about 1 m / 3 ft) from the screen with the target at eye level. Stand only if your clinician advised it.',
      'Look at the target in the centre. Keep it in focus the whole time.',
      'Turn your head side to side (or nod up and down) about 20–30° each way. Reach the end of each turn on the beep. The green guide shows the rhythm.',
      'Move as fast as you can while the target stays clear. If it blurs or jumps, lower the tempo.',
      'If you use a letter, read it to yourself each time it changes. This checks that your vision stays sharp.',
    ],
    tips: [
      'Start at about 60–90 turns per minute and increase slowly over days.',
      'A common starting dose is 1–2 minutes, several times a day. Follow your clinician’s plan.',
      'Mild, short-lived dizziness is expected. It should settle within about 15–30 minutes.',
      'When a plain background is easy, try the busy pattern, a smaller target, or standing.',
      BACKGROUND_TIP,
      PROGRESSION,
    ],
    caution: 'If you have neck pain or a neck condition, keep the head movements small and gentle and check with your clinician.',
    confirm: backgroundConfirm,
    settings: [S.axis, S.bpm(80), S.duration(60), S.target, S.size, ...BACKGROUND_SETTINGS, S.pacer],
    summarize: (s) => `${AXIS_LABEL[s.axis]} · ${s.bpm} bpm · ${backgroundSummary(s)}`,
    cue: (s) => (s.axis === 'horizontal' ? 'Eyes on the target · turn head side to side' : 'Eyes on the target · nod head up and down'),
    create(s, api) {
      const bg = createBackdrop(s);
      let letter = randLetter();
      let lastBeat = 0;
      let lastSwap = 0;
      return {
        update(t) {
          const beat = Math.floor((t * s.bpm) / 60);
          if (beat !== lastBeat) {
            lastBeat = beat;
            api.beep(beat % 2 ? 660 : 880, 0.05);
            api.setStat(`${beat} head turns`);
          }
          if (s.target === 'letter' && t - lastSwap > 4) {
            letter = randLetter(letter);
            lastSwap = t;
          }
        },
        draw(ctx, w, h, t) {
          bg.draw(ctx, w, h, t);
          const r = Math.min(w, h) * SIZE[s.size];
          bg.target(ctx, w / 2, h / 2, r, s.target, letter);
          if (s.pacer) drawPacer(ctx, w, h, -Math.cos((Math.PI * t * s.bpm) / 60), s.axis, 'Head');
        },
      };
    },
  };

  const vor2 = {
    id: 'vor2',
    tag: 'Gaze stabilization',
    title: 'VOR ×2',
    short: 'The target and your head move in opposite directions. This is harder than VOR ×1.',
    lede: 'VOR ×2 doubles the demand on the reflex. The target moves one way while your head turns the other way, and your eyes must stay locked on the target.',
    steps: [
      'Sit in the same position as for VOR ×1, about an arm’s length from the screen.',
      'Watch the moving target. When it moves right, turn your head left. When it moves left, turn your head right.',
      'Your head reaches the end of each turn on the beep, at the same time as the target reaches the opposite end. The green guide shows where your head should be.',
      'Keep the target clear. If it blurs, lower the tempo or choose a smaller distance.',
    ],
    tips: [
      'Be comfortable with VOR ×1 before you start VOR ×2.',
      'Start with a small distance and a slow tempo (about 50–70 bpm).',
      'Short sets of 30–60 seconds are fine at first.',
      BACKGROUND_TIP,
      PROGRESSION,
    ],
    caution: 'This exercise often causes more symptoms than VOR ×1. Stop and rest if dizziness becomes more than mild.',
    confirm: backgroundConfirm,
    settings: [
      S.axis, S.bpm(60), S.duration(60),
      {
        key: 'amplitude', label: 'Target travel distance', type: 'select', default: 'small',
        options: [['small', 'Small'], ['medium', 'Medium'], ['large', 'Large']],
      },
      S.target, S.size, ...BACKGROUND_SETTINGS, S.pacer,
    ],
    summarize: (s) => `${AXIS_LABEL[s.axis]} · ${s.bpm} bpm · ${s.amplitude} travel · ${backgroundSummary(s)}`,
    cue: () => 'Head moves opposite to the target',
    create(s, api) {
      const bg = createBackdrop(s);
      let letter = randLetter();
      let lastBeat = 0;
      let lastSwap = 0;
      return {
        update(t) {
          const beat = Math.floor((t * s.bpm) / 60);
          if (beat !== lastBeat) {
            lastBeat = beat;
            api.beep(beat % 2 ? 660 : 880, 0.05);
            api.setStat(`${beat} head turns`);
          }
          if (s.target === 'letter' && t - lastSwap > 4) {
            letter = randLetter(letter);
            lastSwap = t;
          }
        },
        draw(ctx, w, h, t) {
          bg.draw(ctx, w, h, t);
          const r = Math.min(w, h) * SIZE[s.size];
          const lim = extent(w, h, r);
          const horiz = s.axis === 'horizontal';
          const amp = horiz ? Math.min(w * AMPLITUDE[s.amplitude], lim.x) : Math.min(h * AMPLITUDE[s.amplitude], lim.y);
          const head = -Math.cos((Math.PI * t * s.bpm) / 60);
          const p = -head;

          ctx.save();
          ctx.strokeStyle = COLORS.faint;
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 8]);
          ctx.beginPath();
          if (horiz) {
            ctx.moveTo(w / 2 - amp, h / 2);
            ctx.lineTo(w / 2 + amp, h / 2);
          } else {
            ctx.moveTo(w / 2, h / 2 - amp);
            ctx.lineTo(w / 2, h / 2 + amp);
          }
          ctx.stroke();
          ctx.restore();

          const x = horiz ? w / 2 + p * amp : w / 2;
          const y = horiz ? h / 2 : h / 2 + p * amp;
          bg.target(ctx, x, y, r, s.target, letter);
          if (s.pacer) drawPacer(ctx, w, h, head, s.axis, 'Head');
        },
      };
    },
  };

  const SACCADE_POINTS = {
    horizontal: [[-1, 0], [1, 0]],
    vertical: [[0, -1], [0, 1]],
    diagonal: [[-1, -1], [1, 1]],
    diagonal2: [[-1, 1], [1, -1]],
  };
  const SPREAD = { near: 0.4, medium: 0.6, far: 0.85 };

  const SACCADE_SETTINGS = {
    pattern: {
      key: 'pattern', label: 'Target pattern', type: 'select', default: 'horizontal',
      options: [
        ['horizontal', 'Horizontal (left ↔ right)'],
        ['vertical', 'Vertical (up ↕ down)'],
        ['diagonal', 'Diagonal ↘'],
        ['diagonal2', 'Diagonal ↗'],
        ['random', 'Random positions (hardest)'],
      ],
    },
    interval: (def) => ({
      key: 'interval', label: 'Time between jumps', type: 'range',
      min: 0.5, max: 3, step: 0.25, unit: 's', default: def,
    }),
    distance: {
      key: 'distance', label: 'Distance between targets', type: 'select', default: 'medium',
      options: [['near', 'Near'], ['medium', 'Medium'], ['far', 'Far']],
    },
  };

  // A highlighted letter that jumps between positions. The 'card' style puts
  // each target on a solid disc so it stays readable over a moving background.
  function createSaccadeTask(s, api, style) {
    let idx = 0;
    let letter = randLetter();
    let point = [-0.5, 0];
    let last = 0;
    let count = 0;

    function next() {
      if (s.pattern === 'random') {
        let p;
        do { p = [Math.random() * 2 - 1, Math.random() * 2 - 1]; }
        while (Math.hypot(p[0] - point[0], p[1] - point[1]) < 0.8);
        point = p;
      } else {
        idx = 1 - idx;
      }
      letter = randLetter(letter);
      count += 1;
      api.beep(760, 0.04);
      api.setStat(`${count} saccades`);
    }

    function drawSpot(ctx, x, y, r, active) {
      if (style === 'card') {
        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
        ctx.strokeStyle = active ? COLORS.accent : 'rgba(28, 40, 48, 0.4)';
        ctx.lineWidth = active ? 4 : 2;
        ctx.beginPath();
        ctx.arc(x, y, active ? r * 1.35 : r * 0.45, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        if (active) drawTarget(ctx, x, y, r, 'letter', letter, COLORS.accent);
      } else if (active) {
        drawTarget(ctx, x, y, r, 'letter', letter, COLORS.accent);
      } else {
        ctx.fillStyle = COLORS.faint;
        ctx.beginPath();
        ctx.arc(x, y, r * 0.35, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    return {
      update(t) {
        if (t - last >= s.interval) {
          last = t;
          next();
        }
      },
      draw(ctx, w, h) {
        const r = Math.min(w, h) * SIZE[s.size];
        const lim = extent(w, h, r);
        const sx = Math.min((w * SPREAD[s.distance]) / 2, lim.x);
        const sy = Math.min((h * SPREAD[s.distance]) / 2, lim.y);
        const map = (p) => [w / 2 + p[0] * sx, h / 2 + p[1] * sy];

        if (s.pattern === 'random') {
          const [x, y] = map(point);
          drawSpot(ctx, x, y, r, true);
          return;
        }
        SACCADE_POINTS[s.pattern].forEach((p, i) => {
          const [x, y] = map(p);
          drawSpot(ctx, x, y, r, i === idx);
        });
      },
    };
  }

  const saccades = {
    id: 'saccades',
    tag: 'Eye movements',
    title: 'Saccades',
    short: 'Move your eyes quickly and accurately between two targets.',
    lede: 'Saccades are the fast jumps your eyes make from one point to another, for example when you read or look around a room. Practice makes these jumps faster and more accurate.',
    steps: [
      'Sit about an arm’s length from the screen. Keep your head still. You can rest your chin on your hand to notice head movement.',
      'When the orange letter jumps to a new position, move only your eyes to it as quickly and accurately as you can.',
      'Read the letter to yourself, then wait for the next jump.',
      'In “eyes, then head” mode: jump your eyes to the target first, then turn your head to face it while you keep the letter clear.',
    ],
    tips: [
      'To make it harder, increase the distance, shorten the interval, or use the random pattern.',
      'Horizontal is usually easiest, then vertical, then diagonal.',
      'If you overshoot or undershoot the target a lot, use a longer interval.',
      'When this is easy, try Saccades + optokinetic, which adds a moving background.',
    ],
    caution: 'Rest if you feel eye strain or a headache.',
    settings: [
      SACCADE_SETTINGS.pattern,
      SACCADE_SETTINGS.interval(1.5),
      SACCADE_SETTINGS.distance,
      {
        key: 'mode', label: 'Mode', type: 'select', default: 'eyes',
        options: [['eyes', 'Eyes only (head still)'], ['eyesHead', 'Eyes, then head']],
      },
      S.size,
      S.duration(60),
    ],
    summarize: (s) => `${s.pattern} · every ${s.interval}s · ${s.mode === 'eyes' ? 'eyes only' : 'eyes then head'}`,
    cue: (s) => (s.mode === 'eyes' ? 'Keep head still · jump eyes to the orange letter' : 'Eyes first, then turn head to the target'),
    create(s, api) {
      const task = createSaccadeTask(s, api, 'plain');
      return {
        update: (t) => task.update(t),
        draw(ctx, w, h) {
          drawBackground(ctx, w, h, 'plain');
          task.draw(ctx, w, h);
        },
      };
    },
  };

  const pursuit = {
    id: 'pursuit',
    tag: 'Eye movements',
    title: 'Smooth pursuit',
    short: 'Follow a moving target smoothly with your eyes.',
    lede: 'Smooth pursuit is the ability to follow a moving object steadily, without your eyes falling behind or jumping ahead.',
    steps: [
      'Sit about an arm’s length from the screen with the screen centre at eye level.',
      'Eyes only mode: keep your head still and follow the target with your eyes. Keep it as clear as you can.',
      'Head and eyes together mode (VOR cancellation): move your head with the target so your nose always points at it, and keep your eyes fixed on it.',
      'If your eyes catch up in small jumps, or the target blurs, lower the speed.',
    ],
    tips: [
      'Start slowly, at 0.2–0.3 cycles per second.',
      'A typical order is horizontal → vertical → diagonal → circle / figure-8 → random.',
      'Do this exercise standing only when it is easy while you sit.',
      'Following a target over a moving background is harder still. Try it when plain pursuit is easy.',
      BACKGROUND_TIP,
    ],
    caution: 'Stop and rest if you feel nauseous or the dizziness builds up.',
    confirm: backgroundConfirm,
    settings: [
      {
        key: 'pattern', label: 'Path', type: 'select', default: 'horizontal',
        options: [
          ['horizontal', 'Horizontal'],
          ['vertical', 'Vertical'],
          ['diagonal', 'Diagonal'],
          ['circle', 'Circle'],
          ['figure8', 'Figure-8'],
          ['random', 'Unpredictable (hardest)'],
        ],
      },
      {
        key: 'speed', label: 'Speed', type: 'range',
        min: 0.1, max: 1, step: 0.05, unit: 'Hz', default: 0.25,
        hint: 'Number of full back-and-forth cycles each second.',
      },
      {
        key: 'amplitude', label: 'Path size', type: 'select', default: 'medium',
        options: [['small', 'Small'], ['medium', 'Medium'], ['large', 'Large']],
      },
      {
        key: 'mode', label: 'Mode', type: 'select', default: 'eyes',
        options: [['eyes', 'Eyes only (head still)'], ['vorc', 'Head and eyes together']],
      },
      S.target, S.size, ...BACKGROUND_SETTINGS, S.duration(60),
    ],
    summarize: (s) => `${s.pattern} · ${s.speed} Hz · ${s.mode === 'eyes' ? 'eyes only' : 'head + eyes'} · ${backgroundSummary(s)}`,
    cue: (s) => (s.mode === 'eyes' ? 'Keep head still · follow with your eyes' : 'Move head and eyes together with the target'),
    create(s, api) {
      const bg = createBackdrop(s);
      let letter = randLetter();
      let lastSwap = 0;
      let lastCycle = 0;

      function position(t) {
        const a = 2 * Math.PI * s.speed * t;
        switch (s.pattern) {
          case 'vertical': return [0, Math.sin(a)];
          case 'diagonal': return [Math.sin(a), Math.sin(a)];
          case 'circle': return [Math.sin(a), -Math.cos(a)];
          case 'figure8': return [Math.sin(a), Math.sin(2 * a)];
          case 'random': return [
            0.62 * Math.sin(a) + 0.38 * Math.sin(1.73 * a + 1.1),
            0.6 * Math.sin(1.31 * a + 2.0) + 0.4 * Math.sin(0.67 * a + 0.4),
          ];
          default: return [Math.sin(a), 0];
        }
      }

      return {
        update(t) {
          const cycle = Math.floor(t * s.speed);
          if (cycle !== lastCycle) {
            lastCycle = cycle;
            api.setStat(`${cycle} cycles`);
          }
          if (s.target === 'letter' && t - lastSwap > 4) {
            letter = randLetter(letter);
            lastSwap = t;
          }
        },
        draw(ctx, w, h, t) {
          bg.draw(ctx, w, h, t);
          const r = Math.min(w, h) * SIZE[s.size];
          const lim = extent(w, h, r);
          const ax = Math.min(w * AMPLITUDE[s.amplitude], lim.x);
          const ay = Math.min(h * AMPLITUDE[s.amplitude], lim.y);
          const [px, py] = position(t);
          bg.target(ctx, w / 2 + px * ax, h / 2 + py * ay, r, s.target, letter);
        },
      };
    },
  };

  const convergence = {
    id: 'convergence',
    tag: 'Binocular vision',
    title: 'Convergence',
    short: 'Train both eyes to turn in together and focus on near objects.',
    lede: 'Convergence is the inward turn of both eyes when you look at something close. Weak convergence can cause eye strain, blur, double vision and dizziness during near work such as reading.',
    steps: [
      'Pencil push-ups: hold a pen with a small letter on it at arm’s length, level with your nose. On a phone, you can use the phone itself: hold it at arm’s length and focus on the letter.',
      '“Bring closer”: slowly move the target toward the bridge of your nose. Keep it single and clear.',
      'If the target doubles or blurs, stop there. “Hold”: try to make it single again and keep it single.',
      '“Move out”: slowly move the target back to arm’s length.',
      'Near–far jumps: hold your thumb about 15 cm (6 in) from your nose. On each cue, change your focus between your thumb (NEAR) and the letter on the screen (FAR). Make each one single and clear before the next cue.',
    ],
    tips: [
      'Do not force past double vision. Note the closest point where the target stays single, and check it again over the weeks.',
      'Your therapist may add a Brock string (a string with coloured beads) to this exercise.',
      'Turn on voice cues so that you do not need to look at the screen.',
    ],
    caution: 'Stop if you get a headache, eye pain, or double vision that stays after you stop. Tell your clinician.',
    settings: [
      {
        key: 'mode', label: 'Exercise', type: 'select', default: 'pushup',
        options: [['pushup', 'Pencil push-ups'], ['jump', 'Near–far jumps']],
      },
      { key: 'reps', label: 'Repetitions', type: 'range', min: 3, max: 30, step: 1, unit: 'reps', default: 10 },
      {
        key: 'inTime', label: 'Bring-in time', type: 'range', min: 2, max: 10, step: 1, unit: 's', default: 4,
        showIf: (s) => s.mode === 'pushup',
      },
      {
        key: 'holdTime', label: 'Hold time', type: 'range', min: 1, max: 10, step: 1, unit: 's', default: 3,
        showIf: (s) => s.mode === 'pushup',
      },
      {
        key: 'outTime', label: 'Move-out time', type: 'range', min: 2, max: 10, step: 1, unit: 's', default: 4,
        showIf: (s) => s.mode === 'pushup',
      },
      {
        key: 'jumpTime', label: 'Time at each distance', type: 'range', min: 1, max: 6, step: 0.5, unit: 's', default: 2,
        showIf: (s) => s.mode === 'jump',
      },
      { key: 'voice', label: 'Voice cues (“in”, “hold”, “out”)', type: 'toggle', default: true },
    ],
    summarize: (s) => (s.mode === 'pushup'
      ? `push-ups · ${s.reps} reps · ${s.inTime}/${s.holdTime}/${s.outTime}s`
      : `near–far · ${s.reps} reps · ${s.jumpTime}s`),
    cue: (s) => (s.mode === 'pushup' ? 'Follow the cues · keep the target single' : 'Switch focus on each cue'),
    create(s, api) {
      let letter = randLetter();
      let lastKey = -1;
      let state = { phase: 0, frac: 0, near: false };

      const phases = [
        { label: 'Bring closer', say: 'In' },
        { label: 'Hold — keep it single', say: 'Hold' },
        { label: 'Move back out', say: 'Out' },
        { label: 'Relax', say: '' },
      ];
      const durs = [s.inTime, s.holdTime, s.outTime, 1.5];
      const cycle = durs.reduce((a, b) => a + b, 0);

      function updatePushup(t) {
        const rep = Math.floor(t / cycle);
        if (rep >= s.reps) { api.finish(); return; }
        let within = t - rep * cycle;
        let i = 0;
        while (i < durs.length - 1 && within >= durs[i]) { within -= durs[i]; i++; }
        state = { phase: i, frac: within / durs[i] };
        const key = rep * 10 + i;
        if (key !== lastKey) {
          lastKey = key;
          if (i === 0) letter = randLetter(letter);
          if (i < 3) api.beep(i === 0 ? 880 : 660, 0.07);
          if (phases[i].say) api.speak(phases[i].say);
          api.setStat(`Rep ${rep + 1} of ${s.reps}`);
        }
      }

      function updateJump(t) {
        const step = Math.floor(t / s.jumpTime);
        if (step >= s.reps * 2) { api.finish(); return; }
        const near = step % 2 === 1;
        state = { near, frac: (t - step * s.jumpTime) / s.jumpTime };
        if (step !== lastKey) {
          lastKey = step;
          if (!near) letter = randLetter(letter);
          api.beep(near ? 660 : 880, 0.07);
          api.speak(near ? 'Near' : 'Far');
          api.setStat(`Rep ${Math.floor(step / 2) + 1} of ${s.reps}`);
        }
      }

      function drawProgress(ctx, w, y, frac) {
        const bw = Math.min(w * 0.5, 360);
        ctx.fillStyle = COLORS.faint;
        ctx.fillRect(w / 2 - bw / 2, y, bw, 6);
        ctx.fillStyle = COLORS.guide;
        ctx.fillRect(w / 2 - bw / 2, y, bw * frac, 6);
      }

      return {
        update(t) {
          if (s.mode === 'pushup') updatePushup(t); else updateJump(t);
        },
        draw(ctx, w, h) {
          drawBackground(ctx, w, h, 'plain');
          const m = Math.min(w, h);
          const cx = w / 2;
          const cy = h / 2 - m * 0.06;

          if (s.mode === 'pushup') {
            drawTarget(ctx, cx, cy, m * 0.045, 'letter', letter);
            const p = phases[state.phase];
            drawLabel(ctx, p.label, cx, cy + m * 0.16, Math.max(20, m * 0.045), COLORS.guide);

            // Distance guide: arm's length on the left, nose on the right.
            let pos;
            if (state.phase === 0) pos = ease(state.frac);
            else if (state.phase === 1) pos = 1;
            else if (state.phase === 2) pos = 1 - ease(state.frac);
            else pos = 0;
            const bw = Math.min(w * 0.6, 440);
            const by = cy + m * 0.27;
            const x0 = cx - bw / 2;
            ctx.save();
            ctx.strokeStyle = 'rgba(15, 118, 110, 0.28)';
            ctx.lineWidth = 6;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(x0, by);
            ctx.lineTo(x0 + bw, by);
            ctx.stroke();
            ctx.fillStyle = COLORS.accent;
            ctx.beginPath();
            ctx.arc(x0 + pos * bw, by, 12, 0, Math.PI * 2);
            ctx.fill();
            ctx.font = `600 13px ${FONT}`;
            ctx.fillStyle = COLORS.ink;
            ctx.textBaseline = 'top';
            ctx.textAlign = 'left';
            ctx.fillText('Arm’s length', x0 - 6, by + 18);
            ctx.textAlign = 'right';
            ctx.fillText('Nose', x0 + bw + 6, by + 18);
            ctx.restore();
            drawProgress(ctx, w, by + 52, state.frac);
          } else {
            if (state.near) {
              drawTarget(ctx, cx, cy, m * 0.06, 'letter', letter, 'rgba(28, 40, 48, 0.12)');
              drawLabel(ctx, 'NEAR', cx, cy + m * 0.16, Math.max(28, m * 0.07), COLORS.accent);
              drawLabel(ctx, 'Focus on your thumb', cx, cy + m * 0.24, Math.max(16, m * 0.03), COLORS.ink);
            } else {
              drawTarget(ctx, cx, cy, m * 0.06, 'letter', letter);
              drawLabel(ctx, 'FAR', cx, cy + m * 0.16, Math.max(28, m * 0.07), COLORS.guide);
              drawLabel(ctx, 'Focus on the letter', cx, cy + m * 0.24, Math.max(16, m * 0.03), COLORS.ink);
            }
            drawProgress(ctx, w, cy + m * 0.31, state.frac);
          }
        },
      };
    },
  };

  const okn = {
    id: 'okn',
    tag: 'Visual motion',
    title: 'Optokinetic training',
    short: 'Watch large moving patterns to reduce sensitivity to busy visual motion.',
    lede: 'Optokinetic stimulation uses large moving patterns. Over time it can help your brain become less sensitive to visual motion, such as supermarket aisles, traffic, crowds or scrolling screens. This is sometimes called habituation for visual vertigo.',
    steps: [
      'Sit in a chair with back support. Use full screen and sit close enough that the pattern fills most of what you see.',
      'Let your eyes follow the moving pattern naturally. If the fixation dot is on, keep your eyes on the red dot instead.',
      'Start with short sets (20–30 seconds) at a slow speed.',
      'Increase the duration, the speed, or the posture (for example, standing) only when your symptoms allow it.',
    ],
    tips: [
      'A small, short increase in symptoms is expected. Rest until they settle before the next set.',
      'Low contrast is gentler. Use it first if high contrast is too strong.',
      'Change the pattern and direction between sets. Stripes and checkerboards in each direction, roll and optic flow each give a different kind of visual motion.',
      'Optic flow (forward / back) is like walking along a corridor or a busy street. Roll rotation often causes the most symptoms, so start it slowly.',
      'Motion that reverses or moves back and forth is harder to get used to than steady motion. Use it after steady motion is comfortable.',
    ],
    caution: OKN_PHOTOSENSITIVITY,
    confirm: () => OKN_CONFIRM,
    settings: [
      ...oknSettings(''),
      { key: 'fixation', label: 'Show fixation dot', type: 'toggle', default: false },
      S.duration(30, 10, 180),
    ],
    summarize: (s) => oknSummary(oknConfig(s, '')),
    cue: (s) => (s.fixation ? 'Keep your eyes on the red dot' : 'Let your eyes follow the pattern'),
    create(s) {
      const bg = createOknBackground(oknConfig(s, ''));
      return {
        update() {},
        draw(ctx, w, h, t) {
          bg.draw(ctx, w, h, t);
          if (s.fixation) drawFixation(ctx, w, h);
        },
      };
    },
  };

  const saccadesOkn = {
    id: 'saccades-okn',
    tag: 'Visual motion',
    title: 'Saccades + optokinetic',
    short: 'Jump your eyes between targets while a pattern moves behind them.',
    lede: 'This combines saccades with an optokinetic background. You keep your gaze on still targets while the background moves, as you must do in busy places such as shops, stations or traffic. It trains your brain to rely less on visual motion.',
    steps: [
      'Sit in a chair with back support, about an arm’s length from the screen. Keep your head still.',
      'When the orange letter jumps, move your eyes to it quickly and read it. Do not let your eyes follow the moving background.',
      'Start with a slow, low-contrast background and a long time between jumps.',
      'Make it harder one step at a time: a faster background, high contrast, a shorter time between jumps, random targets, then standing if your clinician advises it.',
    ],
    tips: [
      'Do Saccades and Optokinetic training separately first, until both are comfortable.',
      'Try each background direction. If one direction is harder, it usually needs more practice.',
      'Rest between sets until your symptoms settle.',
    ],
    caution: OKN_PHOTOSENSITIVITY,
    confirm: () => OKN_CONFIRM,
    settings: [
      SACCADE_SETTINGS.pattern,
      SACCADE_SETTINGS.interval(2),
      SACCADE_SETTINGS.distance,
      S.size,
      ...oknSettings('bg', 'Background'),
      S.duration(45, 10, 180),
    ],
    summarize: (s) => `${s.pattern} every ${s.interval}s · ${oknSummary(oknConfig(s, 'bg'))}`,
    cue: () => 'Head still · jump eyes to the orange letter · ignore the background',
    create(s, api) {
      const bg = createOknBackground(oknConfig(s, 'bg'));
      const task = createSaccadeTask(s, api, 'card');
      return {
        update: (t) => task.update(t),
        draw(ctx, w, h, t) {
          bg.draw(ctx, w, h, t);
          task.draw(ctx, w, h);
        },
      };
    },
  };

  // Each stage overrides part of an optokinetic config.
  const CIRCUITS = {
    horizontal: [
      { pattern: 'stripes', direction: 'left' }, { pattern: 'stripes', direction: 'right' },
      { pattern: 'dots', direction: 'left' }, { pattern: 'dots', direction: 'right' },
    ],
    directions: [
      { pattern: 'stripes', direction: 'left' }, { pattern: 'stripes', direction: 'right' },
      { pattern: 'stripes', direction: 'up' }, { pattern: 'stripes', direction: 'down' },
      { pattern: 'stripes', direction: 'up-left' }, { pattern: 'stripes', direction: 'down-right' },
      { pattern: 'stripes', direction: 'up-right' }, { pattern: 'stripes', direction: 'down-left' },
    ],
    mixed: [
      { pattern: 'stripes', direction: 'left' }, { pattern: 'stripes', direction: 'right' },
      { pattern: 'checker', direction: 'up' }, { pattern: 'checker', direction: 'down' },
      { pattern: 'dots', direction: 'down-left' }, { pattern: 'dots', direction: 'up-right' },
      { pattern: 'flow', flow: 'forward' }, { pattern: 'flow', flow: 'backward' },
      { pattern: 'rotate', rotation: 'cw' }, { pattern: 'rotate', rotation: 'ccw' },
    ],
  };
  const CIRCUIT_LABEL = { horizontal: 'left / right', directions: 'all directions', mixed: 'mixed patterns' };

  function stageLabel(c) {
    const dir = c.pattern === 'rotate' ? (c.rotation === 'cw' ? 'clockwise' : 'counter-clockwise')
      : c.pattern === 'flow' ? c.flow : c.direction;
    const name = OKN_PATTERN_LABEL[c.pattern];
    return `${name[0].toUpperCase()}${name.slice(1)} · ${dir}`;
  }

  const oknCircuit = {
    id: 'okn-circuit',
    tag: 'Visual motion',
    title: 'Optokinetic circuit',
    short: 'Work through a sequence of moving patterns and directions, with rests in between.',
    lede: 'A guided circuit of optokinetic patterns. Each stage shows one pattern and direction, and a short rest follows. The circuit covers several kinds of visual motion in one session, so you do not have to change settings between sets.',
    steps: [
      'Sit in a chair with back support. Use full screen and sit close enough that the pattern fills most of what you see.',
      'During each stage, let your eyes follow the pattern naturally, or keep them on the red dot if the fixation dot is on.',
      'During the rests, look away from the screen or close your eyes and let any symptoms settle.',
      'If a stage causes more than mild symptoms, press Space to pause. Then stop, or rest longer before you continue.',
    ],
    tips: [
      'Start with the left / right circuit at a slow speed and low contrast.',
      'Use longer stages or the “mixed patterns” circuit only when the shorter circuits are comfortable.',
      'Note in the log which stages caused the most symptoms. They usually need the most practice, and the information is useful to your clinician.',
    ],
    caution: OKN_PHOTOSENSITIVITY,
    confirm: () => OKN_CONFIRM,
    settings: [
      {
        key: 'circuit', label: 'Circuit', type: 'select', default: 'horizontal',
        options: [
          ['horizontal', 'Left / right (4 stages, gentlest)'],
          ['directions', 'All directions (8 stages)'],
          ['mixed', 'Mixed patterns, incl. optic flow and roll (10 stages)'],
        ],
      },
      { key: 'stageTime', label: 'Time per stage', type: 'range', min: 10, max: 60, step: 5, unit: 's', default: 20 },
      { key: 'rest', label: 'Rest between stages', type: 'range', min: 0, max: 30, step: 5, unit: 's', default: 10 },
      { key: 'speed', label: 'Speed', type: 'range', min: 1, max: 10, step: 1, unit: '', default: 3 },
      {
        key: 'width', label: 'Stripe / dot size', type: 'select', default: 'medium',
        options: [['narrow', 'Small'], ['medium', 'Medium'], ['wide', 'Large']],
      },
      {
        key: 'contrast', label: 'Contrast', type: 'select', default: 'low',
        options: [['low', 'Low (gentler)'], ['high', 'High']],
      },
      { key: 'fixation', label: 'Show fixation dot', type: 'toggle', default: false },
    ],
    summarize: (s) => `${CIRCUIT_LABEL[s.circuit]} · ${CIRCUITS[s.circuit].length} × ${s.stageTime}s · speed ${s.speed} · ${s.contrast} contrast`,
    cue: (s) => (s.fixation ? 'Keep your eyes on the red dot' : 'Let your eyes follow the pattern'),
    create(s, api) {
      const stages = CIRCUITS[s.circuit].map((over) => ({
        direction: 'left', rotation: 'cw', flow: 'forward', motion: 'constant', period: 6,
        speed: s.speed, width: s.width, contrast: s.contrast, ...over,
      }));
      const backgrounds = stages.map(createOknBackground);
      const block = s.stageTime + s.rest;
      let state = { i: 0, within: 0, resting: false };
      let lastKey = '';

      return {
        update(t) {
          const i = Math.floor(t / block);
          const within = t - i * block;
          if (i >= stages.length || (i === stages.length - 1 && within >= s.stageTime)) {
            api.finish();
            return;
          }
          state = { i, within, resting: within >= s.stageTime };
          const key = `${i}${state.resting}`;
          if (key !== lastKey) {
            lastKey = key;
            api.beep(state.resting ? 520 : 880, 0.1);
            api.setStat(`Stage ${i + 1} of ${stages.length} · ${state.resting ? 'rest' : stageLabel(stages[i])}`);
          }
        },
        draw(ctx, w, h) {
          const m = Math.min(w, h);
          if (state.resting) {
            drawBackground(ctx, w, h, 'plain');
            drawLabel(ctx, 'Rest', w / 2, h / 2 - m * 0.08, Math.max(32, m * 0.08), COLORS.guide);
            drawLabel(ctx, `Look away or close your eyes · ${Math.ceil(block - state.within)} s`, w / 2, h / 2 + m * 0.02, Math.max(16, m * 0.03), COLORS.ink);
            drawLabel(ctx, `Next: ${stageLabel(stages[state.i + 1])}`, w / 2, h / 2 + m * 0.09, Math.max(14, m * 0.026), 'rgba(28, 40, 48, 0.6)');
            return;
          }
          backgrounds[state.i].draw(ctx, w, h, state.within);
          if (s.fixation) drawFixation(ctx, w, h);
        },
      };
    },
  };

  /* ---------- Card icons (inline SVG) ---------- */

  const ICONS = {
    vor1: '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="20" cy="20" r="5" fill="currentColor"/><path d="M7 13c-3 4-3 10 0 14M33 13c3 4 3 10 0 14"/></svg>',
    vor2: '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 14h16M18 10l4 4-4 4"/><path d="M34 26H18M22 22l-4 4 4 4"/></svg>',
    saccades: '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="9" cy="20" r="4" fill="currentColor"/><circle cx="31" cy="20" r="4"/><path d="M15 20h8" stroke-dasharray="2 3"/></svg>',
    pursuit: '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M5 20c5-10 10-10 15 0s10 10 15 0"/><circle cx="20" cy="20" r="3.5" fill="currentColor"/></svg>',
    convergence: '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="9" cy="30" r="3"/><circle cx="31" cy="30" r="3"/><path d="M10.5 27.5 20 9l9.5 18.5"/><circle cx="20" cy="9" r="2.5" fill="currentColor"/></svg>',
    okn: '<svg viewBox="0 0 40 40" fill="currentColor"><rect x="5" y="7" width="5" height="26" rx="1.5"/><rect x="15" y="7" width="5" height="26" rx="1.5" opacity=".7"/><rect x="25" y="7" width="5" height="26" rx="1.5" opacity=".45"/><path d="M33 20l4-3v6z"/></svg>',
    'saccades-okn': '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M7 6v28M15 6v28M23 6v28M31 6v28" opacity=".3"/><circle cx="10" cy="20" r="4.5" fill="currentColor" stroke="none"/><circle cx="30" cy="20" r="4.5" fill="#fff"/></svg>',
    'okn-circuit': '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M31 13a13 13 0 1 0 2 9"/><path d="M33 6v8h-8"/><path d="M15 14v12M20 14v12M25 14v12" opacity=".55"/></svg>',
  };

  const exercises = [vor1, vor2, saccades, pursuit, convergence, okn, saccadesOkn, oknCircuit];
  exercises.forEach((e) => { e.icon = ICONS[e.id]; });

  window.VRT = { exercises };
})();

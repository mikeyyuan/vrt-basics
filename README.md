# VRT Basics

A browser app for guided practice of basic vestibular rehabilitation therapy (VRT) exercises:

| Exercise | What it trains | Main settings |
|---|---|---|
| VOR ×1 | Gaze stabilization: still target, moving head | Axis, tempo (bpm), duration, target, size, background (plain, busy or moving optokinetic pattern), pacing guide |
| VOR ×2 | Gaze stabilization: target and head move in opposite directions | The same as VOR ×1, plus travel distance |
| Saccades | Fast, accurate eye jumps | Pattern (H/V/diagonal/random), interval, distance, eyes-only or eyes-then-head |
| Smooth pursuit | Steady eye tracking; VOR cancellation | Path (line/circle/figure-8/random), speed (Hz), size, mode, background (plain, busy or moving optokinetic pattern) |
| Convergence | Near focus and eye teaming | Pencil push-ups (in/hold/out timing) or near–far jumps, reps, voice cues |
| Optokinetic | Habituation to visual motion | Stripes, checkerboard, dot field, roll rotation or optic flow; 8 directions; steady, reversing or back-and-forth motion; speed, size, contrast, fixation dot |
| Saccades + optokinetic | Saccades with a moving background | Saccade pattern, interval and distance, plus all optokinetic background settings |
| Optokinetic circuit | A guided sequence of optokinetic patterns with rests | Circuit (left/right, all directions, mixed patterns), time per stage, rest, speed, size, contrast, fixation dot |

Other features: a 3-second countdown, audio beeps and optional spoken cues, full screen with a screen wake lock, pause with <kbd>Space</kbd> and stop with <kbd>Esc</kbd>, and automatic pause when the tab is hidden. Each exercise keeps its own settings. A symptom log records ratings before and after each session (0–10) and your notes, and you can export it as CSV.

## Run it

The app has no build step and no dependencies. Do one of these:

- Open `index.html` in a browser, or
- Serve the folder: `python -m http.server 8000`, then go to http://localhost:8000

To deploy, put the folder on any static host (GitHub Pages, Netlify and so on).

## Files

- `index.html`: the page shell, the exercise stage and the end-of-session dialog
- `css/styles.css`: the styles
- `js/exercises.js`: the exercise definitions, their settings and the canvas rendering
- `js/app.js`: routing, the settings UI, the session runner, sound and the log

To add an exercise, add an object to the `exercises` array in `js/exercises.js`. It needs `id`, `title`, `steps`, `settings` and `create(settings, api)`. The `create` function must return `{ update(t, dt), draw(ctx, w, h, t) }`.

## Privacy

All settings, symptom ratings and notes stay in the browser's `localStorage`. They are never sent anywhere.

## Usage analytics

The app can count page views and exercise start/finish events with [GoatCounter](https://www.goatcounter.com). GoatCounter uses no cookies and collects no personal data. To turn it on, set `GOATCOUNTER_CODE` at the top of the analytics section in `js/app.js` to your GoatCounter site code. Leave it empty to turn analytics off. GoatCounter does not count visits from `localhost`, so local testing does not affect your numbers.

## Disclaimer

This app is for education and practice only. It does not replace an assessment by a qualified clinician. Use the exercises and the doses that your vestibular therapist prescribes.

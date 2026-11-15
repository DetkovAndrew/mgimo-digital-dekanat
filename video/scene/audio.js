// Звук ролика: разбор трека (темп, доли, громкость по секундам, тональный центр) и сведение — музыка под таймлайн
// плюс синтезированные акценты (касание, «вжух», «дзынь», спад света, финал). Всё в OfflineAudioContext.

export const SR = 48000;

export async function decode(url) {
  const data = await (await fetch(url)).arrayBuffer();
  return new OfflineAudioContext(2, 1, SR).decodeAudioData(data);
}

function mono(buf) {
  const out = new Float32Array(buf.length);
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const ch = buf.getChannelData(c);
    for (let i = 0; i < ch.length; i++) out[i] += ch[i] / buf.numberOfChannels;
  }
  return out;
}

/** Темп и фаза долей по огибающей атак; громкость по секундам; самый сильный класс высоты (тоника, грубо). */
export function analyze(buf) {
  const x = mono(buf);
  const hop = 512;
  const n = Math.floor(x.length / hop);
  const energy = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let j = 0; j < hop; j++) s += x[i * hop + j] ** 2;
    energy[i] = Math.log1p(1000 * s / hop);
  }
  const flux = new Float32Array(n);
  for (let i = 1; i < n; i++) flux[i] = Math.max(0, energy[i] - energy[i - 1]);
  const hopSec = hop / SR;
  // Автокорреляция для 70–180 уд/мин, с мягким предпочтением 100–130 (типичный рекламный темп).
  let best = { score: -1, lag: 0 };
  for (let lag = Math.round(60 / 180 / hopSec); lag <= Math.round(60 / 70 / hopSec); lag++) {
    let s = 0;
    for (let i = lag; i < n; i++) s += flux[i] * flux[i - lag];
    const bpm = 60 / (lag * hopSec);
    s *= Math.exp(-(((Math.log2(bpm / 115)) / 0.6) ** 2));
    if (s > best.score) best = { score: s, lag };
  }
  // Уточнение периода и фаза: гребёнка, у которой сумма атак на долях максимальна.
  let phase = { score: -1, at: 0, period: best.lag };
  for (let p = best.lag - 1; p <= best.lag + 1; p += 0.05) {
    for (let f = 0; f < p; f += 0.5) {
      let s = 0;
      for (let k = f; k < n; k += p) s += flux[Math.round(k)] ?? 0;
      if (s > phase.score) phase = { score: s, at: f, period: p };
    }
  }
  const fine = [];
  for (let i = 0; i + SR / 10 <= x.length; i += SR / 10) {
    let e = 0;
    for (let j = i; j < i + SR / 10; j++) e += x[j] ** 2;
    fine.push(Math.round(100 * Math.log10(e / (SR / 10) + 1e-12)) / 10);
  }
  const rms = [];
  for (let s = 0; s + 1 <= buf.duration; s++) {
    let e = 0;
    for (let i = s * SR; i < (s + 1) * SR; i++) e += x[i] ** 2;
    rms.push(Math.round(10 * Math.log10(e / SR + 1e-12)));
  }
  // Тональный центр: энергия 12 классов высоты (Гёрцель по октавам 2–5) на всём треке, окна по 0.25 с.
  const chroma = new Array(12).fill(0);
  const win = SR / 4;
  for (let start = 0; start + win < x.length; start += win * 4) {
    for (let midi = 36; midi < 84; midi++) {
      const f = 440 * 2 ** ((midi - 69) / 12);
      const w = (2 * Math.PI * f) / SR;
      const coeff = 2 * Math.cos(w);
      let s1 = 0;
      let s2 = 0;
      for (let i = 0; i < win; i++) {
        const s0 = x[start + i] + coeff * s1 - s2;
        s2 = s1;
        s1 = s0;
      }
      chroma[midi % 12] += s1 * s1 + s2 * s2 - coeff * s1 * s2;
    }
  }
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const top = chroma.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]).slice(0, 4).map(([, i]) => names[i]);
  return {
    duration: Math.round(buf.duration * 100) / 100,
    bpm: Math.round((60 / (phase.period * hopSec)) * 10) / 10,
    firstBeat: Math.round(phase.at * hopSec * 1000) / 1000,
    beat: phase.period * hopSec,
    rmsDb: rms,
    rmsFine: fine,
    pitchClasses: top,
  };
}

const hz = (name, octave) => 440 * 2 ** (("C C# D D# E F F# G G# A A# B".split(" ").indexOf(name) + 12 * (octave + 1) - 69) / 12);

/**
 * Сведение под таймлайн ролика. plan: offset — время трека в момент 0 ролика (меньше нуля — музыка вступает позже),
 * root — тоника для «дзынь», endsNaturally — трек сам кончается к концу ролика (без нашего затухания),
 * T — моменты таймлайна (касание, вылет, посадка, одобрение, ночь, финал).
 */
export async function mixScore(music, plan, T, duration) {
  const ctx = new OfflineAudioContext(2, Math.ceil(duration * SR), SR);
  const out = ctx.createDynamicsCompressor(); // мягкий лимитер на выходе
  out.threshold.value = -4;
  out.knee.value = 3;
  out.ratio.value = 12;
  out.attack.value = 0.003;
  out.release.value = 0.15;
  out.connect(ctx.destination);

  // Музыка: громкость выравниваем по фрагменту, который звучит в ролике (около −18 dBFS).
  const from = Math.max(0, plan.offset);
  let e = 0;
  let cnt = 0;
  for (let c = 0; c < music.numberOfChannels; c++) {
    const ch = music.getChannelData(c);
    for (let i = Math.floor(from * SR); i < Math.min(ch.length, (from + duration) * SR); i += 4) {
      e += ch[i] * ch[i];
      cnt++;
    }
  }
  const rmsDb = 10 * Math.log10(e / cnt + 1e-12);
  const base = 10 ** (((plan.musicDb ?? -18) - rmsDb) / 20);
  const src = ctx.createBufferSource();
  src.buffer = music;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.Q.value = 0.5;
  const gain = ctx.createGain();
  // Музыка — фоном: можно убрать бас и верха, чтобы бочка и тарелки не тянули внимание на себя.
  const low = ctx.createBiquadFilter();
  low.type = "lowshelf";
  low.frequency.value = 140;
  low.gain.value = plan.lowShelfDb ?? 0;
  const high = ctx.createBiquadFilter();
  high.type = "highshelf";
  high.frequency.value = 5000;
  high.gain.value = plan.highShelfDb ?? 0;
  src.connect(low).connect(high).connect(lp).connect(gain).connect(out);
  const startAt = Math.max(0, -plan.offset);
  src.start(startAt, Math.max(0, plan.offset));
  const g = gain.gain;
  g.setValueAtTime(0, 0);
  g.linearRampToValueAtTime(base, startAt + (plan.fadeIn ?? (plan.offset > 0.5 ? 0.6 : 0.05)));
  // Одобрение: музыка на миг уступает «дзынь».
  g.setValueAtTime(base, T.approve - 0.05);
  g.linearRampToValueAtTime(base * 0.55, T.approve + 0.08);
  g.setValueAtTime(base * 0.55, T.approve + 0.5);
  g.linearRampToValueAtTime(base, T.approve + 1.1);
  if (!plan.endsNaturally) {
    g.setValueAtTime(base, duration - 2.6);
    g.linearRampToValueAtTime(0, duration - 0.05);
  } else {
    g.setValueAtTime(base, duration - 0.4);
    g.linearRampToValueAtTime(0, duration - 0.02);
  }
  // Ночь: звук «гаснет» вместе со светом — фильтр закрывается; на финальной карточке приоткрывается.
  const f = lp.frequency;
  f.setValueAtTime(18000, 0);
  f.setValueAtTime(18000, T.dim[0]);
  f.exponentialRampToValueAtTime(plan.nightCutoff ?? 900, T.dim[1]);
  f.setValueAtTime(plan.nightCutoff ?? 900, T.end);
  f.exponentialRampToValueAtTime(3500, T.end + 1.2);

  // Акценты — через общую шину: их громкость подстраивается под громкость музыки.
  const sfx = ctx.createGain();
  sfx.gain.value = 10 ** ((plan.sfxDb ?? 0) / 20);
  sfx.connect(out);
  const noise = ctx.createBuffer(1, SR * 2, SR);
  const nd = noise.getChannelData(0);
  let seed = 7;
  for (let i = 0; i < nd.length; i++) {
    seed = (seed * 16807) % 2147483647;
    nd[i] = (seed / 2147483647) * 2 - 1;
  }
  const db = (v) => 10 ** (v / 20);
  const env = (param, at, peak, attack, decay) => {
    param.setValueAtTime(0, at);
    param.linearRampToValueAtTime(peak, at + attack);
    param.exponentialRampToValueAtTime(0.0001, at + attack + decay);
  };
  const tone = (freq, at, peak, decay, type = "sine", glideTo) => {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, at);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, at + decay);
    const a = ctx.createGain();
    env(a.gain, at, peak, 0.004, decay);
    o.connect(a).connect(sfx);
    o.start(at);
    o.stop(at + decay + 0.05);
  };
  const hiss = (at, len, peak, f0, f1, q = 1.2, attack = 0.005) => {
    const s = ctx.createBufferSource();
    s.buffer = noise;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = q;
    bp.frequency.setValueAtTime(f0, at);
    bp.frequency.exponentialRampToValueAtTime(f1, at + len);
    const a = ctx.createGain();
    a.gain.setValueAtTime(0.0001, at);
    a.gain.exponentialRampToValueAtTime(peak, at + attack);
    a.gain.exponentialRampToValueAtTime(0.0001, at + len);
    s.connect(bp).connect(a).connect(sfx);
    s.start(at, 0, len + 0.05);
  };

  // Касание «Отправить»: короткий мягкий щелчок.
  tone(1500, T.tap, db(-24), 0.035);
  hiss(T.tap, 0.03, db(-26), 4000, 2500, 2);
  // Карточка улетает в камеру: нарастающий «вжух» и мягкий удар во вспышке.
  const w = ctx.createBufferSource();
  w.buffer = noise;
  const wbp = ctx.createBiquadFilter();
  wbp.type = "bandpass";
  wbp.Q.value = 0.9;
  wbp.frequency.setValueAtTime(350, T.lift);
  wbp.frequency.exponentialRampToValueAtTime(3200, T.cut);
  wbp.frequency.exponentialRampToValueAtTime(600, T.cut + 0.5);
  const wg = ctx.createGain();
  wg.gain.setValueAtTime(0.0001, T.lift);
  wg.gain.exponentialRampToValueAtTime(db(-14), T.cut - 0.02);
  wg.gain.exponentialRampToValueAtTime(0.0001, T.cut + 0.55);
  w.connect(wbp).connect(wg).connect(sfx);
  w.start(T.lift, 0.3, T.cut - T.lift + 0.6);
  tone(90, T.cut, db(-14), 0.35, "sine", 45);
  // Посадка на экран ноутбука: тихий «тук».
  tone(320, T.land, db(-20), 0.09, "sine", 180);
  hiss(T.land, 0.05, db(-28), 2500, 1500, 1.5);
  // Одобрено: «дзынь» из двух нот (тоника и квинта трека).
  const [r1, r2] = [hz(plan.root, 5), hz(plan.root, 5) * 1.5];
  for (const [fq, at] of [[r1, T.approve], [r2, T.approve + 0.09]]) {
    tone(fq, at, db(-15), 0.9);
    tone(fq * 2, at, db(-27), 0.45);
  }
  // Свет гаснет: низкий спад.
  tone(170, T.dim[0], db(-17), 1.0, "sine", 48);
  hiss(T.dim[0], 0.9, db(-30), 1200, 200, 0.8, 0.2);
  // Финальная карточка: мягкий низкий удар и воздух.
  tone(70, T.end, db(-16), 0.9, "sine", 40);
  hiss(T.end, 1.4, db(-32), 6000, 9000, 0.7, 0.4);

  return ctx.startRendering();
}

export function toWav(buf) {
  const n = buf.length;
  const ch = buf.numberOfChannels;
  const data = new DataView(new ArrayBuffer(44 + n * ch * 2));
  const str = (o, s) => [...s].forEach((c, i) => data.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF");
  data.setUint32(4, 36 + n * ch * 2, true);
  str(8, "WAVEfmt ");
  data.setUint32(16, 16, true);
  data.setUint16(20, 1, true);
  data.setUint16(22, ch, true);
  data.setUint32(24, SR, true);
  data.setUint32(28, SR * ch * 2, true);
  data.setUint16(32, ch * 2, true);
  data.setUint16(34, 16, true);
  str(36, "data");
  data.setUint32(40, n * ch * 2, true);
  const chans = [...Array(ch)].map((_, c) => buf.getChannelData(c));
  let o = 44;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < ch; c++) {
      data.setInt16(o, Math.max(-1, Math.min(1, chans[c][i])) * 32767, true);
      o += 2;
    }
  }
  return new Uint8Array(data.buffer);
}

/** Opus-фрагменты для MP4 (AAC в этой сборке Chromium не кодируется). */
export async function encodeOpus(buf) {
  const chunks = [];
  let failure = null;
  const enc = new AudioEncoder({ output: (chunk, meta) => chunks.push({ chunk, meta }), error: (e) => (failure = e) });
  enc.configure({ codec: "opus", sampleRate: SR, numberOfChannels: 2, bitrate: 192000 });
  const block = 4800;
  const l = buf.getChannelData(0);
  const r = buf.numberOfChannels > 1 ? buf.getChannelData(1) : l;
  for (let i = 0; i < buf.length; i += block) {
    const len = Math.min(block, buf.length - i);
    const planar = new Float32Array(len * 2);
    planar.set(l.subarray(i, i + len), 0);
    planar.set(r.subarray(i, i + len), len);
    const ad = new AudioData({ format: "f32-planar", sampleRate: SR, numberOfFrames: len, numberOfChannels: 2, timestamp: Math.round((i / SR) * 1e6), data: planar });
    enc.encode(ad);
    ad.close();
  }
  await enc.flush();
  if (failure) throw failure;
  return chunks;
}

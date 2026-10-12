/* Heider & Simmel 風アニメーション 3本と、共通の再生エンジン
 * 座標系は 1600 x 900。各アクターはキーフレーム [時刻(秒), x, y] をスプライン補間して動く。
 * 向き（三角・四角）は移動方向から自動で決まる。
 */
(function () {
  'use strict';
  var W = 1600, H = 900;
  var STAGE = '#121614', INK = '#ecebe4';

  /* ---------- 補助関数 ---------- */
  function orbit(cx, cy, r, a0, turns, t0, t1, step) {
    var out = [], n = Math.max(2, Math.round((t1 - t0) / step));
    for (var i = 0; i <= n; i++) {
      var s = i / n, a = a0 + turns * 2 * Math.PI * s;
      out.push([t0 + (t1 - t0) * s, cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
    return out;
  }

  function makeTrack(kfIn) {
    var sorted = kfIn.slice().sort(function (a, b) { return a[0] - b[0]; });
    var kf = [];
    sorted.forEach(function (k) {
      if (!kf.length || k[0] > kf[kf.length - 1][0] + 1e-6) kf.push(k);
    });
    var n = kf.length, m = [];
    function same(p, q) { return Math.abs(p[1] - q[1]) < 0.5 && Math.abs(p[2] - q[2]) < 0.5; }
    for (var i = 0; i < n; i++) {
      if (i === 0 || i === n - 1 || same(kf[i], kf[i - 1]) || same(kf[i], kf[i + 1])) { m.push([0, 0]); continue; }
      var dt = kf[i + 1][0] - kf[i - 1][0];
      m.push([(kf[i + 1][1] - kf[i - 1][1]) / dt, (kf[i + 1][2] - kf[i - 1][2]) / dt]);
    }
    return function (t) {
      if (t <= kf[0][0]) return [kf[0][1], kf[0][2]];
      if (t >= kf[n - 1][0]) return [kf[n - 1][1], kf[n - 1][2]];
      var lo = 0, hi = n - 1;
      while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (kf[mid][0] <= t) lo = mid; else hi = mid; }
      var p0 = kf[lo], p1 = kf[hi], h = p1[0] - p0[0], s = (t - p0[0]) / h;
      var s2 = s * s, s3 = s2 * s;
      var h00 = 2 * s3 - 3 * s2 + 1, h10 = s3 - 2 * s2 + s, h01 = -2 * s3 + 3 * s2, h11 = s3 - s2;
      return [h00 * p0[1] + h10 * h * m[lo][0] + h01 * p1[1] + h11 * h * m[hi][0],
              h00 * p0[2] + h10 * h * m[lo][1] + h01 * p1[2] + h11 * h * m[hi][1]];
    };
  }

  /* ---------- 坂（動画B）用の地面 ---------- */
  var GROUND = [[-1000, 780], [480, 780], [1060, 340], [3000, 340]];
  function restY(x, r) {
    var best = Infinity, i;
    for (i = 0; i < GROUND.length - 1; i++) {
      var ax = GROUND[i][0], ay = GROUND[i][1], bx = GROUND[i + 1][0], by = GROUND[i + 1][1];
      var L = Math.hypot(bx - ax, by - ay), dx = (bx - ax) / L, dy = (by - ay) / L;
      var nx = dy, ny = -dx;
      var ox = ax + nx * r, oy = ay + ny * r, ex = bx + nx * r, ey = by + ny * r;
      if (x >= ox && x <= ex) best = Math.min(best, oy + (ey - oy) * (x - ox) / (ex - ox));
    }
    GROUND.forEach(function (v) {
      var d = x - v[0];
      if (Math.abs(d) <= r) best = Math.min(best, v[1] - Math.sqrt(r * r - d * d));
    });
    return best;
  }
  function ease(s) { return s * s * (3 - 2 * s); }
  // 坂の上を xa から xb へ移動（t0→t1）。r は図形の半径
  function hill(t0, t1, xa, xb, r, linear) {
    var out = [], n = Math.max(2, Math.round((t1 - t0) / 0.15));
    for (var i = 0; i <= n; i++) {
      var s = i / n, e = linear ? s : ease(s), x = xa + (xb - xa) * e;
      out.push([t0 + (t1 - t0) * s, x, restY(x, r)]);
    }
    return out;
  }
  function at(t, x, r, lift) { return [t, x, restY(x, r) - (lift || 0)]; }

  /* ---------- 静止物の描画 ---------- */
  function drawRing(ctx) {
    ctx.beginPath();
    ctx.arc(1150, 450, 150, Math.PI + 0.38, 3 * Math.PI - 0.38);
    ctx.stroke();
  }
  function drawHill(ctx) {
    ctx.beginPath();
    ctx.moveTo(0, 780); ctx.lineTo(480, 780); ctx.lineTo(1060, 340); ctx.lineTo(1600, 340);
    ctx.stroke();
  }

  /* ---------- シナリオ ---------- */
  var SCENES = {};

  // 動画A「輪」：輪の中の円、やってくる四角、侵入する三角
  SCENES.A = {
    id: 'A', name: '輪', duration: 74,
    note: '輪の中にいた円のもとに四角が来て、二者は一緒に輪に入る。三角が現れて口をふさぎ、中に押し入る。円と四角は抜け出して逃げ、三角は追うが見失って輪に戻る。',
    statics: drawRing,
    actors: [
      { id: 'tri', shape: 'triangle', h0: Math.PI / 2, kf: [
        [0, 700, -100], [37, 700, -100], [39, 700, 120], [41, 700, 120], [44, 860, 450], [46.5, 975, 450], [47.6, 975, 450], [47.7, 962, 450], [48.1, 975, 450], [50, 975, 450],
        [51, 1030, 450], [53.5, 1110, 450], [55, 1110, 450], [56.2, 1040, 450], [57.2, 970, 450], [59.5, 760, 455],
        [60.5, 660, 420], [61.2, 650, 490], [61.9, 660, 420], [62.6, 650, 490], [63.5, 640, 455], [64.5, 640, 455],
        [66, 800, 455], [68, 980, 450], [70, 1150, 450], [74, 1150, 450]
      ] },
      { id: 'sq', shape: 'square', h0: 0, kf: [
        [0, -60, 520], [14, -60, 520], [16, 250, 520], [18.5, 250, 520], [19.5, 190, 540], [20.5, 190, 540], [22, 360, 500]
      ].concat(orbit(395, 485, 38, 2.736, 1.5, 22.5, 28, 0.5), [
        [31.3, 880, 480], [32.5, 970, 470], [33, 985, 455], [33.4, 965, 470], [33.8, 985, 455], [34.2, 970, 465],
        [35, 1040, 450], [36.5, 1150, 490], [40, 1190, 470], [43, 1150, 500]
      ], orbit(1150, 450, 60, Math.PI / 2, 2, 46, 52, 0.25), [
        [53, 1080, 520], [54.3, 1030, 490], [55.2, 990, 470], [56.3, 870, 510], [58, 650, 510],
        [61.3, 380, 740], [63.8, 380, 740], [66.5, 180, 500]
      ], orbit(180, 460, 40, Math.PI / 2, 1, 67, 70, 0.4).slice(1), [
        [72, -60, 480], [74, -60, 480]
      ]) },
      { id: 'cir', shape: 'circle', r: 20, kf: [
        [0, 1180, 450], [3, 1200, 440], [5.5, 1180, 455], [8, 1150, 450], [9.5, 1010, 450], [11, 850, 400], [12.5, 700, 330], [13.8, 620, 380], [15, 560, 430], [17.5, 560, 430],
        [19.5, 430, 470], [22, 432, 472]
      ].concat(orbit(395, 485, 38, -0.405, 1.5, 22.5, 28, 0.5), [
        [31, 900, 440], [32.5, 1020, 450], [34, 1150, 430], [36.5, 1170, 420], [40, 1190, 440], [44, 1170, 430],
        [47, 1060, 450], [47.6, 1035, 450], [48, 1045, 450], [49, 1150, 450], [51.5, 1150, 450],
        [52.5, 1100, 370], [54, 1050, 395], [54.8, 1000, 420], [56, 880, 380], [58, 650, 400],
        [61, 380, 170], [63.5, 380, 170], [66.5, 180, 420]
      ], orbit(180, 460, 40, -Math.PI / 2, 1, 67, 70, 0.4).slice(1), [
        [71.5, -60, 430], [74, -60, 430]
      ]) }
    ]
  };

  // 動画B「坂」：登ろうとする円、押し上げる四角、押し戻す三角
  var CR = 22, SR = 20, TR = 28;
  SCENES.B = {
    id: 'B', name: '坂', duration: 64,
    note: '坂を登ろうとして何度も滑り落ちる円。四角が下から押し上げると円は頂上で跳ねる。もう一度登ろうとした円を、三角が上から押し戻す。最後に円は下で待っていた四角のそばへ行く。',
    statics: drawHill,
    actors: [
      { id: 'cir', shape: 'circle', r: CR, kf: [].concat(
        [at(0, 300, CR), at(3, 300, CR)],
        hill(3, 8, 300, 640, CR),
        hill(8, 9.6, 640, 520, CR),
        [at(11, 520, CR)],
        hill(11, 16, 520, 760, CR),
        hill(16, 16.6, 760, 740, CR),
        hill(16.6, 17.2, 740, 765, CR),
        hill(17.2, 19, 765, 540, CR),
        [at(22.6, 540, CR)],
        hill(22.6, 28, 540, 1110, CR, true),
        hill(28, 29, 1110, 1240, CR),
        [at(29.4, 1240, CR, 38), at(29.8, 1240, CR), at(30.2, 1240, CR, 38), at(30.6, 1240, CR), at(34, 1240, CR)],
        hill(34, 39.5, 1240, 540, CR),
        [at(41, 540, CR)],
        hill(41, 46, 540, 760, CR),
        [at(46.3, 760, CR)],
        hill(46.3, 49, 760, 482, CR, true),
        hill(49, 50.5, 482, 380, CR),
        [at(54, 380, CR)],
        hill(54, 57, 380, 212, CR),
        [at(64, 212, CR)]
      ) },
      { id: 'sq', shape: 'square', h0: 0, kf: [].concat(
        [at(0, -80, SR), at(19, -80, SR)],
        hill(19, 22.4, -80, 504, SR),
        [at(22.6, 504, SR)],
        hill(22.6, 28, 504, 1074, SR, true),
        [at(31, 1074, SR)],
        hill(31, 35, 1074, 470, SR),
        hill(35, 37.5, 470, -80, SR),
        [at(51, -80, SR)],
        hill(51, 54, -80, 160, SR),
        [at(64, 160, SR)]
      ) },
      { id: 'tri', shape: 'triangle', h0: Math.PI, kf: [].concat(
        [at(0, 1700, TR), at(40, 1700, TR)],
        hill(40, 44.5, 1700, 1150, TR),
        hill(44.5, 46.1, 1150, 813, TR),
        [at(46.3, 813, TR)],
        hill(46.3, 49, 813, 535, TR, true),
        [at(50, 535, TR)],
        hill(50, 53.5, 535, 1250, TR),
        [at(64, 1250, TR)]
      ) }
    ]
  };

  // 動画C「広場」：特定のモチーフを持たない、模倣・接近・ためらい・追従
  SCENES.C = {
    id: 'C', name: '広場', duration: 64,
    note: '特定の筋書きを持たせていない。三角と四角の模倣、接近と後退、小さな円の割り込みと周回、三角の離脱とためらいながらの帰還、並んでの移動、円の追従と退場、という手がかりだけを並べている。',
    statics: null,
    actors: [
      { id: 'tri', shape: 'triangle', h0: 0, kf: [
        [0, 600, 500], [2, 620, 480], [4, 680, 470], [6, 700, 470], [12.2, 700, 470], [13.7, 700, 370], [15.7, 700, 370], [17.2, 760, 490],
        [20.7, 760, 490], [21.5, 720, 495], [24.6, 720, 495], [25.6, 640, 520], [27, 640, 520], [31, 260, 560], [39, 260, 560],
        [41, 420, 540], [41.8, 370, 545], [43, 520, 520], [43.6, 480, 525], [45, 640, 500], [45.5, 640, 500],
        [50, 1000, 260], [52, 1000, 260], [53.5, 975, 300], [64, 975, 300]
      ] },
      { id: 'sq', shape: 'square', h0: Math.PI, kf: [
        [0, 1700, 450], [6, 1700, 450], [9, 1100, 450], [11, 1100, 450], [12.5, 1100, 350], [14, 1100, 350], [15.5, 1160, 470], [18, 1160, 470],
        [20.5, 860, 480], [24.6, 860, 480], [25.6, 960, 460], [41, 960, 460], [45.2, 690, 575], [45.7, 690, 575], [50.2, 1050, 335], [64, 1050, 335]
      ] },
      { id: 'dot', shape: 'circle', r: 12, kf: [
        [0, 800, -60], [23, 800, -60], [24.5, 790, 480], [25, 790, 520], [27, 890, 470]
      ].concat(orbit(960, 460, 70, Math.PI, 1.5, 27.2, 35, 0.35), [
        [46.5, 1030, 460], [49, 900, 420], [55, 900, 420], [61, 960, 960], [64, 960, 960]
      ]) }
    ]
  };

  /* ---------- 準備：トラックと向き ---------- */
  function wrap(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; }
  Object.keys(SCENES).forEach(function (k) {
    var sc = SCENES[k], DT = 0.05;
    sc.actors.forEach(function (ac) {
      ac.track = makeTrack(ac.kf);
      var N = Math.ceil(sc.duration / DT) + 1, hs = new Float32Array(N), h = ac.h0 || 0;
      for (var i = 0; i < N; i++) {
        var t = i * DT, a = ac.track(t - DT), b = ac.track(t + DT);
        var vx = (b[0] - a[0]) / (2 * DT), vy = (b[1] - a[1]) / (2 * DT);
        if (Math.hypot(vx, vy) > 15) h = h + wrap(Math.atan2(vy, vx) - h) * 0.35;
        hs[i] = h;
      }
      ac.heading = function (t) { return hs[Math.max(0, Math.min(N - 1, Math.round(t / DT)))]; };
    });
  });

  function drawScene(ctx, sc, t) {
    ctx.fillStyle = STAGE; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    if (sc.statics) sc.statics(ctx);
    sc.actors.forEach(function (ac) {
      var p = ac.track(t);
      ctx.save(); ctx.translate(p[0], p[1]);
      ctx.beginPath();
      if (ac.shape === 'circle') {
        ctx.arc(0, 0, ac.r, 0, Math.PI * 2);
      } else if (ac.shape === 'square') {
        ctx.rotate(ac.heading(t)); ctx.rect(-20, -20, 40, 40);
      } else {
        ctx.rotate(ac.heading(t)); ctx.moveTo(44, 0); ctx.lineTo(-30, 30); ctx.lineTo(-30, -30); ctx.closePath();
      }
      ctx.fillStyle = STAGE; ctx.fill(); ctx.stroke();
      ctx.restore();
    });
  }

  /* ---------- プレイヤー ---------- */
  function createPlayer(canvas, scene, opts) {
    opts = opts || {};
    var ctx = canvas.getContext('2d');
    var p = { t: 0, playing: false, scene: scene, speed: 1 };
    var last = 0, raf = 0;
    function fit() {
      var dpr = Math.min(2, window.devicePixelRatio || 1);
      var w = canvas.clientWidth || 800;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(w * 9 / 16 * dpr);
      draw();
    }
    function draw() {
      var s = canvas.width / W;
      ctx.setTransform(s, 0, 0, s, 0, 0);
      drawScene(ctx, p.scene, p.t);
    }
    function tick(now) {
      if (!p.playing) return;
      var dt = Math.min(0.1, (now - last) / 1000); last = now;
      p.t += dt * p.speed;
      if (opts.onAdvance) opts.onAdvance(dt);
      if (p.t >= p.scene.duration) {
        p.t = p.scene.duration; p.playing = false; draw();
        if (opts.onTime) opts.onTime(p);
        if (opts.onEnd) opts.onEnd(p);
        if (opts.onState) opts.onState(p);
        return;
      }
      draw();
      if (opts.onTime) opts.onTime(p);
      raf = requestAnimationFrame(tick);
    }
    p.play = function () {
      if (p.playing) return;
      if (p.t >= p.scene.duration - 0.01) p.t = 0;
      if (p.t === 0 && opts.onStartFromZero) opts.onStartFromZero(p);
      p.playing = true; last = performance.now();
      if (opts.onState) opts.onState(p);
      raf = requestAnimationFrame(tick);
    };
    p.pause = function () { p.playing = false; cancelAnimationFrame(raf); if (opts.onState) opts.onState(p); };
    p.toggle = function () { p.playing ? p.pause() : p.play(); };
    p.seek = function (t) { p.t = Math.max(0, Math.min(p.scene.duration, t)); draw(); if (opts.onTime) opts.onTime(p); };
    p.restart = function () { p.pause(); p.t = 0; draw(); if (opts.onTime) opts.onTime(p); p.play(); };
    p.setScene = function (sc) { p.pause(); p.scene = sc; p.t = 0; draw(); if (opts.onTime) opts.onTime(p); };
    p.fit = fit;
    if (window.ResizeObserver) new ResizeObserver(fit).observe(canvas); else window.addEventListener('resize', fit);
    fit();
    return p;
  }

  function fmt(s) { var m = Math.floor(s / 60), r = Math.floor(s % 60); return m + ':' + (r < 10 ? '0' : '') + r; }

  window.HS = { SCENES: SCENES, createPlayer: createPlayer, fmt: fmt };
})();

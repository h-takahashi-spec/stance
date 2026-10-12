/* GAS ウェブアプリとの通信 */
window.API = (function () {
  'use strict';
  var C = window.APP_CONFIG || {};
  var url = String(C.GAS_URL || '').trim();
  var demo = !url;

  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  async function post(payload) {
    if (demo) { await wait(300); return { ok: true, demo: true }; }
    var res;
    try {
      // text/plain にすると CORS のプリフライトが発生せず、GAS で受け取れる
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
        redirect: 'follow'
      });
    } catch (e) {
      throw new Error('サーバーに接続できませんでした。通信状況を確認して、もう一度押してください。');
    }
    var j;
    try { j = await res.json(); } catch (e) {
      throw new Error('サーバーの応答を読み取れませんでした。もう一度押してください。');
    }
    if (!j.ok) throw new Error(j.error || '処理に失敗しました。');
    return j;
  }

  function jsonp(params) {
    return new Promise(function (resolve, reject) {
      var cb = '__hs_cb' + Date.now() + Math.floor(Math.random() * 1e5);
      var s = document.createElement('script');
      var q = new URLSearchParams(Object.assign({}, params, { callback: cb }));
      var timer = setTimeout(function () { cleanup(); reject(new Error('timeout')); }, 15000);
      function cleanup() { clearTimeout(timer); try { delete window[cb]; } catch (e) { window[cb] = undefined; } s.remove(); }
      window[cb] = function (d) { cleanup(); resolve(d); };
      s.onerror = function () { cleanup(); reject(new Error('load error')); };
      s.src = url + '?' + q.toString();
      document.head.appendChild(s);
    });
  }

  async function get(params) {
    var q = new URLSearchParams(params);
    try {
      var r = await fetch(url + '?' + q.toString());
      return await r.json();
    } catch (e) {
      return await jsonp(params);
    }
  }

  return { post: post, get: get, demo: demo, url: url };
})();

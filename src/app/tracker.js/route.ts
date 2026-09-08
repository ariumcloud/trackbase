import { NextResponse } from "next/server";

export function GET() {
  const script = `(function() {
  try {
    var scriptTag = document.currentScript || document.querySelector('script[data-key]');
    var key = scriptTag ? scriptTag.getAttribute('data-key') : (window.__TRACKBASE_KEY__ || window.__UTMLISO_KEY__ || '');
    if (!key) return;

    var STORAGE_KEY = 'trackbase_attr';
    var SESSION_KEY = 'trackbase_sid';

    function getCookie(name) {
      var match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
      return match ? decodeURIComponent(match[1]).slice(0, 300) : null;
    }

    function getSession() {
      var s = '';
      try { s = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY) || ''; } catch(e) {}
      if (!s || s.length < 5) {
        s = 's_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
        try {
          sessionStorage.setItem(SESSION_KEY, s);
          localStorage.setItem(SESSION_KEY, s);
        } catch(e) {}
      }
      return s;
    }

    function getAttribution() {
      var params = new URLSearchParams(window.location.search);
      var current = {};
      try {
        var raw = localStorage.getItem(STORAGE_KEY);
        if (raw) current = JSON.parse(raw) || {};
      } catch(e) {}

      var fields = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid'];
      var fresh = false;
      for (var i = 0; i < fields.length; i++) {
        var f = fields[i];
        var val = params.get(f);
        if (val) {
          current[f] = val.slice(0, 300);
          fresh = true;
        }
      }

      var fbp = getCookie('_fbp');
      var fbc = getCookie('_fbc');
      if (fbp) current.fbp = fbp;
      if (fbc) current.fbc = fbc;

      if (fresh || fbp || fbc) {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(current)); } catch(e) {}
      }
      return current;
    }

    var sessionId = getSession();
    var attr = getAttribution();
    var endpoint = (scriptTag && scriptTag.src) ? new URL('/api/track', scriptTag.src).href : '/api/track';

    function sendEvent(type, extraUrl, extraMeta) {
      try {
        var eventId = 'ev_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 11);
        
        // Dispara o Pixel nativo no browser com o exato mesmo eventID para deduplicação da Meta
        if (window.fbq && typeof window.fbq === 'function') {
          try {
            if (type === 'pageview') {
              window.fbq('track', 'PageView', {}, { eventID: eventId });
            } else if (type === 'checkout') {
              window.fbq('track', 'InitiateCheckout', {}, { eventID: eventId });
            } else if (type === 'cta') {
              window.fbq('track', 'ViewContent', {}, { eventID: eventId });
            } else if (type.indexOf('scroll_') === 0) {
              var d = parseInt(type.split('_')[1], 10);
              window.fbq('trackCustom', 'ScrollDepth_' + d, { depth: d }, { eventID: eventId });
            } else if (type === 'cta_view') {
              window.fbq('trackCustom', 'ViewCTA', {}, { eventID: eventId });
            }
          } catch(err) {}
        }

        var eventAttr = {};
        for (var k in attr) {
          if (attr.hasOwnProperty(k)) eventAttr[k] = attr[k];
        }
        if (extraMeta) {
          for (var mk in extraMeta) {
            if (extraMeta.hasOwnProperty(mk)) eventAttr[mk] = extraMeta[mk];
          }
        }

        var payload = JSON.stringify({
          key: key,
          event_type: type,
          event_id: eventId,
          session_id: sessionId,
          url: extraUrl || window.location.href,
          attribution: eventAttr
        });

        if (navigator.sendBeacon) {
          navigator.sendBeacon(endpoint, new Blob([payload], { type: 'application/json' }));
        } else {
          fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload,
            keepalive: true
          });
        }
      } catch(e) {}
    }

    // Dispara pageview inicial
    sendEvent('pageview');

    // 1. Monitoramento Inteligente de Scroll Depth (25%, 50%, 75%, 90%)
    var scrollMilestones = { 25: false, 50: false, 75: false, 90: false };
    var isTicking = false;

    function checkScrollDepth() {
      try {
        var doc = document.documentElement;
        var body = document.body;
        var winH = window.innerHeight || (doc ? doc.clientHeight : 0) || 0;
        var docH = Math.max(
          (body ? body.scrollHeight : 0) || 0,
          (doc ? doc.scrollHeight : 0) || 0,
          (body ? body.offsetHeight : 0) || 0,
          (doc ? doc.offsetHeight : 0) || 0,
          (body ? body.clientHeight : 0) || 0,
          (doc ? doc.clientHeight : 0) || 0
        );
        var scrollPos = (window.pageYOffset || (doc ? doc.scrollTop : 0) || (body ? body.scrollTop : 0) || 0) + winH;
        if (docH <= 0) return;

        var pct = Math.floor((scrollPos / docH) * 100);
        var thresholds = [25, 50, 75, 90];
        for (var i = 0; i < thresholds.length; i++) {
          var m = thresholds[i];
          if (pct >= m && !scrollMilestones[m]) {
            scrollMilestones[m] = true;
            sendEvent('scroll_' + m, null, { scroll_depth: String(m) });
          }
        }
      } catch(err) {}
    }

    window.addEventListener('scroll', function() {
      if (!isTicking) {
        if (window.requestAnimationFrame) {
          window.requestAnimationFrame(function() {
            checkScrollDepth();
            isTicking = false;
          });
        } else {
          setTimeout(function() {
            checkScrollDepth();
            isTicking = false;
          }, 150);
        }
        isTicking = true;
      }
    }, { passive: true });

    // 2. CTA View Observer (detecta quando o botão de checkout entra no campo de visão do lead)
    var ctaSeen = false;
    function initCtaObserver() {
      try {
        if (typeof IntersectionObserver !== 'function') return;
        var ctaEl = document.querySelector('a[href*="hotmart"], a[href*="kiwify"], a[href*="cakto"], a[href*="kirvano"], button[data-checkout], .btn-comprar, .cta-button');
        if (!ctaEl) return;

        var obs = new IntersectionObserver(function(entries) {
          for (var i = 0; i < entries.length; i++) {
            if (entries[i].isIntersecting && !ctaSeen) {
              ctaSeen = true;
              sendEvent('cta_view', null, { cta_visible: 'true' });
              obs.disconnect();
              break;
            }
          }
        }, { threshold: 0.25 });
        obs.observe(ctaEl);
      } catch(e) {}
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      setTimeout(initCtaObserver, 600);
    } else {
      window.addEventListener('DOMContentLoaded', function() {
        setTimeout(initCtaObserver, 600);
      });
    }

    function isAllowed(urlStr) {
      if (!urlStr || urlStr.indexOf('#') === 0 || /^(mailto|tel|javascript):/i.test(urlStr)) return false;
      try {
        var u = new URL(urlStr, window.location.href);
        if (u.origin === window.location.origin) return true;
        var h = u.hostname.toLowerCase();
        var isHotmart = h === 'hotmart.com' || h.endsWith('.hotmart.com');
        var isCakto = h === 'cakto.com' || h.endsWith('.cakto.com') || h === 'cakto.com.br' || h.endsWith('.cakto.com.br');
        return isHotmart || isCakto;
      } catch(e) { return false; }
    }

    function decorate(urlStr) {
      if (!isAllowed(urlStr)) return urlStr;
      try {
        var u = new URL(urlStr, window.location.href);
        var h = u.hostname.toLowerCase();
        var isHotmart = h === 'hotmart.com' || h.endsWith('.hotmart.com');
        for (var k in attr) {
          if (attr.hasOwnProperty(k) && attr[k] && !u.searchParams.has(k)) {
            u.searchParams.set(k, attr[k]);
          }
        }
        if (isHotmart && !u.searchParams.has('sck') && sessionId) {
          u.searchParams.set('sck', sessionId);
        }
        if (!u.searchParams.has('utm_sck') && sessionId) {
          u.searchParams.set('utm_sck', sessionId);
        }
        return u.toString();
      } catch(e) { return urlStr; }
    }

    document.addEventListener('click', function(ev) {
      var target = ev.target;
      while (target && target.tagName !== 'A' && target.tagName !== 'BUTTON') {
        target = target.parentElement;
      }
      if (!target) return;

      if (target.tagName === 'A' && target.href) {
        var originalHref = target.href;
        if (isAllowed(originalHref)) {
          var decorated = decorate(originalHref);
          target.href = decorated;
          sendEvent('checkout', decorated);
          return;
        }
      }

      // Detecção de clique em CTA
      var role = target.getAttribute('role') || '';
      var cls = target.className || '';
      var text = (target.innerText || '').toLowerCase();
      if (
        role === 'button' ||
        /cta|btn|comprar|quero|assinar|garantir/i.test(cls) ||
        /comprar|quero|garantir|iniciar|assinar|continuar/i.test(text)
      ) {
        sendEvent('cta');
      }
    }, true);

  } catch(e) {}
})();`;

  return new NextResponse(script, {
    status: 200,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

(function() {
  try {
    var scriptTag = document.currentScript || document.querySelector('script[data-key]');
    var key = scriptTag ? scriptTag.getAttribute('data-key') : (window.__TRACKBASE_KEY__ || window.__UTMLISO_KEY__ || '');
    if (!key) return;

    var STORAGE_KEY = 'trackbase_attr_' + encodeURIComponent(location.origin + '|' + key).slice(0, 180);
    var SESSION_KEY = 'trackbase_sid';
    var QUEUE_KEY = STORAGE_KEY + '_queue';
    var ATTR_TTL = 30 * 24 * 60 * 60 * 1000;

    function getCookie(name) {
      var match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
      return match ? decodeURIComponent(match[1]).slice(0, 300) : null;
    }

    function getSession() {
      var s = '';
      // Keep a session scoped to this tab/visit. localStorage merges
      // unrelated tabs and makes separate lead journeys look like one path.
      try { s = sessionStorage.getItem(SESSION_KEY) || ''; } catch(e) {}
      if (!s || s.length < 5) {
        s = 's_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
        try { sessionStorage.setItem(SESSION_KEY, s); } catch(e) {}
      }
      return s;
    }

    function getAttribution() {
      var params = new URLSearchParams(window.location.search);
      var current = {};
      try {
        var raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          var stored = JSON.parse(raw) || {};
          if (stored.savedAt && Date.now() - stored.savedAt < ATTR_TTL) current = stored.value || {};
        }
      } catch(e) {}

      var fields = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_placement', 'placement', 'fbclid'];
      var fresh = false;
      for (var i = 0; i < fields.length; i++) {
        var f = fields[i];
        var val = params.get(f);
        if (val && !/\{\{|\}\}|%7b%7b/i.test(val)) {
          current[f] = val.slice(0, 300);
          fresh = true;
        } else if (val) current.tracking_macro_unresolved = 'true';
      }

      var fbp = getCookie('_fbp');
      var fbc = getCookie('_fbc');
      if (fbp) current.fbp = fbp;
      if (fbc) current.fbc = fbc;

      if (fresh || fbp || fbc) {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ value: current, savedAt: Date.now() })); } catch(e) {}
      }
      return current;
    }

    var sessionId = getSession();
    var attr = getAttribution();
    var endpoint = (scriptTag && scriptTag.src) ? new URL('/api/track', scriptTag.src).href : '/api/track';

    function queueRead() { try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]') || []; } catch(e) { return []; } }
    function queueWrite(items) { try { localStorage.setItem(QUEUE_KEY, JSON.stringify(items.slice(-30))); } catch(e) {} }
    function flushQueue() {
      var items = queueRead();
      items.forEach(function(item) {
        fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item), keepalive: true }).then(function(r) {
          if (r.ok) queueWrite(queueRead().filter(function(x) { return x.event_id !== item.event_id; }));
        }).catch(function() {});
      });
    }
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

        var eventObject = {
          key: key,
          event_type: type,
          event_id: eventId,
          session_id: sessionId,
          url: extraUrl || window.location.href,
          attribution: eventAttr
        };
        var payload = JSON.stringify(eventObject);
        var pending = queueRead(); pending.push(eventObject); queueWrite(pending);

        var beaconSent = false;
        if (navigator.sendBeacon) {
          try {
            // text/plain avoids a cross-origin preflight for Beacon requests.
            // The API parses the request body as JSON independently.
            beaconSent = navigator.sendBeacon(endpoint, new Blob([payload], { type: 'text/plain;charset=UTF-8' }));
          } catch(err) {}
        }
        if (!beaconSent) {
          fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload,
            keepalive: true
          }).then(function(r) { if (r.ok) queueWrite(queueRead().filter(function(x) { return x.event_id !== eventId; })); }).catch(function() {});
        }
      } catch(e) {}
    }
    flushQueue();
    window.addEventListener('online', flushQueue);
    window.addEventListener('pagehide', function() {
      queueRead().forEach(function(item) { try { navigator.sendBeacon(endpoint, new Blob([JSON.stringify(item)], { type: 'text/plain;charset=UTF-8' })); } catch(e) {} });
    });

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

    // The configuration script carries the SAME matcher implementation used by the API.
    function config() {
      return window.__TRACKBASE_CHECKOUT_CONFIG__ && window.__TRACKBASE_CHECKOUT_CONFIG__[key];
    }
    function absoluteDestination(value) {
      if (!value || !String(value).trim() || /^\s*#/.test(value)) return null;
      try {
        var input = String(value).trim();
        if (!/^[a-z][a-z0-9+.-]*:/i.test(input) && !/^[/.?#]/.test(input)) {
          input = /^[^/\s]+\.[^/\s]+(?:\/|$)/.test(input) ? 'https://' + input : input;
        }
        var destination = new URL(input, window.location.href);
        return /^https?:$/.test(destination.protocol) && !destination.username && !destination.password ? destination.href : null;
      } catch { return null; }
    }
    function isAllowed(urlStr) {
      var current = config();
      var destination = absoluteDestination(urlStr);
      if (!current || !destination || typeof current.matches !== 'function' || !Array.isArray(current.rules)) return false;
      return current.rules.filter(function(rule) { return current.matches(destination, rule); }).length === 1;
    }
    function targetDestination(target) {
      var explicit = target.getAttribute('data-trackbase-checkout') || target.getAttribute('data-checkout');
      return absoluteDestination(explicit || (target.tagName === 'A' ? target.href : target.tagName === 'FORM' ? target.getAttribute('action') : null));
    }
    var ctaSeen = false;
    var observedTargets = typeof WeakSet === 'function' ? new WeakSet() : null;
    var ctaObserver = typeof IntersectionObserver === 'function' ? new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (!ctaSeen && entry.isIntersecting && isAllowed(targetDestination(entry.target))) {
          ctaSeen = true;
          sendEvent('cta_view', null, { cta_visible: 'true' });
          ctaObserver.disconnect();
        }
      });
    }, { threshold: 0.25 }) : null;
    function scanCheckouts() {
      document.querySelectorAll('a[href], [data-trackbase-checkout], [data-checkout], form[action]').forEach(function(target) {
        var destination = targetDestination(target);
        if (!isAllowed(destination)) return;
        if (target.tagName === 'A') {
          var decorated = decorate(destination);
          if (target.href !== decorated) target.href = decorated;
        }
        if (ctaObserver && !ctaSeen && (!observedTargets || !observedTargets.has(target))) {
          ctaObserver.observe(target);
          if (observedTargets) observedTargets.add(target);
        }
      });
    }
    function decorate(urlStr) {
      if (!isAllowed(urlStr)) return urlStr;
      try {
        var u = new URL(urlStr, window.location.href);
        var host = u.hostname.toLowerCase();
        var isHotmart = host === 'hotmart.com' || host.slice(-'.hotmart.com'.length) === '.hotmart.com';
        for (var k in attr) {
          if (attr.hasOwnProperty(k) && attr[k] && !u.searchParams.has(k)) {
            u.searchParams.set(k, attr[k]);
          }
        }
        if (!u.searchParams.has('sck') && sessionId) {
          u.searchParams.set('sck', sessionId);
        }
        if (isHotmart && !u.searchParams.has('xcod') && sessionId) {
          u.searchParams.set('xcod', sessionId);
        }
        if (!u.searchParams.has('utm_sck') && sessionId) {
          u.searchParams.set('utm_sck', sessionId);
        }
        if (!u.searchParams.has('src') && sessionId) {
          u.searchParams.set('src', sessionId);
        }
        return u.toString();
      } catch(e) { return urlStr; }
    }

    document.addEventListener('click', function(ev) {
      var target = ev.target;
      while (target && target.tagName !== 'A' && target.tagName !== 'BUTTON' && !(target.hasAttribute && target.hasAttribute('data-trackbase-checkout'))) target = target.parentElement;
      if (!target) return;
      var destination = targetDestination(target);
      if (destination && isAllowed(destination)) {
        var decorated = decorate(destination);
        if (target.tagName === 'A') target.href = decorated;
        // A URL on a JS button declares its destination; navigation stays with the site's handler.
        else if (target.hasAttribute('data-trackbase-checkout')) target.setAttribute('data-trackbase-checkout', decorated);
        sendEvent('checkout', decorated, { action: 'checkout_click' });
      } else {
        sendEvent('cta_click', destination || window.location.href, { action: 'cta_click' });
      }
    }, true);

    document.addEventListener('submit', function(ev) {
      var form = ev.target;
      if (!form || form.tagName !== 'FORM') return;
      var override = ev.submitter && ev.submitter.getAttribute('formaction');
      var action = absoluteDestination(override || form.getAttribute('action'));
      // A GET form can override a product selector from action (e.g. ?plan=one).
      // Validate those effective values, without copying unrelated customer fields into analytics.
      var method = (ev.submitter && ev.submitter.getAttribute('formmethod')) || form.getAttribute('method') || 'get';
      if (action && String(method).toLowerCase() === 'get') {
        var effective = new URL(action);
        var queryKeys = new Set();
        effective.searchParams.forEach(function(value, name) { queryKeys.add(name); });
        var currentConfig = config();
        if (currentConfig) currentConfig.rules.forEach(function(rule) {
          var ruleUrl = absoluteDestination(rule);
          if (ruleUrl) new URL(ruleUrl).searchParams.forEach(function(value, name) { queryKeys.add(name); });
        });
        queryKeys.forEach(function(name) {
          var fields = Array.prototype.filter.call(form.elements || [], function(input) {
            return input.name === name && !input.disabled && !/^(submit|button|reset|file)$/i.test(input.type || '') && (!/^(checkbox|radio)$/i.test(input.type || '') || input.checked);
          });
          if (!fields.length) return;
          effective.searchParams.delete(name);
          fields.forEach(function(input) { effective.searchParams.append(name, input.value || ''); });
        });
        action = effective.href;
      }
      if (!isAllowed(action)) {
        sendEvent('cta_click', action || window.location.href, { action: 'form_submit' });
        return;
      }
      var decorated = decorate(action);
      if (override) ev.submitter.setAttribute('formaction', decorated);
      else form.setAttribute('action', decorated);
      // GET forms replace the action query; include attribution and existing business parameters.
      new URL(decorated).searchParams.forEach(function(value, name) {
        var existing = Array.prototype.some.call(form.elements || [], function(input) { return input.name === name; });
        if (existing) return;
        var input = document.createElement('input'); input.type = 'hidden'; input.name = name; input.value = value; form.appendChild(input);
      });
      sendEvent('checkout', decorated, { action: 'checkout_submit' });
    }, true);

    // Location.assign/href are not reliably interceptable; explicit data attributes cover those buttons.
    if (typeof window.open === 'function') {
      var originalOpen = window.open;
      window.open = function(url) {
        var args = Array.prototype.slice.call(arguments);
        var destination = absoluteDestination(url);
        var checkout = isAllowed(destination);
        if (checkout) args[0] = decorate(destination);
        var opened = originalOpen.apply(this, args);
        // noopener/noreferrer intentionally return null even when the browser opened
        // the tab. Without those features, null means the popup was blocked.
        var explicitlyNoopener = /(?:^|,|\s)(?:noopener|noreferrer)(?:=|,|\s|$)/i.test(String(args[2] || ''));
        if (checkout && (opened || explicitlyNoopener)) sendEvent('checkout', args[0], { action: 'window_open' });
        return opened;
      };
    }
    ['pushState', 'replaceState'].forEach(function(method) {
      var original = history[method];
      history[method] = function() {
        var args = Array.prototype.slice.call(arguments);
        var destination = absoluteDestination(args[2]);
        var checkout = isAllowed(destination);
        if (checkout) args[2] = decorate(destination);
        var result = original.apply(this, args);
        if (checkout) sendEvent('checkout', args[2], { action: 'programmatic_navigation' });
        return result;
      };
    });

    var configurationScript = document.createElement('script');
    configurationScript.src = endpoint + '?key=' + encodeURIComponent(key) + '&format=js';
    configurationScript.async = true;
    if (scriptTag && scriptTag.nonce) configurationScript.nonce = scriptTag.nonce;
    configurationScript.onload = function() {
      scanCheckouts();
      if (typeof MutationObserver === 'function') new MutationObserver(scanCheckouts).observe(document.documentElement, {
        childList: true, subtree: true, attributes: true, attributeFilter: ['href', 'action', 'data-trackbase-checkout', 'data-checkout']
      });
    };
    // If configuration cannot load, generic interactions remain CTA; never invent IC.
    (document.head || document.documentElement).appendChild(configurationScript);
  } catch(e) {}
})();

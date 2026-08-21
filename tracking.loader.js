/**
 * Loads GA4, Google Ads, and Facebook Pixel from tracking.config.js
 */
(function () {
  var cfg = window.SITE_TRACKING || {};
  var ga4Id = cfg.ga4Id;
  var gtmId = cfg.gtmId;
  var pixelId = cfg.facebookPixelId;
  var isPlaceholder = function (v) {
    return !v || /X{3,}|YOUR_|GA_MEASUREMENT|CONVERSION_LABEL/i.test(v);
  };

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());

  if (gtmId && !isPlaceholder(gtmId)) {
    (function (w, d, s, l, i) {
      w[l] = w[l] || [];
      w[l].push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
      var f = d.getElementsByTagName(s)[0];
      var j = d.createElement(s);
      var dl = l !== 'dataLayer' ? '&l=' + l : '';
      j.async = true;
      j.src = 'https://www.googletagmanager.com/gtm.js?id=' + i + dl;
      f.parentNode.insertBefore(j, f);
    })(window, document, 'script', 'dataLayer', gtmId);
  }

  if (ga4Id && !isPlaceholder(ga4Id)) {
    var gaScript = document.createElement('script');
    gaScript.async = true;
    gaScript.src = 'https://www.googletagmanager.com/gtag/js?id=' + ga4Id;
    document.head.appendChild(gaScript);
    window.gtag('config', ga4Id, { send_page_view: true });
  }

  if (pixelId && !isPlaceholder(pixelId)) {
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return;
      n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n;
      n.push = n;
      n.loaded = !0;
      n.version = '2.0';
      n.queue = [];
      t = b.createElement(e);
      t.async = !0;
      t.src = v;
      s = b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t, s);
    }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('init', pixelId);
    window.fbq('track', 'PageView');
  }
})();

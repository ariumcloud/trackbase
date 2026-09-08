/**
 * Assinaturas de User-Agents para identificar:
 * 1. Bots de revisão e moderação de anúncios (Meta, Google, TikTok, Bing) -> Devem ver a WHITE PAGE.
 * 2. Ferramentas de espionagem, scrapers e navegadores headless -> Devem ver a GRAY PAGE (Isca).
 */

const AD_REVIEWER_PATTERNS = [
  /facebookexternalhit/i,
  /facebot/i,
  /meta-externalagent/i,
  /meta-externalfetcher/i,
  /google-adwords/i,
  /google-inspectiontool/i,
  /googlebot/i,
  /mediapartners-google/i,
  /adsbot-google/i,
  /tiktokbot/i,
  /bytespider/i,
  /bingbot/i,
  /adidxbot/i,
  /pinterestbot/i,
  /twitterbot/i,
];

const SPY_AND_SCRAPER_PATTERNS = [
  /adheart/i,
  /spyhorus/i,
  /dropispy/i,
  /ahrefs/i,
  /semrush/i,
  /dotbot/i,
  /mj12bot/i,
  /screaming frog/i,
  /headlesschrome/i,
  /playwright/i,
  /puppeteer/i,
  /selenium/i,
  /phantomjs/i,
  /python-requests/i,
  /python-urllib/i,
  /aiohttp/i,
  /axios/i,
  /node-fetch/i,
  /got/i,
  /go-http-client/i,
  /curl\//i,
  /wget\//i,
  /httpie/i,
  /postman/i,
];

export function isAdReviewerBot(userAgent: string): boolean {
  if (!userAgent) return false;
  return AD_REVIEWER_PATTERNS.some((pattern) => pattern.test(userAgent));
}

export function isSpyOrScraper(userAgent: string): boolean {
  if (!userAgent) return true; // UA vazio geralmente é script ou bot de scraping
  return SPY_AND_SCRAPER_PATTERNS.some((pattern) => pattern.test(userAgent));
}

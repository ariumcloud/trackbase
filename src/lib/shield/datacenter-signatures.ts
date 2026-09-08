/**
 * Detecção otimizada de IPs de Data Centers (AWS, GCP, Azure, DigitalOcean, Hetzner, OVH, etc.)
 * Utiliza representação inteira de IPv4 de 32-bits para matching de CIDR em O(1).
 */

interface CidrRange {
  network: number;
  mask: number;
  name: string;
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let num = 0;
  for (let i = 0; i < 4; i++) {
    const byte = Number(parts[i]);
    if (isNaN(byte) || byte < 0 || byte > 255) return null;
    num = (num << 8) + byte;
  }
  return num >>> 0;
}

function parseCidr(cidr: string, name: string): CidrRange | null {
  const [ipPart, bitsPart] = cidr.split("/");
  const ip = ipv4ToInt(ipPart);
  const bits = Number(bitsPart);
  if (ip === null || isNaN(bits) || bits < 0 || bits > 32) return null;
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return {
    network: (ip & mask) >>> 0,
    mask,
    name,
  };
}

// Principais subnets dos provedores de cloud mais utilizados por ferramentas de espionagem, proxies e bots
const RAW_CIDRS: [string, string][] = [
  // Amazon AWS / CloudFront
  ["3.0.0.0/9", "Amazon AWS"],
  ["3.128.0.0/9", "Amazon AWS"],
  ["13.32.0.0/11", "Amazon AWS"],
  ["15.192.0.0/11", "Amazon AWS"],
  ["18.0.0.0/8", "Amazon AWS"],
  ["34.192.0.0/10", "Amazon AWS"],
  ["35.156.0.0/14", "Amazon AWS"],
  ["35.160.0.0/11", "Amazon AWS"],
  ["44.192.0.0/10", "Amazon AWS"],
  ["52.0.0.0/10", "Amazon AWS"],
  ["52.64.0.0/11", "Amazon AWS"],
  ["52.96.0.0/11", "Amazon AWS"],
  ["54.0.0.0/8", "Amazon AWS"],

  // Google Cloud / Datacenters
  ["34.64.0.0/10", "Google Cloud"],
  ["34.128.0.0/10", "Google Cloud"],
  ["35.184.0.0/13", "Google Cloud"],
  ["35.192.0.0/11", "Google Cloud"],
  ["35.224.0.0/12", "Google Cloud"],
  ["35.240.0.0/13", "Google Cloud"],
  ["104.196.0.0/14", "Google Cloud"],
  ["107.178.0.0/16", "Google Cloud"],
  ["130.211.0.0/16", "Google Cloud"],

  // Microsoft Azure
  ["13.64.0.0/11", "Microsoft Azure"],
  ["13.96.0.0/13", "Microsoft Azure"],
  ["20.0.0.0/10", "Microsoft Azure"],
  ["20.64.0.0/10", "Microsoft Azure"],
  ["20.128.0.0/10", "Microsoft Azure"],
  ["20.192.0.0/10", "Microsoft Azure"],
  ["40.74.0.0/15", "Microsoft Azure"],
  ["40.112.0.0/13", "Microsoft Azure"],
  ["51.140.0.0/14", "Microsoft Azure"],
  ["104.40.0.0/13", "Microsoft Azure"],

  // DigitalOcean
  ["104.131.0.0/16", "DigitalOcean"],
  ["104.248.0.0/16", "DigitalOcean"],
  ["138.68.0.0/16", "DigitalOcean"],
  ["142.93.0.0/16", "DigitalOcean"],
  ["157.230.0.0/16", "DigitalOcean"],
  ["157.245.0.0/16", "DigitalOcean"],
  ["159.65.0.0/16", "DigitalOcean"],
  ["159.89.0.0/16", "DigitalOcean"],
  ["159.203.0.0/16", "DigitalOcean"],
  ["165.22.0.0/16", "DigitalOcean"],
  ["167.99.0.0/16", "DigitalOcean"],
  ["178.62.0.0/16", "DigitalOcean"],
  ["188.166.0.0/16", "DigitalOcean"],
  ["206.189.0.0/16", "DigitalOcean"],

  // Hetzner Online
  ["78.46.0.0/15", "Hetzner"],
  ["88.198.0.0/16", "Hetzner"],
  ["94.130.0.0/16", "Hetzner"],
  ["95.216.0.0/15", "Hetzner"],
  ["116.202.0.0/15", "Hetzner"],
  ["136.243.0.0/16", "Hetzner"],
  ["144.76.0.0/16", "Hetzner"],
  ["159.69.0.0/16", "Hetzner"],
  ["168.119.0.0/16", "Hetzner"],
  ["188.40.0.0/16", "Hetzner"],
  ["195.201.0.0/16", "Hetzner"],

  // OVHcloud
  ["51.254.0.0/15", "OVHcloud"],
  ["54.36.0.0/15", "OVHcloud"],
  ["145.239.0.0/16", "OVHcloud"],
  ["147.135.0.0/16", "OVHcloud"],
  ["198.244.128.0/17", "OVHcloud"],

  // Linode / Akamai Cloud
  ["45.33.0.0/16", "Linode"],
  ["45.56.0.0/16", "Linode"],
  ["45.79.0.0/16", "Linode"],
  ["139.162.0.0/16", "Linode"],
  ["172.104.0.0/15", "Linode"],
  ["173.255.192.0/18", "Linode"],

  // Oracle Cloud
  ["129.146.0.0/15", "Oracle Cloud"],
  ["129.150.0.0/15", "Oracle Cloud"],
  ["132.145.0.0/16", "Oracle Cloud"],
  ["140.238.0.0/16", "Oracle Cloud"],
  ["150.136.0.0/16", "Oracle Cloud"],

  // Vultr / Choopa
  ["45.32.0.0/16", "Vultr"],
  ["45.63.0.0/16", "Vultr"],
  ["45.76.0.0/15", "Vultr"],
  ["108.61.0.0/16", "Vultr"],
  ["149.28.0.0/16", "Vultr"],
];

const COMPILED_CIDRS: CidrRange[] = RAW_CIDRS.map(([cidr, name]) =>
  parseCidr(cidr, name),
).filter((c): c is CidrRange => c !== null);

/**
 * Normaliza um IP removendo wrappers como ::ffff: (IPv4-mapped IPv6)
 */
export function normalizeIp(rawIp: string): string {
  let ip = rawIp.trim();
  if (ip.startsWith("::ffff:")) {
    ip = ip.substring(7);
  }
  return ip;
}

/**
 * Verifica se um IP pertence a um Data Center / Provedor de Cloud conhecido.
 */
export function checkDatacenterIp(rawIp: string): { isDatacenter: boolean; provider?: string } {
  const ip = normalizeIp(rawIp);
  const intVal = ipv4ToInt(ip);
  if (intVal === null) {
    return { isDatacenter: false };
  }

  for (const cidr of COMPILED_CIDRS) {
    if (((intVal & cidr.mask) >>> 0) === cidr.network) {
      return { isDatacenter: true, provider: cidr.name };
    }
  }

  return { isDatacenter: false };
}

/**
 * Mascara o IP para armazenamento seguro e em conformidade com privacidade (LGPD/GDPR)
 */
export function maskIp(rawIp: string): string {
  const ip = normalizeIp(rawIp);
  const parts = ip.split(".");
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.***.***`;
  }
  return ip.slice(0, 10) + "...";
}

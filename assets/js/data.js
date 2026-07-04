/* ============ HALFHATA — Brand config + catalogue ============ */
const HH = {
  brand: 'halfhata',
  logo: 'assets/img/logo.jpeg',
  phone: '0199210064',
  email: 'halfhata1@gmail.com',
  channels: [
    { key: 'whatsapp', label: 'WhatsApp', number: '0199210064', color: '#25d366' },
    { key: 'nagad',    label: 'Nagad',    number: '0199210064', color: '#ee4d2d' },
    { key: 'bkash',    label: 'bKash',    number: '0199210064', color: '#e2136e' },
  ],
  deliveryCharge: 80,
  codMinAdvance: 120,
  couriers: ['Steadfast', 'Pathao', 'RedX', 'Sundarban', 'Manual'],
  districts: ['Dhaka','Chattogram','Sylhet','Rajshahi','Khulna','Barishal','Rangpur','Mymensingh','Cumilla','Gazipur','Narayanganj','Bogura'],
  sizes: ['S','M','L','XL','XXL'],
};

/* SVG garment illustration (no photo dependency) */
function garment(type, color, w = '74%') {
  const c = color, sh = shade(color, -18), pr = shade(color, -34);
  const body = type === 'hoodie'
    ? `<path d="M60 78 L60 52 Q60 40 74 34 L96 26 Q110 22 128 22 Q146 22 160 26 L182 34 Q196 40 196 52 L196 78 L176 86 L176 168 Q176 176 168 176 L88 176 Q80 176 80 168 L80 86 Z" fill="${c}"/>
       <path d="M96 26 Q128 54 160 26 L152 40 Q128 62 104 40 Z" fill="${sh}"/>
       <rect x="112" y="30" width="32" height="70" rx="16" fill="${pr}" opacity=".55"/>`
    : `<path d="M52 62 L92 34 Q112 26 128 40 Q144 26 164 34 L204 62 L188 92 L172 82 L172 172 Q172 178 166 178 L90 178 Q84 178 84 172 L84 82 L68 92 Z" fill="${c}"/>
       <path d="M96 34 Q128 60 160 34 L150 46 Q128 66 106 46 Z" fill="${sh}"/>`;
  const mark = `<text x="128" y="118" text-anchor="middle" font-family="Inter,sans-serif" font-size="17" font-weight="800" fill="${textOn(c)}" opacity=".85">halfhata</text>`;
  return `<svg class="tee" viewBox="0 0 256 210" style="width:${w}" xmlns="http://www.w3.org/2000/svg">${body}${mark}</svg>`;
}
function shade(hex, p){let{r,g,b}=hx(hex);const f=t=>Math.max(0,Math.min(255,Math.round(t+(t*p/100))));return `rgb(${f(r)},${f(g)},${f(b)})`;}
function hx(h){h=h.replace('#','');if(h.length===3)h=[...h].map(x=>x+x).join('');return{r:parseInt(h.slice(0,2),16),g:parseInt(h.slice(2,4),16),b:parseInt(h.slice(4,6),16)};}
function textOn(hex){const{r,g,b}=hx(hex.replace('rgb','').match(/[0-9a-fA-F]{3,6}/)?hex:hex);const L=(0.299*r+0.587*g+0.114*b);return L>150?'#1a1a1a':'#f5f5f5';}

/* Products are created by the admin (see Store.getProducts / addProduct).
   No seed catalogue — the store starts empty until you post t-shirts. */
const productById = id => Store.getProducts().find(p => p.id === id) || null;
const money = n => '৳' + Number(n).toLocaleString('en-IN');

/* product card image: uploaded design photo, or SVG fallback */
function productMedia(p, w = '74%') {
  if (p && p.image) return `<img src="${p.image}" alt="${esc(p.name)}" style="width:100%;height:100%;object-fit:cover">`;
  return garment((p && p.type) || 'tee', (p && p.color) || '#141416', w);
}

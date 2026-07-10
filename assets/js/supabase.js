/* ============ HALFHATA — Supabase connection (Stage 1: products) ============
   Products, categories and images live in Supabase so every device sees them.
   Reads are cached into the same localStorage keys the app already uses, so the
   rest of the app keeps working unchanged. Orders/login come in Stage 2.        */

const SB_URL  = 'https://mjycdnpjcffofoiuenle.supabase.co';
const SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qeWNkbnBqY2Zmb2ZvaXVlbmxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzMzMwMDcsImV4cCI6MjA5ODkwOTAwN30.TjF994SLeKtuEo9V6AjrgccDzprvzcxLZCPDVvYfp5E';

const sb = window.supabase ? window.supabase.createClient(SB_URL, SB_ANON) : null;
const _slug = s => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

window.SB = {
  ready: !!sb,

  /* pull products + categories from Supabase into the local cache */
  async loadCatalog() {
    if (!sb) return;
    try {
      const [pRes, cRes] = await Promise.all([
        sb.from('products').select('*').order('created_at', { ascending: false }),
        sb.from('categories').select('name'),
      ]);
      if (pRes.error) console.error('load products', pRes.error);
      else localStorage.setItem('hh_products', JSON.stringify(pRes.data || []));
      if (cRes.error) console.error('load categories', cRes.error);
      else localStorage.setItem('hh_categories', JSON.stringify((cRes.data || []).map(c => c.name)));
    } catch (e) { console.error('loadCatalog', e); }
  },

  /* upload a compressed dataURL to Storage, return its public URL */
  async uploadImage(dataUrl) {
    if (!sb || !dataUrl || !String(dataUrl).startsWith('data:')) return dataUrl || null;
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const path = 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6) + '.jpg';
      const { error } = await sb.storage.from('product-images').upload(path, blob, { contentType: 'image/jpeg', upsert: true });
      if (error) { console.error('upload image', error); return null; }
      return sb.storage.from('product-images').getPublicUrl(path).data.publicUrl;
    } catch (e) { console.error('uploadImage', e); return null; }
  },

  async uploadImages(arr) {
    const out = [];
    for (const im of (arr || [])) { const u = await this.uploadImage(im); if (u) out.push(u); }
    return out;
  },

  async createProducts(list) {
    if (!sb) return;
    for (const d of list) {
      const images = await this.uploadImages(d.images && d.images.length ? d.images : (d.image ? [d.image] : []));
      const row = {
        id: (_slug(d.name) || 'item') + '-' + Math.random().toString(36).slice(2, 6),
        name: d.name.trim(), category: d.category || null, kind: d.kind || 'tshirt',
        price: Number(d.price) || 0, sizes: d.sizes || [], image: images[0] || null, images, badge: d.badge || null, description: d.description || '', in_stock: true, active: true,
      };
      const { error } = await sb.from('products').insert(row);
      if (error) { console.error('insert product', error); toast('Could not save product: ' + error.message); }
    }
    await this.loadCatalog();
  },

  async updateProduct(id, patch) {
    if (!sb) return;
    if (patch.images) { patch.images = await this.uploadImages(patch.images); patch.image = patch.images[0] || null; }
    else if (patch.image && String(patch.image).startsWith('data:')) patch.image = await this.uploadImage(patch.image);
    const { error } = await sb.from('products').update(patch).eq('id', id);
    if (error) { console.error('update product', error); toast('Could not update: ' + error.message); }
    await this.loadCatalog();
  },

  async deleteProduct(id) {
    if (!sb) return;
    const { error } = await sb.from('products').delete().eq('id', id);
    if (error) console.error('delete product', error);
    await this.loadCatalog();
  },

  async addCategory(name) {
    if (!sb) return;
    name = (name || '').trim(); if (!name) return;
    const { error } = await sb.from('categories').upsert({ name });
    if (error) console.error('add category', error);
    await this.loadCatalog();
  },

  async removeCategory(name) {
    if (!sb) return;
    const { error } = await sb.from('categories').delete().eq('name', name);
    if (error) console.error('remove category', error);
    await this.loadCatalog();
  },

  /* ============ Stage 2: ORDERS ============ */
  /* pull every order from Supabase into the local cache the app already reads */
  async loadOrders() {
    if (!sb) return;
    try {
      const { data, error } = await sb.from('orders').select('*').order('created_at', { ascending: false });
      if (error) { console.error('load orders', error); return; }
      const orders = (data || []).map(r => ({
        id: r.id, createdAt: r.created_at,
        customer: r.customer || {}, items: r.items || [],
        subtotal: Number(r.subtotal), delivery: Number(r.delivery), total: Number(r.total),
        payment: r.payment || {}, status: r.status || 'Pending',
        courier: r.courier || null,
        notifications: r.notifications || [], timeline: r.timeline || [],
      }));
      localStorage.setItem('hh_orders', JSON.stringify(orders));
    } catch (e) { console.error('loadOrders', e); }
  },

  /* insert or update one order (called after any local change) */
  async pushOrder(o) {
    if (!sb || !o) return;
    const row = {
      id: o.id, created_at: o.createdAt,
      customer: o.customer, items: o.items,
      subtotal: o.subtotal, delivery: o.delivery, total: o.total,
      payment: o.payment, status: o.status,
      courier: o.courier, notifications: o.notifications, timeline: o.timeline,
      user_email: (o.customer && o.customer.email) || null,
      phone: (o.customer && o.customer.phone) || null,
    };
    const { error } = await sb.from('orders').upsert(row);
    if (error) { console.error('push order', error); toast('⚠ Order could not sync: ' + error.message); return false; }
    return true;
  },
};

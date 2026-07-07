/* ============ HALFHATA — Supabase connection (Stage 1: products) ============
   Products, categories and images live in Supabase so every device sees them.
   Reads are cached into the same localStorage keys the app already uses. */

const SB_URL  = 'https://mjycdnpjcffofoiuenle.supabase.co';
const SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qeWNkbnBqY2Zmb2ZvaXVlbmxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzMzMwMDcsImV4cCI6MjA5ODkwOTAwN30.TjF994SLeKtuEo9V6AjrgccDzprvzcxLZCPDVvYfp5E';

const sb = window.supabase ? window.supabase.createClient(SB_URL, SB_ANON) : null;
const _slug = s => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

const SB = {
  ready: !!sb,

  /* pull products + categories from Supabase into the local cache */
  async loadCatalog() {
    if (!sb) return;
    try {
      const [pRes, cRes] = await Promise.all([
        sb.from('products').select('*').eq('active', true).order('created_at', { ascending: false }),
        sb.from('categories').select('name'),
      ]);
      if (pRes.error) {
        console.error('load products error', pRes.error);
      } else {
        localStorage.setItem('hh_products', JSON.stringify(pRes.data || []));
      }
      if (cRes.error) {
        console.error('load categories error', cRes.error);
      } else {
        localStorage.setItem('hh_categories', JSON.stringify((cRes.data || []).map(c => c.name)));
      }
    } catch (e) { 
      console.error('loadCatalog exception', e); 
    }
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

  async createProducts(list) {
    if (!sb) return;
    for (const d of list) {
      const image = await this.uploadImage(d.image);
      const uniqueId = (_slug(d.name) || 'item') + '-' + Math.floor(1000 + Math.random() * 9000);
      
      // Auto sync category first to satisfy constraints
      if (d.category) {
        await sb.from('categories').upsert([{ name: d.category.trim() }], { onConflict: 'name' });
      }

      const row = {
        id: uniqueId,
        name: d.name.trim(), 
        category: d.category || null, 
        kind: d.kind || 'tshirt',
        price: Number(d.price) || 0, 
        sizes: d.sizes || [], 
        image, 
        badge: d.badge || null, 
        active: true,
      };
      const { error } = await sb.from('products').insert(row);
      if (error) { 
        console.error('insert product error', error); 
        toast('Could not save product: ' + error.message); 
      }
    }
    await this.loadCatalog();
  },

  async updateProduct(id, patch) {
    if (!sb) return;
    if (patch.image && String(patch.image).startsWith('data:')) {
      patch.image = await this.uploadImage(patch.image);
    }
    const { error } = await sb.from('products').update(patch).eq('id', id);
    if (error) { 
      console.error('update product error', error); 
      toast('Could not update: ' + error.message); 
    }
    await this.loadCatalog();
  },

  async deleteProduct(id) {
    if (!sb) return;
    const { error } = await sb.from('products').delete().eq('id', id);
    if (error) console.error('delete product error', error);
    await this.loadCatalog();
  },

  async addCategory(name) {
    if (!sb) return;
    name = (name || '').trim(); if (!name) return;
    const { error } = await sb.from('categories').upsert({ name });
    if (error) console.error('add category error', error);
    await this.loadCatalog();
  },

  async removeCategory(name) {
    if (!sb) return;
    const { error } = await sb.from('categories').delete().eq('name', name);
    if (error) console.error('remove category error', error);
    await this.loadCatalog();
  },
};

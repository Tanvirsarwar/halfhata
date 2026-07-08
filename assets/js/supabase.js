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

  async createProducts(list) {
    if (!sb) return;
    for (const d of list) {
      const image = await this.uploadImage(d.image);
      const row = {
        id: (_slug(d.name) || 'item') + '-' + Math.random().toString(36).slice(2, 6),
        name: d.name.trim(), category: d.category || null, kind: d.kind || 'tshirt',
        price: Number(d.price) || 0, sizes: d.sizes || [], image, badge: d.badge || null, active: true,
      };
      const { error } = await sb.from('products').insert(row);
      if (error) { console.error('insert product', error); toast('Could not save product: ' + error.message); }
    }
    await this.loadCatalog();
  },

  async updateProduct(id, patch) {
    if (!sb) return;
    if (patch.image && String(patch.image).startsWith('data:')) patch.image = await this.uploadImage(patch.image);
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
     
  async createCloudOrder(orderPayload, itemsArray) {
    if (!sb) return { ok: false, error: 'Cloud client uninitialized' };
    try {
      // Step A: Insert the master order row
      const { data: orderData, error: orderError } = await sb
        .from('orders')
        .insert([orderPayload])
        .select();

      if (orderError) throw orderError;
      if (!orderData || orderData.length === 0) throw new Error('Database failed to return an order reference ID');
        
      const newOrderId = orderData[0].id;

      // Step B: Map your individual shopping cart items to this fresh Order ID
      const structuredItems = itemsArray.map(item => ({
        order_id: newOrderId,
        product_id: item.id,
        name: item.name,
        price: Number(item.price) || 0,
        size: item.size || 'M',
        color: item.color || null,
        qty: Number(item.qty) || 1
      }));

      // Step C: Bulk save the item rows to order_items
      const { error: itemsError } = await sb
        .from('order_items')
        .insert(structuredItems);

      if (itemsError) throw itemsError;

      return { ok: true, id: newOrderId };
    } catch (err) {
      console.error('Supabase Transaction Error:', err);
      return { ok: false, error: err.message || err };
    }
  }  
}; // This closes window.SB properly!

// Now we safely execute the profile authentication guard structure out here:
(function() {
  if (typeof window !== 'undefined') {
    var activeClient = window.supabaseClient || sb;
    if (activeClient && activeClient.auth) {
      activeClient.auth.getSession().then(function(res) {
        // Ensure data and session exist before looking for user properties
        var session = (res && res.data) ? res.data.session : null;
        if (session && session.user) {
          console.log("Session verified for:", session.user.email);
          // If your app expects a profile object, mock it defensively if missing
          if (typeof window.profile === 'undefined') {
            window.profile = session.user.user_metadata || {};
          }
        }
      }).catch(function(err) {
        console.log("Handled native fallback auth routing safely.");
      });
    }
  }
})();

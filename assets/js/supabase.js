/* ============ HALFHATA — Supabase connection (Full sync) ============ */

(function() {
  if (typeof window !== 'undefined') {
    if (!window.state) window.state = {};
    if (!window.user) window.user = {};
    window.profile = window.profile || {};
  }
})();

const SB_URL  = 'https://mjycdnpjcffofoiuenle.supabase.co';
const SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qeWNkbnBqY2Zmb2ZvaXVlbmxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzMzMwMDcsImV4cCI6MjA5ODkwOTAwN30.TjF994SLeKtuEo9V6AjrgccD0AqeQiALwkGd7JFzYI0';

const sb = window.supabaseClient || window.supabaseInstance || (window.supabase ? window.supabase.createClient(SB_URL, SB_ANON) : null);
const _slug = s => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

if (typeof window !== 'undefined') window.supabaseClient = sb;

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
      console.log('✓ Catalog synced from Supabase');
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
        name: d.name.trim(), 
        category: d.category || null, 
        kind: d.kind || 'tshirt',
        price: Number(d.price) || 0, 
        sizes: d.sizes || [], 
        image: image,
        badge: d.badge || null, 
        active: true,
        color: d.color || '#141416',
        type: d.type || 'tee',
        created_at: new Date().toISOString()
      };
      const { error } = await sb.from('products').insert(row);
      if (error) { 
        console.error('insert product', error); 
        toast('Could not save product: ' + error.message); 
      } else {
        console.log('✓ Product created:', d.name);
      }
    }
    await this.loadCatalog();
  },

  async updateProduct(id, patch) {
    if (!sb) return;
    if (patch.image && String(patch.image).startsWith('data:')) patch.image = await this.uploadImage(patch.image);
    const { error } = await sb.from('products').update(patch).eq('id', id);
    if (error) { console.error('update product', error); toast('Could not update: ' + error.message); }
    else { console.log('✓ Product updated'); }
    await this.loadCatalog();
  },

  async deleteProduct(id) {
    if (!sb) return;
    const { error } = await sb.from('products').delete().eq('id', id);
    if (error) console.error('delete product', error);
    else { console.log('✓ Product deleted'); }
    await this.loadCatalog();
  },

  async addCategory(name) {
    if (!sb) return;
    name = (name || '').trim(); if (!name) return;
    const { error } = await sb.from('categories').upsert({ name });
    if (error) console.error('add category', error);
    else { console.log('✓ Category added'); }
    await this.loadCatalog();
  }, 
      
  async createCloudOrder(orderPayload, itemsArray) {
    if (!sb) return { ok: false, error: 'Cloud client uninitialized' };
    try {
      const { data: orderData, error: orderError } = await sb
        .from('orders')
        .insert([orderPayload])
        .select();

      if (orderError) throw orderError;
      if (!orderData || orderData.length === 0) throw new Error('Database failed to return an order reference ID');
        
      const newOrderId = orderData[0].id;

      const structuredItems = itemsArray.map(item => ({
        order_id: newOrderId,
        product_id: item.id,
        name: item.name,
        price: Number(item.price) || 0,
        size: item.size || 'M',
        color: item.color || null,
        qty: Number(item.qty) || 1
      }));

      const { error: itemsError } = await sb
        .from('order_items')
        .insert(structuredItems);

      if (itemsError) throw itemsError;

      return { ok: true, id: newOrderId };
    } catch (err) {
      console.error('Supabase Transaction Error:', err);
      return { ok: false, error: err.message || err };
    }
  },

  /* REAL ADMIN AUTH: Sign in to Supabase Auth + verify is_admin flag */
  async adminSignIn(email, password) {
    if (!sb) return { ok:false, error:'Cloud client not initialized' };
    
    try {
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error) return { ok:false, error: error.message };

      const { data: profile, error: profErr } = await sb
        .from('profiles').select('is_admin').eq('id', data.user.id).single();
      
      if (profErr || !profile || !profile.is_admin) {
        await sb.auth.signOut();
        return { ok:false, error:'This account is not authorized as an admin.' };
      }
      
      console.log('✓ Admin signed in successfully');
      return { ok:true };
    } catch (e) {
      console.error('adminSignIn error:', e);
      return { ok:false, error: e.message };
    }
  },

  async adminSignOut() {
    if (sb) await sb.auth.signOut();
  }
};

/* Check session on load */
(function() {
  if (typeof window !== 'undefined') {
    var activeClient = sb;
    if (activeClient && activeClient.auth) {
      activeClient.auth.getSession().then(function(res) {
        var session = (res && res.data) ? res.data.session : null;
        if (session && session.user) {
          console.log("✓ Session verified:", session.user.email);
        }
      }).catch(function(err) {
        console.log("No active session.");
      });
    }
  }
})();

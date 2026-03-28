/* ============================================================
   7DS ORIGIN - EVENTS DATABASE MODULE
   Handles Events CRUD via Supabase with localStorage fallback
   ============================================================ */

var EventDB = (function () {

  var _useSupabase = false;

  function init() {
    _useSupabase = (typeof SupaDB !== 'undefined' && SupaDB.isConnected());
    console.log('[EventDB] Initialized. Supabase:', _useSupabase);
  }

  function isSupabase() {
    return _useSupabase;
  }

  /* ── Supabase Operations ── */
  async function fetchAll() {
    if (_useSupabase) {
      try {
        var client = SupaDB.getClient();
        if (!client) return _localFetchAll();
        var result = await client
          .from('events')
          .select('*')
          .order('start_date', { ascending: false });
        if (result.error) {
          console.error('[EventDB] Supabase fetchAll error:', result.error.message);
          return _localFetchAll();
        }
        /* Map Supabase fields to app fields */
        return (result.data || []).map(_mapFromSupabase);
      } catch (e) {
        console.error('[EventDB] fetchAll exception:', e);
        return _localFetchAll();
      }
    }
    return _localFetchAll();
  }

  async function fetchById(id) {
    if (_useSupabase) {
      try {
        var client = SupaDB.getClient();
        if (!client) return _localFindById(id);
        var result = await client
          .from('events')
          .select('*')
          .eq('id', id)
          .single();
        if (result.error) return _localFindById(id);
        return _mapFromSupabase(result.data);
      } catch (e) {
        return _localFindById(id);
      }
    }
    return _localFindById(id);
  }

  async function add(eventData) {
    if (_useSupabase) {
      try {
        var client = SupaDB.getClient();
        if (!client) return _localAdd(eventData);
        var mapped = _mapToSupabase(eventData);
        var result = await client
          .from('events')
          .insert([mapped])
          .select()
          .single();
        if (result.error) {
          console.error('[EventDB] Supabase insert error:', result.error.message);
          return _localAdd(eventData);
        }
        return { data: _mapFromSupabase(result.data), error: null };
      } catch (e) {
        return _localAdd(eventData);
      }
    }
    return _localAdd(eventData);
  }

  async function update(id, eventData) {
    if (_useSupabase) {
      try {
        var client = SupaDB.getClient();
        if (!client) return _localUpdate(id, eventData);
        var mapped = _mapToSupabase(eventData);
        var result = await client
          .from('events')
          .update(mapped)
          .eq('id', id)
          .select()
          .single();
        if (result.error) {
          console.error('[EventDB] Supabase update error:', result.error.message);
          return _localUpdate(id, eventData);
        }
        return { data: _mapFromSupabase(result.data), error: null };
      } catch (e) {
        return _localUpdate(id, eventData);
      }
    }
    return _localUpdate(id, eventData);
  }

  async function remove(id) {
    if (_useSupabase) {
      try {
        var client = SupaDB.getClient();
        if (!client) return _localRemove(id);
        var result = await client
          .from('events')
          .delete()
          .eq('id', id);
        if (result.error) {
          console.error('[EventDB] Supabase delete error:', result.error.message);
          return _localRemove(id);
        }
        return { error: null };
      } catch (e) {
        return _localRemove(id);
      }
    }
    return _localRemove(id);
  }

  async function uploadImage(file, eventSlug) {
    if (!_useSupabase) return { error: null, url: null };
    try {
      var client = SupaDB.getClient();
      if (!client) return { error: null, url: null };
      var ext = file.name.split('.').pop() || 'png';
      var filePath = 'events/' + eventSlug + '-' + Date.now() + '.' + ext;
      var uploadResult = await client.storage
        .from('character-images')
        .upload(filePath, file, { cacheControl: '3600', upsert: true });
      if (uploadResult.error) return { error: uploadResult.error, url: null };
      var urlData = client.storage
        .from('character-images')
        .getPublicUrl(filePath);
      return { error: null, url: urlData.data.publicUrl };
    } catch (e) {
      return { error: e, url: null };
    }
  }

  /* ── Field Mapping ── */
 function _mapFromSupabase(row) {
  return {
    id: row.id,
    title: row.title_en || row.title_th || '',
    desc: row.description_en || row.description_th || '',
    status: row.status || 'active',
    tag: row.event_type || 'event',
    start: row.start_date || '',
    end: row.end_date || '',
    color: row.color || 'linear-gradient(90deg,#3b82f6,#60a5fa)',
    image: row.image || '',
    rewards: row.rewards || [],
    created_at: row.created_at
  };
}

  function _mapToSupabase(ev) {
  return {
    title_en: ev.title || '',
    description_en: ev.desc || '',
    status: ev.status || 'active',
    event_type: ev.tag || 'event',
    start_date: ev.start || null,
    end_date: ev.end || null,
    color: ev.color || 'linear-gradient(90deg,#3b82f6,#60a5fa)',
    image: ev.image || '',
    rewards: ev.rewards || []
  };
}

  /* ── localStorage Fallback ── */
  function _localFetchAll() {
    var stored = localStorage.getItem('7ds_events');
    if (stored) {
      try { return JSON.parse(stored); } catch(e) {}
    }
    return _getDefaults();
  }

  function _localFindById(id) {
    var all = _localFetchAll();
    return all.find(function(e) { return e.id == id; }) || null;
  }

  function _localAdd(eventData) {
    var all = _localFetchAll();
    eventData.id = Date.now();
    all.push(eventData);
    localStorage.setItem('7ds_events', JSON.stringify(all));
    return { data: eventData, error: null };
  }

  function _localUpdate(id, eventData) {
    var all = _localFetchAll();
    var idx = all.findIndex(function(e) { return e.id == id; });
    if (idx !== -1) {
      eventData.id = id;
      all[idx] = eventData;
      localStorage.setItem('7ds_events', JSON.stringify(all));
      return { data: eventData, error: null };
    }
    return { data: null, error: { message: 'Event not found' } };
  }

  function _localRemove(id) {
    var all = _localFetchAll();
    all = all.filter(function(e) { return e.id != id; });
    localStorage.setItem('7ds_events', JSON.stringify(all));
    return { error: null };
  }

  function _getDefaults() {
    return [
      { id:1, status:'active', tag:'event', title:'Holy War Raid', desc:'Team up with allies to defeat the Demon King in the limited-time Holy War Raid. Earn exclusive SSR shards and rare equipment.', start:'2026-03-01', end:'2026-03-15', color:'linear-gradient(90deg,#3b82f6,#60a5fa)', image:'', rewards:['SSR Shard x3','Gold x50,000','Raid Medal x20'] },
      { id:2, status:'active', tag:'update', title:'New Character: Tristan', desc:'The son of Meliodas and Elizabeth joins the battle. Limited banner available for a short time with boosted SSR rates.', start:'2026-03-05', end:'2026-03-20', color:'linear-gradient(90deg,#f0c040,#ffd966)', image:'', rewards:['Tristan SSR','Summon Ticket x10','Gems x500'] },
      { id:3, status:'active', tag:'event', title:'Daily Login Bonus', desc:'Log in every day during March to collect cumulative rewards including gems, tickets, and rare materials.', start:'2026-03-01', end:'2026-03-31', color:'linear-gradient(90deg,#0be881,#34d399)', image:'', rewards:['Gems x1,200','Summon Ticket x5','EXP Potion x30'] },
      { id:4, status:'upcoming', tag:'event', title:'Guild War Season 4', desc:'Compete against guilds worldwide in the new Guild War season. Climb the leaderboard to earn exclusive guild rewards.', start:'2026-03-20', end:'2026-04-05', color:'linear-gradient(90deg,#a78bfa,#c4b5fd)', image:'', rewards:['Guild Crest','Gems x2,000','Exclusive Title'] },
      { id:5, status:'upcoming', tag:'event', title:'Spring Festival', desc:'Celebrate the spring season with special story quests, limited cosmetics, and a special gacha banner featuring seasonal costumes.', start:'2026-03-25', end:'2026-04-10', color:'linear-gradient(90deg,#f472b6,#fb7185)', image:'', rewards:['Spring Costume','Gems x800','Flower Tokens x100'] },
      { id:6, status:'ended', tag:'event', title:"Valentine's Day Event", desc:"A special event celebrating Valentine's Day with exclusive story content and limited cosmetics.", start:'2026-02-10', end:'2026-02-28', color:'linear-gradient(90deg,#f43f5e,#fb7185)', image:'', rewards:['Heart Charm','Gems x600','Valentine Frame'] }
    ];
  }

  return {
    init: init,
    isSupabase: isSupabase,
    fetchAll: fetchAll,
    fetchById: fetchById,
    add: add,
    update: update,
    remove: remove,
    uploadImage: uploadImage
  };
})();

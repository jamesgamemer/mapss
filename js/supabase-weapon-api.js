/* ============================================================
   7DS ORIGIN - SUPABASE WEAPON API MODULE
   Handles all weapon-related Supabase operations:
   CRUD, Storage, Character Linking, Bulk Import
   ============================================================ */

var WeaponDB = (function () {

  // ============================================================
  // WEAPONS - CRUD Operations
  // ============================================================

  async function fetchAll() {
    var client = SupaDB.getClient();
    if (!client) return [];

    var { data, error } = await client
      .from('weapons')
      .select('*')
      .order('rarity', { ascending: false })
      .order('name_en', { ascending: true });

    if (error) {
      console.error('[WeaponDB] fetchAll error:', error.message);
      return [];
    }

    return data || [];
  }


  async function fetchBySlug(slug) {
    var client = SupaDB.getClient();
    if (!client) return null;

    var { data, error } = await client
      .from('weapons')
      .select('*')
      .eq('slug', slug)
      .single();

    if (error) {
      console.error('[WeaponDB] fetchBySlug error:', error.message);
      return null;
    }

    return data;
  }


  async function fetchByCategory(category) {
    var client = SupaDB.getClient();
    if (!client) return [];

    var { data, error } = await client
      .from('weapons')
      .select('*')
      .eq('category', category)
      .order('rarity', { ascending: false })
      .order('name_en', { ascending: true });

    if (error) {
      console.error('[WeaponDB] fetchByCategory error:', error.message);
      return [];
    }

    return data || [];
  }



  // ============================================================
  // INSERT WEAPON
  // ============================================================

  async function insert(weaponData) {

    var client = SupaDB.getClient();
    if (!client) {
      return { error: { message: 'Not connected' } };
    }

    /* ------------------------------
       FIX FIELD MAPPING
       name → name_en
       ------------------------------ */

    weaponData.name_en = weaponData.name_en || weaponData.name;

    delete weaponData.name;


    /* ------------------------------
       VALIDATION
       ------------------------------ */

    if (!weaponData.name_en) {
      return {
        error: { message: 'Weapon Name (EN) is required' }
      };
    }


    /* ------------------------------
       AUTO GENERATE SLUG
       ------------------------------ */

    if (!weaponData.slug) {

      weaponData.slug = weaponData.name_en
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

    }


    /* ------------------------------
       INSERT
       ------------------------------ */

    var { data, error } = await client
      .from('weapons')
      .insert([weaponData])
      .select()
      .single();

    if (error) {
      console.error('[WeaponDB] insert error:', error.message);
    }

    return { data, error };

  }



  async function update(id, updates) {

    var client = SupaDB.getClient();
    if (!client) {
      return { error: { message: 'Not connected' } };
    }

    var { data, error } = await client
      .from('weapons')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[WeaponDB] update error:', error.message);
    }

    return { data, error };

  }



  async function remove(id) {

    var client = SupaDB.getClient();
    if (!client) {
      return { error: { message: 'Not connected' } };
    }

    await unlinkAllCharacters(id);

    var { error } = await client
      .from('weapons')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[WeaponDB] delete error:', error.message);
    }

    return { error };

  }



  // ============================================================
  // STORAGE - Weapon Icon Upload
  // ============================================================

  async function uploadIcon(file, weaponSlug) {

    var client = SupaDB.getClient();
    if (!client) {
      return { error: { message: 'Not connected' }, url: null };
    }

    var ext = file.name.split('.').pop() || 'png';

    var filePath = 'weapons/' + weaponSlug + '-' + Date.now() + '.' + ext;

    var { data, error } = await client.storage
      .from('weapon-icons')
      .upload(filePath, file, { cacheControl: '3600', upsert: true });


    if (error) {

      console.error('[WeaponDB] uploadIcon error:', error.message);

      var result2 = await client.storage
        .from('character-images')
        .upload(filePath, file, { cacheControl: '3600', upsert: true });

      if (result2.error) {
        return { error: result2.error, url: null };
      }

      var { data: urlData } =
        client.storage.from('character-images').getPublicUrl(filePath);

      return { error: null, url: urlData.publicUrl };

    }


    var { data: urlData } =
      client.storage.from('weapon-icons').getPublicUrl(filePath);

    return { error: null, url: urlData.publicUrl };

  }



  // ============================================================
  // CHARACTER LINKING
  // ============================================================

  async function fetchLinkedCharacters(weaponId) {

    var client = SupaDB.getClient();
    if (!client) return [];

    var { data, error } = await client
      .from('weapon_characters')
      .select('*, characters(*)')
      .eq('weapon_id', weaponId)
      .order('priority', { ascending: true });

    if (error) {
      console.error('[WeaponDB] fetchLinkedCharacters error:', error.message);
      return [];
    }

    return data || [];

  }



  async function fetchWeaponsForCharacter(characterId) {

    var client = SupaDB.getClient();
    if (!client) return [];

    var { data, error } = await client
      .from('weapon_characters')
      .select('*, weapons(*)')
      .eq('character_id', characterId)
      .order('priority', { ascending: true });

    if (error) {
      console.error('[WeaponDB] fetchWeaponsForCharacter error:', error.message);
      return [];
    }

    return data || [];

  }



  async function linkCharacter(weaponId, characterId, opts) {

    var client = SupaDB.getClient();
    if (!client) {
      return { error: { message: 'Not connected' } };
    }

    var linkData = {
      weapon_id: weaponId,
      character_id: characterId,
      is_signature: (opts && opts.is_signature) || false,
      priority: (opts && opts.priority) || 0,
      notes_en: (opts && opts.notes_en) || null,
      notes_th: (opts && opts.notes_th) || null
    };

    var { data, error } = await client
      .from('weapon_characters')
      .upsert([linkData], { onConflict: 'weapon_id,character_id' })
      .select()
      .single();

    if (error) {
      console.error('[WeaponDB] linkCharacter error:', error.message);
    }

    return { data, error };

  }



  async function unlinkCharacter(weaponId, characterId) {

    var client = SupaDB.getClient();
    if (!client) {
      return { error: { message: 'Not connected' } };
    }

    var { error } = await client
      .from('weapon_characters')
      .delete()
      .eq('weapon_id', weaponId)
      .eq('character_id', characterId);

    if (error) {
      console.error('[WeaponDB] unlinkCharacter error:', error.message);
    }

    return { error };

  }



  async function unlinkAllCharacters(weaponId) {

    var client = SupaDB.getClient();
    if (!client) return;

    await client
      .from('weapon_characters')
      .delete()
      .eq('weapon_id', weaponId);

  }



  // ============================================================
  // BULK IMPORT
  // ============================================================

  async function bulkImport(weapons) {

    var client = SupaDB.getClient();
    if (!client) {
      return { error: { message: 'Not connected' } };
    }

    var sanitized = weapons.map(function (w) {

      var copy = Object.assign({}, w);

      delete copy.id;

      /* FIX FIELD */
      copy.name_en = copy.name_en || copy.name;
      delete copy.name;

      if (!copy.slug && copy.name_en) {
        copy.slug = copy.name_en
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '');
      }

      return copy;

    });


    var { data, error } = await client
      .from('weapons')
      .upsert(sanitized, { ignoreDuplicates: true })
      .select();

    if (error) {
      console.error('[WeaponDB] bulkImport error:', error.message);
    }

    return { data, error };

  }



  async function exportJSON(weapons) {

    var blob =
      new Blob([JSON.stringify(weapons, null, 2)], { type: 'application/json' });

    var url = URL.createObjectURL(blob);

    var a = document.createElement('a');

    a.href = url;
    a.download =
      'weapons-export-' +
      new Date().toISOString().slice(0, 10) +
      '.json';

    a.click();

    URL.revokeObjectURL(url);

  }



  // ============================================================
  // REALTIME
  // ============================================================

  function subscribeToChanges(callback) {

    var client = SupaDB.getClient();
    if (!client) return;

    client
      .channel('weapons-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'weapons' },
        function (payload) {

          console.log('[WeaponDB] Realtime event:', payload.eventType);

          callback(payload);

        }
      )
      .subscribe();

  }



  // ============================================================
  // PUBLIC API
  // ============================================================

  return {

    fetchAll: fetchAll,
    fetchBySlug: fetchBySlug,
    fetchByCategory: fetchByCategory,

    insert: insert,
    update: update,
    remove: remove,

    uploadIcon: uploadIcon,

    fetchLinkedCharacters: fetchLinkedCharacters,
    fetchWeaponsForCharacter: fetchWeaponsForCharacter,
    linkCharacter: linkCharacter,
    unlinkCharacter: unlinkCharacter,
    unlinkAllCharacters: unlinkAllCharacters,

    bulkImport: bulkImport,
    exportJSON: exportJSON,

    subscribeToChanges: subscribeToChanges

  };

})();

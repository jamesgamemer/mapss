/* ============================================================
   7DS ORIGIN - GUIDE CMS API MODULE
   Handles all guide CRUD, block management, and media uploads
   ============================================================ */

var GuideAPI = (function () {

  function _client() {
    return SupaDB.getClient();
  }

  // ============================================================
  // GUIDES CRUD
  // ============================================================

async function fetchAllGuides(statusFilter) {
  var client = _client();
  if (!client) return [];

  var query = client
    .from('guides')
    .select('*')
    .eq('status', statusFilter || 'published')
    .order('created_at', { ascending: false });

  var result = await query;

  if (result.error) {
    console.error('[GuideAPI] fetchAllGuides error:', result.error.message);
    return [];
  }

  return result.data || [];
}

  async function fetchGuideBySlug(slug) {
    var client = _client();
    if (!client) return null;
    var result = await client.from('guides').select('*').eq('slug', slug).single();
    if (result.error) {
      console.error('[GuideAPI] fetchGuideBySlug error:', result.error.message);
      return null;
    }
    return result.data;
  }

  async function fetchGuideById(id) {
    var client = _client();
    if (!client) return null;
    var result = await client.from('guides').select('*').eq('id', id).single();
    if (result.error) {
      console.error('[GuideAPI] fetchGuideById error:', result.error.message);
      return null;
    }
    return result.data;
  }

  async function createGuide(guideData) {
    var client = _client();
    if (!client) return { error: { message: 'Not connected' } };
    var slug = guideData.slug || guideData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    var payload = {
      title: guideData.title || 'Untitled Guide',
      slug: slug,
      description: guideData.description || '',
      cover_image: guideData.cover_image || '',
      category: guideData.category || 'general',
      status: guideData.status || 'draft'
    };
    var result = await client.from('guides').insert([payload]).select().single();
    if (result.error) console.error('[GuideAPI] createGuide error:', result.error.message);
    return result;
  }

  async function updateGuide(id, updates) {
    var client = _client();
    if (!client) return { error: { message: 'Not connected' } };
    var result = await client.from('guides').update(updates).eq('id', id).select().single();
    if (result.error) console.error('[GuideAPI] updateGuide error:', result.error.message);
    return result;
  }

  async function deleteGuide(id) {
    var client = _client();
    if (!client) return { error: { message: 'Not connected' } };
    var result = await client.from('guides').delete().eq('id', id);
    if (result.error) console.error('[GuideAPI] deleteGuide error:', result.error.message);
    return result;
  }

  // ============================================================
  // GUIDE BLOCKS CRUD
  // ============================================================

  async function fetchBlocks(guideId) {
    var client = _client();
    if (!client) return [];
    var result = await client.from('guide_blocks').select('*').eq('guide_id', guideId).order('position', { ascending: true });
    if (result.error) {
      console.error('[GuideAPI] fetchBlocks error:', result.error.message);
      return [];
    }
    return result.data || [];
  }

  async function insertBlock(blockData) {
    var client = _client();
    if (!client) return { error: { message: 'Not connected' } };
    var result = await client.from('guide_blocks').insert([blockData]).select().single();
    if (result.error) console.error('[GuideAPI] insertBlock error:', result.error.message);
    return result;
  }

  async function updateBlock(id, updates) {
    var client = _client();
    if (!client) return { error: { message: 'Not connected' } };
    var result = await client.from('guide_blocks').update(updates).eq('id', id).select().single();
    if (result.error) console.error('[GuideAPI] updateBlock error:', result.error.message);
    return result;
  }

  async function deleteBlock(id) {
    var client = _client();
    if (!client) return { error: { message: 'Not connected' } };
    var result = await client.from('guide_blocks').delete().eq('id', id);
    if (result.error) console.error('[GuideAPI] deleteBlock error:', result.error.message);
    return result;
  }

  async function saveAllBlocks(guideId, blocks) {
    var client = _client();
    if (!client) return { error: { message: 'Not connected' } };

    // Delete existing blocks for this guide
    await client.from('guide_blocks').delete().eq('guide_id', guideId);

    if (!blocks || blocks.length === 0) return { data: [], error: null };

    // Insert all blocks with correct positions
    var payload = blocks.map(function (b, i) {
      return {
        guide_id: guideId,
        type: b.type,
        content: b.content || {},
        position: i
      };
    });

    var result = await client.from('guide_blocks').insert(payload).select();
    if (result.error) console.error('[GuideAPI] saveAllBlocks error:', result.error.message);
    return result;
  }

  // ============================================================
  // MEDIA UPLOAD
  // ============================================================

  async function uploadMedia(file, guideId) {
    var client = _client();
    if (!client) return { error: { message: 'Not connected' }, url: null };

    var ext = file.name.split('.').pop() || 'png';
    var timestamp = Date.now();
    var safeName = file.name.replace(/[^a-z0-9.]/gi, '_');
    var mediaType = file.type.startsWith('video') ? 'video' : 'image';

var filePath =
 'guides/' +
 (guideId || 'general') +
 '/' +
 mediaType +
 '/' +
 timestamp +
 '_' +
 safeName;

    var uploadResult = await client.storage.from('guide-media').upload(filePath, file, {
      cacheControl: '3600',
      upsert: true
    });

    if (uploadResult.error) {
      console.error('[GuideAPI] uploadMedia error:', uploadResult.error.message);
      return { error: uploadResult.error, url: null };
    }

    var urlData = client.storage.from('guide-media').getPublicUrl(filePath);
    var publicUrl = urlData.data.publicUrl;

    // Record in media table
    var mediaType = file.type.startsWith('video') ? 'video' : 'image';
    await client.from('media').insert([{
      url: publicUrl,
      type: mediaType,
      filename: file.name,
      guide_id: guideId || null
    }]);

    return { error: null, url: publicUrl };
  }

  async function fetchMedia(guideId) {
    var client = _client();
    if (!client) return [];
    var query = client.from('media').select('*').order('created_at', { ascending: false });
    if (guideId) query = query.eq('guide_id', guideId);
    var result = await query;
    if (result.error) {
      console.error('[GuideAPI] fetchMedia error:', result.error.message);
      return [];
    }
    return result.data || [];
  }

  // ============================================================
  // PUBLIC API
  // ============================================================

  return {
    fetchAllGuides: fetchAllGuides,
    fetchGuideBySlug: fetchGuideBySlug,
    fetchGuideById: fetchGuideById,
    createGuide: createGuide,
    updateGuide: updateGuide,
    deleteGuide: deleteGuide,
    fetchBlocks: fetchBlocks,
    insertBlock: insertBlock,
    updateBlock: updateBlock,
    deleteBlock: deleteBlock,
    saveAllBlocks: saveAllBlocks,
    uploadMedia: uploadMedia,
    fetchMedia: fetchMedia
  };

})();

export function buildPublication(recipe, users, uploadId) {
  function id(username) {
    const profile = users.get(username);
    if (!profile || profile.username !== username || typeof profile.id !== 'string' || !/^[1-9]\d*$/.test(profile.id)) {
      throw new Error(`ID não confirmado para @${username}.`);
    }
    return profile.id;
  }
  const form = { upload_id: uploadId, caption: recipe.caption };
  if (recipe.kind === 'story') {
    Object.assign(form, { source_type: '4', configure_mode: '1' });
    if (recipe.mentions.length) form.reel_mentions = JSON.stringify(recipe.mentions.map((username, index) => ({
      user_id: id(username), x: 0.5,
      y: recipe.mentions.length === 1 ? 0.5 : 0.2 + index * 0.6 / (recipe.mentions.length - 1),
      width: 0.5, height: 0.1, rotation: 0,
    })));
    return { path: '/api/v1/media/configure_to_story/', form };
  }
  Object.assign(form, { media_share_flow: 'creation_flow', source_type: 'library',
    disable_comments: recipe.disableComments ? '1' : '0', like_and_view_counts_disabled: recipe.hideLikes ? '1' : '0' });
  const tagged = [...new Set([...recipe.mentions, ...recipe.collaborators])];
  if (tagged.length) form.usertags = JSON.stringify({ in: tagged.map(username => ({ user_id: id(username), position: [0.5, 0.5] })) });
  if (recipe.collaborators.length) form.invite_coauthor_user_ids_string = JSON.stringify(recipe.collaborators.map(id));
  return { path: '/api/v1/media/configure/', form };
}

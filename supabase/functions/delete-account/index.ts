import { getSupabaseEnv, handleCors, jsonResponse, requireAuthenticatedUser, requirePost } from '../_shared/http.ts';

const memoriesBucket = 'Memories';
const privateNotesBucket = 'private_notes';

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  const methodError = requirePost(req);
  if (methodError) return methodError;

  const { supabaseUrl, serviceRoleKey } = getSupabaseEnv();
  if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: 'Account deletion is not configured.' }, 501);

  const auth = await requireAuthenticatedUser(req, 'Sign in to delete your account.');
  if (!auth.ok) return auth.response;
  const { admin, user } = auth;
  const userId = user.id;

  const storagePaths = await collectStoragePaths(admin, userId, supabaseUrl);
  await removeStorageObjects(admin, memoriesBucket, storagePaths.memories);
  await removeStorageObjects(admin, privateNotesBucket, storagePaths.privateNotes);

  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) return jsonResponse({ error: deleteError.message }, 500);

  return jsonResponse({ ok: true });
});

async function collectStoragePaths(admin: any, userId: string, supabaseUrl: string) {
  const memories = new Set<string>();
  const privateNotes = new Set<string>();

  const { data: profile } = await admin
    .from('profiles')
    .select('avatar_path, profile_bg_image_path')
    .eq('id', userId)
    .maybeSingle();
  addMaybeStoragePath(memories, supabaseUrl, memoriesBucket, profile?.avatar_path);
  addMaybeStoragePath(memories, supabaseUrl, memoriesBucket, profile?.profile_bg_image_path);

  const { data: contacts } = await admin
    .from('contacts')
    .select('avatar_path, avatar_video_path, profile_bg_image_path')
    .eq('owner_user_id', userId);
  for (const contact of contacts ?? []) {
    addMaybeStoragePath(memories, supabaseUrl, memoriesBucket, contact.avatar_path);
    addMaybeStoragePath(memories, supabaseUrl, memoriesBucket, contact.avatar_video_path);
    addMaybeStoragePath(memories, supabaseUrl, memoriesBucket, contact.profile_bg_image_path);
  }

  const { data: wallPosts } = await admin
    .from('wall_posts')
    .select('image_path, video_path')
    .eq('author_user_id', userId);
  for (const post of wallPosts ?? []) {
    addMaybeStoragePath(memories, supabaseUrl, memoriesBucket, post.image_path);
    addMaybeStoragePath(memories, supabaseUrl, memoriesBucket, post.video_path);
  }

  const { data: privateBlocks } = await admin
    .from('contact_private_note_blocks')
    .select('image_path')
    .eq('owner_user_id', userId);
  for (const block of privateBlocks ?? []) {
    addMaybeStoragePath(privateNotes, supabaseUrl, privateNotesBucket, block.image_path);
  }

  const privateNoteFolderObjects = await listStorageFolder(admin, privateNotesBucket, userId);
  for (const path of privateNoteFolderObjects) privateNotes.add(path);

  return { memories: [...memories], privateNotes: [...privateNotes] };
}

async function listStorageFolder(admin: any, bucket: string, folder: string) {
  const paths: string[] = [];
  const { data } = await admin.storage.from(bucket).list(folder, { limit: 1000 });
  for (const item of data ?? []) {
    if (item.name) paths.push(`${folder}/${item.name}`);
  }
  return paths;
}

async function removeStorageObjects(admin: any, bucket: string, paths: string[]) {
  if (paths.length === 0) return;
  for (let i = 0; i < paths.length; i += 100) {
    await admin.storage.from(bucket).remove(paths.slice(i, i + 100));
  }
}

function addMaybeStoragePath(paths: Set<string>, supabaseUrl: string, bucket: string, value: unknown) {
  const path = getStorageObjectPath(supabaseUrl, bucket, value);
  if (path) paths.add(path);
}

function getStorageObjectPath(supabaseUrl: string, bucket: string, value: unknown) {
  if (typeof value !== 'string' || value.length === 0) return null;
  const marker = `/storage/v1/object/public/${bucket}/`;
  const index = value.indexOf(marker);
  if (index >= 0) return decodeURIComponent(value.slice(index + marker.length));
  const signedMarker = `/storage/v1/object/sign/${bucket}/`;
  const signedIndex = value.indexOf(signedMarker);
  if (signedIndex >= 0) return decodeURIComponent(value.slice(signedIndex + signedMarker.length).split('?')[0]);
  if (!value.startsWith('http') && !value.startsWith('file:')) return value;
  if (supabaseUrl && value.startsWith(supabaseUrl)) return null;
  return null;
}


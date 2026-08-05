/**
 * File plumbing. Diary photos go to the public `site-photos` bucket (they
 * appear in <img> tags); contracts, receipts and plans go to the private
 * `documents` bucket and are opened through short-lived signed URLs, so a
 * leaked link dies within the hour.
 */
import { sb } from "./supabase";

const clean = (n) => n.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);

export async function uploadPhoto(file) {
  const path = `diary/${crypto.randomUUID()}-${clean(file.name)}`;
  const { error } = await sb.storage
    .from("site-photos")
    .upload(path, file, { cacheControl: "31536000", contentType: file.type });
  if (error) throw error;
  return sb.storage.from("site-photos").getPublicUrl(path).data.publicUrl;
}

/** folder: a unit id (owner-readable) or `shared/<project_id>` (all owners). */
export async function uploadDoc(file, folder) {
  const path = `${folder}/${crypto.randomUUID()}-${clean(file.name)}`;
  const { error } = await sb.storage
    .from("documents")
    .upload(path, file, { contentType: file.type });
  if (error) throw error;
  return path;
}

export async function openDoc(path) {
  const { data, error } = await sb.storage.from("documents").createSignedUrl(path, 3600);
  if (error) throw error;
  window.open(data.signedUrl, "_blank", "noreferrer");
}

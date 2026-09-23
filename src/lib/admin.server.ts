// This file is server-only.
// Single-admin access control: the admin is the Supabase Auth user whose email
// matches ADMIN_EMAIL. Clients pass their session access token; we verify it
// with Supabase rather than trusting anything the browser says about itself.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function adminEmail(): string | null {
  return process.env.ADMIN_EMAIL?.trim().toLowerCase() || null;
}

export async function isAdmin(accessToken: string | null | undefined): Promise<boolean> {
  const expected = adminEmail();
  if (!expected || !accessToken) return false;
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data.user?.email) return false;
  return data.user.email.toLowerCase() === expected;
}

export async function requireAdmin(accessToken: string | null | undefined): Promise<void> {
  if (!adminEmail()) throw new Error("Admin actions are disabled: ADMIN_EMAIL is not set.");
  if (!(await isAdmin(accessToken))) throw new Error("Only the admin can do this. Please sign in.");
}

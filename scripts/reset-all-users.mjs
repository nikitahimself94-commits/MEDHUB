#!/usr/bin/env node

/**
 * Full user + data reset for MedHUB.
 * Deletes ALL users, profiles, patients, and all associated data.
 * After execution: 0 users, 0 patients, 0 records.
 *
 * Usage:
 *   node scripts/reset-all-users.mjs
 *
 * Requires .env.local with:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

// --- Load .env.local ---
const envPath = resolve(process.cwd(), ".env.local");
const envContent = readFileSync(envPath, "utf-8");
const env = {};
for (const line of envContent.split("\n")) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim();
}

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log("=== MedHUB Full User Reset ===\n");

  // 1. Delete medication_intakes (no cascade on patient_id)
  const { error: e1 } = await supabase.from("medication_intakes").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  log("medication_intakes", e1);

  // 2. Delete storage objects in documents bucket
  const { data: bucketFiles } = await supabase.storage.from("documents").list("", { limit: 1000 });
  if (bucketFiles && bucketFiles.length > 0) {
    // List all files recursively per folder
    let allFiles = [];
    for (const item of bucketFiles) {
      if (item.id) {
        // It's a file at root
        allFiles.push(item.name);
      } else {
        // It's a folder — list contents
        const { data: folderFiles } = await supabase.storage.from("documents").list(item.name, { limit: 1000 });
        if (folderFiles) {
          for (const f of folderFiles) {
            allFiles.push(`${item.name}/${f.name}`);
          }
        }
      }
    }
    if (allFiles.length > 0) {
      const { error: storageErr } = await supabase.storage.from("documents").remove(allFiles);
      console.log(`  storage/documents: ${storageErr ? "ERROR " + storageErr.message : allFiles.length + " files deleted"}`);
    } else {
      console.log("  storage/documents: empty");
    }
  } else {
    console.log("  storage/documents: empty or inaccessible");
  }

  // 3. Delete all patients (cascades to: profiles, medical_profile, diary_entries,
  //    documents, medications, vitals, timeline_events, emotion_entries,
  //    ai_chat_messages, doctor_visit_preps, ai_usage_events, doctor_share_links,
  //    document_parses, document_opinions)
  const { error: e3 } = await supabase.from("patients").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  log("patients (+ all cascaded data)", e3);

  // 4. Delete any orphaned profiles (without patient_id)
  const { error: e4 } = await supabase.from("profiles").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  log("orphaned profiles", e4);

  // 5. Delete all auth users via admin API
  const { data: authUsers, error: listErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (listErr) {
    console.error(`  auth.users: ERROR listing - ${listErr.message}`);
  } else {
    const users = authUsers?.users ?? [];
    console.log(`  auth.users: found ${users.length}`);
    let deleted = 0;
    for (const user of users) {
      const { error: delErr } = await supabase.auth.admin.deleteUser(user.id);
      if (delErr) {
        console.error(`    FAILED to delete ${user.email ?? user.id}: ${delErr.message}`);
      } else {
        deleted++;
      }
    }
    console.log(`  auth.users: ${deleted} deleted`);
  }

  // 6. Verify
  console.log("\n=== Verification ===");
  const { count: profileCount } = await supabase.from("profiles").select("id", { count: "exact", head: true });
  const { count: patientCount } = await supabase.from("patients").select("id", { count: "exact", head: true });
  const { count: diaryCount } = await supabase.from("diary_entries").select("id", { count: "exact", head: true });
  const { count: vitalsCount } = await supabase.from("vitals").select("id", { count: "exact", head: true });
  const { count: medsCount } = await supabase.from("medications").select("id", { count: "exact", head: true });
  const { count: docsCount } = await supabase.from("documents").select("id", { count: "exact", head: true });
  const { count: emotionCount } = await supabase.from("emotion_entries").select("id", { count: "exact", head: true });
  const { count: intakeCount } = await supabase.from("medication_intakes").select("id", { count: "exact", head: true });
  const { data: remainingUsers } = await supabase.auth.admin.listUsers({ perPage: 1 });

  console.log(`  auth.users:          ${remainingUsers?.users?.length ?? "?"}`);
  console.log(`  profiles:            ${profileCount ?? "?"}`);
  console.log(`  patients:            ${patientCount ?? "?"}`);
  console.log(`  diary_entries:       ${diaryCount ?? "?"}`);
  console.log(`  vitals:              ${vitalsCount ?? "?"}`);
  console.log(`  medications:         ${medsCount ?? "?"}`);
  console.log(`  documents:           ${docsCount ?? "?"}`);
  console.log(`  emotion_entries:     ${emotionCount ?? "?"}`);
  console.log(`  medication_intakes:  ${intakeCount ?? "?"}`);

  console.log("\n=== Done ===");
}

function log(table, error) {
  console.log(`  ${table}: ${error ? "ERROR " + error.message : "cleared"}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

// End-to-end flow test against local Supabase (patient, doctor, admin + RLS checks)
// Run: npm run test:e2e   (needs `npx supabase start`; resets nothing — run `npx supabase db reset` afterwards for a clean DB)
import { createClient } from "@supabase/supabase-js";
const URL = "http://127.0.0.1:58321";
const KEY = process.env.ANON ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
async function login(phone) {
  const sb = createClient(URL, KEY, { auth: { persistSession: false } });
  await sb.auth.signInWithOtp({ phone });
  const { data, error } = await sb.auth.verifyOtp({ phone, token: "123456", type: "sms" });
  if (error) throw error;
  return { sb, id: data.user.id };
}
const today = new Date().toISOString().slice(0, 10);
const daysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);

const P = await login("+919999900001"), D = await login("+919999900002"), A = await login("+919999900009"), X = await login("+919999900003");

// Patient onboarding + tracker
ok(!(await P.sb.from("profiles").update({ full_name: "Priya Test", onboarded_at: new Date().toISOString(), goal_mode: "pcod" }).eq("id", P.id)).error, "patient onboards");
ok(!!(await P.sb.from("profiles").update({ role: "admin" }).eq("id", P.id)).error, "patient CANNOT make herself admin");
await P.sb.from("cycle_profiles").upsert({ user_id: P.id, avg_cycle_length: 30, last_period_start: daysAgo(10) });
for (const d of [daysAgo(72), daysAgo(40), daysAgo(10)]) await P.sb.from("periods").upsert({ user_id: P.id, start_date: d, end_date: d }, { onConflict: "user_id,start_date" });
ok(!(await P.sb.from("daily_logs").upsert({ user_id: P.id, log_date: today, flow: "none", symptoms: ["acne", "bloating"], mood: "calm" }, { onConflict: "user_id,log_date" })).error, "patient saves daily log");
ok(((await X.sb.from("daily_logs").select("*").eq("user_id", P.id)).data ?? []).length === 0, "another user CANNOT read patient's logs");

// Doctor applies, cannot self-verify
const app = await D.sb.from("doctors").insert({ user_id: D.id, full_name: "Dr. Test Doc", qualification: "MBBS, MS OBG", registration_number: "TEST-1", medical_council: "DMC", verification_status: "verified" }).select().single();
ok(!app.error && app.data.verification_status === "pending", "doctor application forced to pending");
await D.sb.from("profiles").update({ onboarded_at: new Date().toISOString(), full_name: "Test Doc" }).eq("id", D.id);
ok(!!(await D.sb.rpc("review_doctor", { p_doctor: app.data.id, p_approve: true })).error, "doctor CANNOT approve self");

// Admin (promote via service role = SQL editor equivalent)
const svc = createClient(URL, process.env.SERVICE ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU", { auth: { persistSession: false } });
await svc.from("profiles").update({ role: "admin" }).eq("id", A.id);
ok(!(await A.sb.rpc("review_doctor", { p_doctor: app.data.id, p_approve: true, p_note: "Verified on NMC" })).error, "admin approves doctor");
ok((await D.sb.from("profiles").select("role").eq("id", D.id).single()).data.role === "doctor", "doctor's role became 'doctor'");
ok(!(await D.sb.from("doctor_availability").insert({ doctor_id: app.data.id, weekday: 1, start_time: "10:00", end_time: "12:00" })).error, "doctor sets availability");

// Booking
const slot = new Date(Date.now() + 2 * 864e5); slot.setHours(10, 0, 0, 0);
const bad = await P.sb.from("appointments").insert({ user_id: P.id, doctor_id: app.data.id, scheduled_at: slot.toISOString() });
ok(!!bad.error, "booking without consent is rejected");
const appt = await P.sb.from("appointments").insert({ user_id: P.id, doctor_id: app.data.id, scheduled_at: slot.toISOString(), context: "pcod", consent_at: new Date().toISOString(), pre_consult: { symptoms: "Irregular cycles" }, shared_snapshot: { avg_cycle_length: 31 } }).select().single();
ok(!appt.error && appt.data.meeting_url.startsWith("https://meet.jit.si/"), "patient books, gets free video room");
ok(!!(await X.sb.from("appointments").insert({ user_id: X.id, doctor_id: app.data.id, scheduled_at: slot.toISOString(), consent_at: new Date().toISOString() })).error, "double booking same slot blocked");
ok(((await X.sb.rpc("get_booked_slots", { p_doctor: app.data.id, p_from: new Date().toISOString(), p_to: new Date(Date.now() + 9e8).toISOString() })).data ?? []).length === 1, "others see slot as taken (not who booked)");

// Doctor side
ok(((await D.sb.from("daily_logs").select("*").eq("user_id", P.id)).data ?? []).length === 1, "treating doctor can read patient's logs");
ok(((await D.sb.from("daily_logs").select("*").eq("user_id", X.id)).data ?? []).length === 0, "doctor CANNOT read non-patient's logs");
ok(!(await D.sb.from("consultation_notes").insert({ appointment_id: appt.data.id, doctor_id: app.data.id, user_id: P.id, diagnosis: "Suspected PCOS", private_notes: "secret" })).error, "doctor writes notes");
ok(!(await D.sb.from("prescriptions").insert({ appointment_id: appt.data.id, doctor_id: app.data.id, user_id: P.id, medicines: [{ name: "Metformin", dose: "500mg", frequency: "1-0-1", duration: "30 days" }] })).error, "doctor issues prescription");
ok(!(await D.sb.from("notifications").insert({ user_id: P.id, kind: "appointment", title: "Summary ready" })).error, "doctor notifies patient");
ok(!(await D.sb.from("appointments").update({ status: "completed" }).eq("id", appt.data.id)).error, "doctor completes consult");

// Patient reads results
const notes = (await P.sb.from("my_consultation_notes").select("*").eq("appointment_id", appt.data.id).single()).data;
ok(notes?.diagnosis === "Suspected PCOS" && !("private_notes" in notes), "patient sees notes WITHOUT doctor's private notes");
ok(((await P.sb.from("health_records").select("*").eq("record_type", "prescription")).data ?? []).length === 1, "prescription auto-added to health records");
ok(!(await P.sb.from("reviews").insert({ appointment_id: appt.data.id, user_id: P.id, doctor_id: app.data.id, rating: 5 })).error, "patient rates doctor");
ok(Number((await P.sb.from("doctors").select("rating_avg").eq("id", app.data.id).single()).data.rating_avg) === 5, "doctor rating updated");

// PCOD plan
const plan = (await P.sb.from("care_plans").select("id").eq("slug", "pcod-3m").single()).data;
const enr = await P.sb.from("plan_enrollments").insert({ user_id: P.id, plan_id: plan.id, end_date: daysAgo(-90) }).select().single();
ok(!enr.error, "patient enrolls in PCOD plan");
ok(!(await P.sb.from("plan_checkins").insert({ enrollment_id: enr.data.id, user_id: P.id, diet_done: true })).error, "plan check-in saved");
ok(!(await D.sb.from("plan_adjustments").insert({ enrollment_id: enr.data.id, doctor_id: app.data.id, note: "Walk 40 min" })).error, "doctor adds plan adjustment");

// Admin analytics + content; deletion
ok(((await A.sb.from("profiles").select("id")).data ?? []).length >= 4, "admin lists users");
ok(((await A.sb.from("daily_logs").select("*")).data ?? []).length === 0, "admin CANNOT read raw health logs (privacy)");
ok(!(await X.sb.rpc("delete_my_account")).error, "user deletes own account");
ok(!(await svc.from("profiles").select("id").eq("id", X.id).maybeSingle()).data, "deleted user's data is gone");

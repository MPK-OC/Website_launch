"use client";
import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useUser } from "./UserProvider";
import { Button, cx, Input } from "./ui";

interface Msg { id: string; sender_id: string; body: string; created_at: string }

/** Low-bandwidth chat for a consultation. Polls every 4s (Supabase Realtime can replace polling later). */
export function Chat({ appointmentId, disabled }: { appointmentId: string; disabled?: boolean }) {
  const { user } = useUser();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    const load = () => supabase().from("messages").select("*").eq("appointment_id", appointmentId).order("created_at")
      .then(({ data }) => alive && setMsgs((data ?? []) as Msg[]));
    load();
    const t = setInterval(load, 4000);
    return () => { alive = false; clearInterval(t); };
  }, [appointmentId]);

  useEffect(() => bottom.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), [msgs.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || !user) return;
    setText("");
    const { data } = await supabase().from("messages").insert({ appointment_id: appointmentId, sender_id: user.id, body }).select().single();
    if (data) setMsgs((m) => [...m, data as Msg]);
  }

  return (
    <div className="flex h-80 flex-col rounded-xl border border-ova-100">
      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {msgs.length === 0 && <p className="py-10 text-center text-sm text-slate-400">No messages yet.</p>}
        {msgs.map((m) => (
          <div key={m.id} className={cx("max-w-[80%] rounded-2xl px-3 py-2 text-sm", m.sender_id === user?.id ? "ml-auto bg-ova-600 text-white" : "bg-ova-50 text-ova-900")}>
            {m.body}
            <span className="mt-0.5 block text-[10px] opacity-60">{new Date(m.created_at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}</span>
          </div>
        ))}
        <div ref={bottom} />
      </div>
      {!disabled && (
        <form onSubmit={send} className="flex gap-2 border-t border-ova-100 p-2">
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message…" />
          <Button type="submit" aria-label="Send"><Send className="size-4" /></Button>
        </form>
      )}
    </div>
  );
}

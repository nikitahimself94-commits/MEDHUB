import { getSessionPatient } from "@/lib/get-patient-id";
import { ModuleHelp } from "@/components/module-help";
import { TimelineForm } from "./timeline-form";
import { UnifiedFeed } from "./unified-feed";
import type { FeedItem } from "./unified-feed";

const EVENT_LABELS: Record<string, string> = {
  doctor_visit: "Визит к врачу",
  analysis: "Анализ",
  procedure: "Процедура",
  hospitalization: "Госпитализация",
  treatment_change: "Изменение лечения",
  other: "Другое",
};

export default async function TimelinePage() {
  const { patientId, supabase } = await getSessionPatient();

  // Parallel fetch from all 6 sources
  const [
    { data: events },
    { data: diaryEntries },
    { data: vitals },
    { data: intakes },
    { data: documents },
    { data: emotions },
  ] = await Promise.all([
    supabase
      .from("timeline_events")
      .select("id, event_type, event_date, title, notes")
      .eq("patient_id", patientId)
      .order("event_date", { ascending: false })
      .limit(100),
    supabase
      .from("diary_entries")
      .select("id, created_at, wellbeing_score, symptoms, notes")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("vitals")
      .select("id, vital_type, value, unit, measured_at")
      .eq("patient_id", patientId)
      .order("measured_at", { ascending: false })
      .limit(50),
    supabase
      .from("medication_intakes")
      .select("id, taken_at, medication_id, medications(name)")
      .eq("patient_id", patientId)
      .order("taken_at", { ascending: false })
      .limit(50),
    supabase
      .from("documents")
      .select("id, title, category, document_date, created_at")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("emotion_entries")
      .select("id, created_at, anxiety, depression, fatigue, hope")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const VITAL_LABELS: Record<string, string> = {
    blood_pressure: "Давление",
    pulse: "Пульс",
    temperature: "Температура",
    spo2: "SpO2",
    weight: "Вес",
    glucose: "Глюкоза",
  };

  // Normalize into unified feed
  const feed: FeedItem[] = [];

  // Manual timeline events
  for (const ev of events ?? []) {
    feed.push({
      id: `event-${ev.id}`,
      source: "event",
      occurred_at: ev.event_date + "T00:00:00Z",
      title: ev.title,
      subtitle: EVENT_LABELS[ev.event_type] ?? ev.event_type,
      href: null,
      deletable: true,
    });
  }

  // Diary entries
  for (const d of diaryEntries ?? []) {
    const symptoms = (d.symptoms as string[] | null)?.slice(0, 2).join(", ");
    feed.push({
      id: `diary-${d.id}`,
      source: "diary",
      occurred_at: d.created_at,
      title: `Самочувствие ${d.wellbeing_score}/10`,
      subtitle: symptoms || d.notes?.slice(0, 60) || null,
      href: "/diary",
    });
  }

  // Vitals
  for (const v of vitals ?? []) {
    feed.push({
      id: `vitals-${v.id}`,
      source: "vitals",
      occurred_at: v.measured_at,
      title: `${VITAL_LABELS[v.vital_type] ?? v.vital_type}: ${v.value}${v.unit ? " " + v.unit : ""}`,
      subtitle: null,
      href: "/vitals",
    });
  }

  // Medication intakes
  for (const i of intakes ?? []) {
    const meds = i.medications as unknown as { name: string } | { name: string }[] | null;
    const medName = Array.isArray(meds) ? meds[0]?.name ?? "Лекарство" : meds?.name ?? "Лекарство";
    feed.push({
      id: `med-${i.id}`,
      source: "medications",
      occurred_at: i.taken_at,
      title: `Приём: ${medName}`,
      subtitle: null,
      href: "/medications",
    });
  }

  // Documents
  for (const doc of documents ?? []) {
    feed.push({
      id: `doc-${doc.id}`,
      source: "documents",
      occurred_at: doc.document_date ? `${doc.document_date}T00:00:00Z` : doc.created_at,
      title: doc.title,
      subtitle: doc.category || null,
      href: "/documents",
    });
  }

  // Emotion entries
  for (const e of emotions ?? []) {
    feed.push({
      id: `emo-${e.id}`,
      source: "emotions",
      occurred_at: e.created_at,
      title: `Тревога ${e.anxiety}, усталость ${e.fatigue}, надежда ${e.hope}`,
      subtitle: null,
      href: "/emotions",
    });
  }

  // Sort unified feed by date descending
  feed.sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());

  return (
    <div>
      <h2 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Хронология</h2>
      <div className="mt-3">
        <ModuleHelp
          title="Единая хронология"
          description="Все медицинские события, записи дневника, показатели, приёмы лекарств, документы и эмоции в одном потоке."
          benefit="Полная картина помогает видеть связи между событиями и не упустить важное при общении с врачом."
        />
      </div>

      <div className="mt-6">
        <TimelineForm />
      </div>

      <div className="mt-8">
        <UnifiedFeed items={feed} />
      </div>
    </div>
  );
}

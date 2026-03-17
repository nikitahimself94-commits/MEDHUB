import { getSessionPatient } from "@/lib/get-patient-id";
import { ModuleHelp } from "@/components/module-help";
import type { TimelineEvent } from "@/types/database";
import { TimelineForm } from "./timeline-form";
import { DeleteEventButton } from "./delete-event-button";

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

  const { data } = await supabase
    .from("timeline_events")
    .select("*")
    .eq("patient_id", patientId)
    .order("event_date", { ascending: false })
    .limit(100);

  const events: TimelineEvent[] = data ?? [];

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900">Хронология</h2>
      <div className="mt-3">
        <ModuleHelp
          title="Хронология медицинских событий"
          description="Фиксируйте визиты к врачам, анализы, процедуры, госпитализации и изменения в лечении."
          benefit="Полная история событий помогает видеть путь лечения целиком и ничего не упустить при общении с врачом."
        />
      </div>

      <div className="mt-6">
        <TimelineForm />
      </div>

      <div className="mt-8">
        {events.length === 0 && (
          <p className="text-sm text-gray-500">Событий пока нет</p>
        )}

        {events.length > 0 && (
          <div className="space-y-3">
            {events.map((ev) => (
              <EventCard key={ev.id} event={ev} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EventCard({ event }: { event: TimelineEvent }) {
  const label = EVENT_LABELS[event.event_type] ?? event.event_type;

  const formattedDate = new Date(event.event_date + "T00:00:00").toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="rounded-xl card p-4">
      <div className="flex items-baseline justify-between">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            {label}
          </span>
          <span className="text-lg font-medium text-gray-900">
            {event.title}
          </span>
        </div>
        <DeleteEventButton eventId={event.id} />
      </div>

      <div className="mt-1 text-xs text-gray-400">
        {formattedDate}
      </div>

      {event.notes && (
        <p className="mt-2 text-sm text-gray-700">{event.notes}</p>
      )}
    </div>
  );
}

import { getSessionPatient } from "@/lib/get-patient-id";
import { ModuleHelp } from "@/components/module-help";
import { MedicalProfileForm } from "./medical-profile-form";

export default async function ProfilePage() {
  const { patientId, supabase } = await getSessionPatient();

  const { data: medicalProfile } = await supabase
    .from("medical_profile")
    .select("*")
    .eq("patient_id", patientId)
    .maybeSingle();

  return (
    <div>
      <h2 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Медицинская карточка</h2>
      <div className="mt-3">
        <ModuleHelp
          title="Ваш медицинский профиль"
          description="Здесь хранятся ваши основные медицинские данные: группа крови, хронические заболевания, аллергии и экстренная информация."
          benefit="Эта информация помогает врачам и AI-ассистенту учитывать вашу индивидуальную картину при анализе данных."
        />
      </div>
      <MedicalProfileForm initialData={medicalProfile} />
    </div>
  );
}

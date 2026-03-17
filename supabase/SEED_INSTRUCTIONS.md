# Настройка пользователей MedHub

Применить миграции в порядке:
1. `00001_create_profiles.sql`
2. `00002_create_patients.sql`

## Шаг 1: Создать пациента

В SQL Editor Supabase:

```sql
insert into public.patients (display_name)
values ('Мама');
```

Запомните `id` созданной записи (виден в Table Editor → patients).

## Шаг 2: Создать пользователей

В Authentication → Users → Add User:

1. Пациент: `mama@medhub.local` + пароль
2. Опекун: `nikita@medhub.local` + пароль

Trigger автоматически создаст записи в `profiles`.

## Шаг 3: Привязать профили к пациенту

В SQL Editor:

```sql
-- Посмотреть id пациента и user_id профилей
select id from public.patients;
select id, user_id, role, display_name from public.profiles;

-- Привязать обоих пользователей к одному пациенту
update public.profiles
set patient_id = '<patient_id>', role = 'patient', display_name = 'Мама'
where user_id = '<mama_user_id>';

update public.profiles
set patient_id = '<patient_id>', role = 'guardian', display_name = 'Никита'
where user_id = '<nikita_user_id>';
```

После этого оба пользователя работают с одной общей медицинской карточкой.

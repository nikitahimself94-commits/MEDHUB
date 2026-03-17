# Setup & Smoke Test

## 1. Создать Supabase-проект

1. Зайти на [supabase.com](https://supabase.com) → New Project
2. Запомнить:
   - Project URL (`https://xxx.supabase.co`)
   - Anon public key (Settings → API → `anon` `public`)
   - Service role key (Settings → API → `service_role`) — пока не используется, но сохранить

## 2. Отключить email confirmation

**Без этого пользователи не смогут залогиниться.**

Authentication → Providers → Email → отключить **Confirm email**.

## 3. Применить миграции

В SQL Editor выполнить последовательно:

1. Содержимое `supabase/migrations/00001_create_profiles.sql`
2. Содержимое `supabase/migrations/00002_create_patients.sql`

## 4. Создать пациента

```sql
insert into public.patients (display_name) values ('Мама');
```

Скопировать `id` из результата (или из Table Editor → patients).

## 5. Создать пользователей

Authentication → Users → Add User:

| Email | Password | Назначение |
|---|---|---|
| mama@medhub.local | (ваш пароль) | Пациент |
| nikita@medhub.local | (ваш пароль) | Опекун |

Trigger автоматически создаст записи в `profiles`.

## 6. Привязать профили к пациенту

```sql
-- Получить id
select id from public.patients;
select user_id, display_name from public.profiles;

-- Привязать обоих к одному пациенту
update public.profiles
set patient_id = '<patient_id>', role = 'patient', display_name = 'Мама'
where user_id = '<mama_user_id>';

update public.profiles
set patient_id = '<patient_id>', role = 'guardian', display_name = 'Никита'
where user_id = '<nikita_user_id>';
```

## 7. Настроить .env.local

```bash
cp .env.example .env.local
```

Заполнить:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

## 8. Запустить локально

```bash
npm run dev
```

Открыть http://localhost:3000

## 9. Smoke Test

### Test 1: Неавторизованный доступ
- Открыть `/profile` → должен редиректить на `/login`
- Открыть `/diary` → редирект на `/login`
- Открыть `/` → видна главная с кнопкой «Войти»

### Test 2: Login как пациент
- Перейти на `/login`
- Ввести mama@medhub.local + пароль
- Ожидание: редирект на `/profile`, в хедере «Мама» с бейджом «Пациент»
- Навигация: Карточка / Дневник / Документы / Лекарства — все открываются

### Test 3: Logout
- Нажать «Выйти» → редирект на `/login`
- Попробовать `/profile` → редирект на `/login`

### Test 4: Login как опекун
- Ввести nikita@medhub.local + пароль
- Ожидание: редирект на `/profile`, «Никита» с бейджом «Опекун»
- Те же разделы доступны — одинаковый доступ

### Test 5: Профиль без patient_id
- Создать третьего пользователя в Supabase (без привязки к пациенту)
- Залогиниться → экран «Профиль не привязан к пациенту» с кнопкой «Выйти»

### Test 6: Повторный визит
- Залогиниться → закрыть вкладку → открыть `/profile` заново
- Ожидание: сессия сохранена, dashboard открывается без повторного логина

## Возможные ошибки

| Проблема | Причина | Решение |
|---|---|---|
| `Invalid login credentials` | Email confirmation включена | Отключить: Authentication → Providers → Email → Confirm email: OFF |
| Пустой экран на dashboard | Миграции не применены | Проверить, что обе миграции выполнены в SQL Editor |
| «Профиль не привязан» | patient_id не проставлен | Выполнить шаг 6 |
| `NEXT_PUBLIC_SUPABASE_URL` ошибка | .env.local не создан | Выполнить шаг 7 |

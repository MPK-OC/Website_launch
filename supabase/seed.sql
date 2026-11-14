-- Ova Cure — seed data for local testing
-- Runs automatically on `npx supabase db reset`.

-- ---------------- PCOD care plans ----------------
insert into public.care_plans (slug, title, description, duration_months, price_inr, consults_included, includes) values
('pcod-3m', 'PCOD Reset — 3 months',
 'A guided 12-week programme: gynaecologist consults, Indian low-GI diet plan, home workouts and weekly progress tracking.',
 3, 2999, 2,
 '{"Initial gynaecologist consultation","1 follow-up consultation","Personalised low-GI Indian diet plan","Progressive home fitness plan","Weekly progress tracking","Check-in reminders & streaks"}'),
('pcod-6m', 'PCOD Balance — 6 months',
 'A 24-week programme for lasting change, with doctor-approved plan adjustments at every follow-up.',
 6, 4999, 4,
 '{"Initial gynaecologist consultation","3 follow-up consultations","Personalised low-GI Indian diet plan","Progressive home fitness plan","Doctor-approved plan adjustments","Weekly progress tracking","Check-in reminders & streaks"}');

-- ---------------- Demo doctors (is_demo = true: remove before launch) ----------------
insert into public.doctors (id, full_name, gender, qualification, registration_number, medical_council, experience_years,
                            languages, specialties, consultation_fee, bio, verification_status, verified_at, is_demo, rating_avg, rating_count)
values
('11111111-1111-1111-1111-111111111111', 'Dr. Ananya Sharma (Demo)', 'female', 'MBBS, MS (Obstetrics & Gynaecology)', 'DMC-DEMO-0001', 'Delhi Medical Council', 11,
 '{English,Hindi}', '{period,pcod,ttc}', 499,
 'Gynaecologist with a focus on PCOD, irregular cycles and preconception care.', 'verified', now(), true, 4.8, 126),
('22222222-2222-2222-2222-222222222222', 'Dr. Meera Iyer (Demo)', 'female', 'MBBS, DNB (OBG), Menopause Society certified', 'MMC-DEMO-0002', 'Maharashtra Medical Council', 18,
 '{English,Hindi,Tamil}', '{menopause,period,general}', 699,
 'Menopause and mid-life women''s health specialist.', 'verified', now(), true, 4.9, 88),
('33333333-3333-3333-3333-333333333333', 'Dr. Rahul Verma (Demo)', 'male', 'MBBS, DGO', 'PMC-DEMO-0003', 'Punjab Medical Council', 7,
 '{English,Hindi,Punjabi}', '{general,ttc,pcod}', 399,
 'Fertility awareness, conception planning and general gynaecology.', 'verified', now(), true, 4.6, 41);

-- Mon–Sat 10:00–13:00 and 17:00–19:00, 20 minute slots
insert into public.doctor_availability (doctor_id, weekday, start_time, end_time, slot_minutes)
select d.id, w, t.s, t.e, 20
from (values ('11111111-1111-1111-1111-111111111111'::uuid), ('22222222-2222-2222-2222-222222222222'::uuid), ('33333333-3333-3333-3333-333333333333'::uuid)) d(id)
cross join generate_series(1, 6) w
cross join (values ('10:00'::time, '13:00'::time), ('17:00'::time, '19:00'::time)) t(s, e);

-- ---------------- Articles (placeholder copy — must be medically reviewed before launch) ----------------
insert into public.articles (slug, title, summary, body, category, segments, cover_emoji, read_minutes, reviewed_by, published) values
('understanding-your-cycle', 'Understanding your menstrual cycle',
 'The four phases of your cycle and what they mean for your body.',
 'Your menstrual cycle is counted from the first day of one period to the first day of the next. A typical cycle is anywhere between 21 and 35 days.

## The four phases
**Menstrual (day 1–5):** the uterine lining sheds. Oestrogen and progesterone are at their lowest, so energy may be low.

**Follicular (day 1–13):** oestrogen rises as follicles grow in the ovary. Many people feel more energetic and social.

**Ovulatory (around day 14 in a 28-day cycle):** an egg is released. This is the most fertile time.

**Luteal (day 15–28):** progesterone rises. If pregnancy does not happen, both hormones fall, which can bring PMS symptoms like bloating, cravings and mood changes.

## Why tracking helps
Logging your period and symptoms helps you spot patterns, predict your next period and gives your doctor useful information.',
 'basics', '{track,pcod,ttc}', '🌙', 4, 'Pending medical review', true),

('when-to-see-a-doctor-period', 'When should you see a doctor about your period?',
 'Warning signs that need a gynaecologist''s attention.',
 'Most cycle variation is normal, but some signs deserve a consultation:

- Cycles shorter than 21 days or longer than 35 days, repeatedly
- Missing three or more periods in a row (and you are not pregnant)
- Bleeding that soaks a pad or tampon every hour for several hours
- Periods lasting longer than 7 days
- Bleeding between periods or after sex
- Severe pain that stops you from daily activities

**Seek urgent care** if you have very heavy bleeding with dizziness or fainting, or severe abdominal pain.',
 'safety', '{track,pcod,ttc,menopause}', '🩺', 3, 'Pending medical review', true),

('pcod-basics', 'PCOD/PCOS: the basics',
 'What PCOD is, common symptoms, and why lifestyle matters.',
 'Polycystic ovary syndrome (PCOS), often called PCOD in India, is a common hormonal condition affecting roughly 1 in 5 Indian women of reproductive age.

## Common signs
- Irregular or missed periods
- Acne and oily skin
- Extra hair growth on the face or body, or hair thinning on the scalp
- Weight gain, especially around the waist
- Difficulty getting pregnant

## Diagnosis
Only a doctor can diagnose PCOS, usually with a history, examination, blood tests and sometimes an ultrasound.

## Management
There is no single cure, but symptoms improve a lot with regular exercise, a balanced low-glycaemic diet, good sleep and stress management. Your doctor may also suggest medicines.',
 'pcod', '{pcod}', '🌿', 5, 'Pending medical review', true),

('pcod-myths', '6 PCOD myths, busted',
 'Separating facts from fiction about PCOD.',
 '**Myth: Only overweight women get PCOD.** Fact: lean women can have PCOD too.

**Myth: PCOD means you can never get pregnant.** Fact: many women with PCOD conceive, sometimes with support.

**Myth: You must stop eating rice and roti completely.** Fact: portion size, fibre and protein matter more than cutting out food groups.

**Myth: Cysts must be removed with surgery.** Fact: the "cysts" are follicles and usually do not need surgery.

**Myth: Birth-control pills cure PCOD.** Fact: they manage symptoms; lifestyle changes remain the base of treatment.

**Myth: PCOD goes away after marriage.** Fact: marriage has nothing to do with it.',
 'pcod', '{pcod}', '💡', 3, 'Pending medical review', true),

('pcod-indian-plate', 'The PCOD-friendly Indian plate',
 'Simple low-GI swaps using everyday Indian food.',
 'Build each meal as: **half plate vegetables, a quarter protein, a quarter whole grains.**

- Swap white rice for brown rice, millets (jowar, bajra, ragi) or mix half-half
- Add dal, paneer, tofu, eggs, chicken or fish for protein at every meal
- Choose whole fruits instead of juices
- Snack on roasted chana, sprouts, nuts or buttermilk
- Limit sugar, maida, fried snacks and sweetened drinks

Eat at regular times and avoid long gaps that lead to cravings.',
 'nutrition', '{pcod}', '🥗', 4, 'Pending medical review', true),

('how-conception-works', 'How conception works',
 'Your fertile window explained simply.',
 'An egg survives about 12–24 hours after ovulation, and sperm can survive up to 5 days. So your **fertile window** is about 6 days: the 5 days before ovulation and the day of ovulation.

Having sex every 1–2 days during this window gives the best chances.

## When to seek help
See a doctor if you have been trying for **12 months** (or **6 months if you are over 35**), or sooner if you have irregular periods, known PCOD, endometriosis or a history of pelvic infection.',
 'fertility', '{ttc}', '👶', 4, 'Pending medical review', true),

('preconception-checklist', 'Getting your body ready for pregnancy',
 'Preconception steps doctors commonly recommend.',
 '- Start **folic acid** (usually 400 mcg daily) at least 3 months before trying, after checking with your doctor
- Get a general health check-up: blood pressure, blood sugar, thyroid and haemoglobin
- Check **rubella** immunity and update vaccinations
- Review any regular medicines with your doctor
- Stop smoking and alcohol
- Aim for a healthy weight with balanced food and regular movement',
 'fertility', '{ttc}', '✅', 3, 'Pending medical review', true),

('menopause-stages', 'Perimenopause, menopause and after',
 'Understanding the stages of menopause.',
 '**Perimenopause** usually starts in the 40s. Periods become irregular and symptoms like hot flashes and poor sleep may begin.

**Menopause** is confirmed after 12 months without a period. The average age in India is around 46–47.

**Postmenopause** is the time after that. Bone and heart health become more important.

**Important:** any bleeding after menopause should be checked by a doctor promptly.',
 'menopause', '{menopause}', '🌺', 4, 'Pending medical review', true),

('menopause-treatment-options', 'Treatment options for menopause symptoms',
 'A general overview: lifestyle, non-hormonal and hormone therapy.',
 'Treatment is always decided together with your doctor.

**Lifestyle:** regular exercise, a cool bedroom, layered clothing, limiting caffeine, alcohol and spicy food can reduce hot flashes.

**Non-hormonal medicines:** some medicines can reduce hot flashes and mood symptoms.

**Hormone therapy (HRT/MHT):** very effective for hot flashes and night sweats for many women, but not suitable for everyone. Your doctor will weigh your personal benefits and risks.

**Vaginal dryness:** lubricants, moisturisers and local treatments can help.',
 'menopause', '{menopause}', '💊', 4, 'Pending medical review', true),

('bone-health-after-40', 'Bone health after 40',
 'Calcium, vitamin D and strength training.',
 'Oestrogen protects bones. As it falls during menopause, bone loss speeds up.

- Get calcium from milk, curd, paneer, ragi, sesame and leafy greens
- Get sunlight and ask your doctor about vitamin D levels
- Do weight-bearing exercise: brisk walking, stairs, strength training
- Practise balance exercises and yoga to prevent falls',
 'menopause', '{menopause}', '🦴', 3, 'Pending medical review', true);

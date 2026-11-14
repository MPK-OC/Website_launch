// Static product content for the MVP. Anything here can later move to the DB / admin CMS.

export const SYMPTOMS = [
  ["cramps", "Cramps", "🌀"], ["headache", "Headache", "🤕"], ["bloating", "Bloating", "🎈"],
  ["acne", "Acne", "🔴"], ["breast_tenderness", "Tender breasts", "💗"], ["backache", "Backache", "🦴"],
  ["nausea", "Nausea", "🤢"], ["fatigue", "Fatigue", "😴"], ["cravings", "Cravings", "🍫"],
  ["insomnia", "Insomnia", "🌙"], ["discharge", "Discharge", "💧"], ["hair_fall", "Hair fall", "💇"],
] as const;

export const MOODS = [
  ["happy", "Happy", "😊"], ["calm", "Calm", "😌"], ["energetic", "Energetic", "⚡"], ["sensitive", "Sensitive", "🥺"],
  ["sad", "Sad", "😢"], ["anxious", "Anxious", "😰"], ["irritable", "Irritable", "😤"], ["low", "Low", "😞"],
] as const;

export const FLOWS = [
  ["none", "None"], ["spotting", "Spotting"], ["light", "Light"], ["medium", "Medium"], ["heavy", "Heavy"], ["very_heavy", "Very heavy"],
] as const;

export const CONTRACEPTION = [
  ["none", "None"], ["condom", "Condom"], ["pill", "Oral pill"], ["iud", "IUD / Copper-T"], ["injection", "Injection / implant"], ["other", "Other"],
] as const;

export const HEALTH_GOALS = [
  ["track", "Track my periods", "🌙", "Know when your next period comes and understand your symptoms."],
  ["pcod", "Manage PCOD/PCOS", "🌿", "Structured care with doctors, diet and fitness."],
  ["ttc", "Plan a pregnancy", "👶", "Know your fertile window and prepare your body."],
  ["menopause", "Menopause support", "🌺", "Relief and guidance for perimenopause and menopause."],
] as const;

export const GOAL_LABEL: Record<string, string> = {
  track: "Cycle tracking", pcod: "PCOD care", ttc: "Trying to conceive", menopause: "Menopause care",
  general: "General", period: "Period concerns",
};

// ---------- PCOD screening (does NOT diagnose; routes to a doctor) ----------
export const PCOD_QUESTIONS = [
  { key: "irregular", q: "Are your cycles often longer than 35 days, or do you get fewer than 8 periods a year?", w: 3 },
  { key: "missed", q: "Have you ever gone 3 months or more without a period (not pregnant)?", w: 3 },
  { key: "hair_growth", q: "Do you have extra hair growth on your face, chin, chest or belly?", w: 3 },
  { key: "acne", q: "Do you have persistent acne, especially on the jawline?", w: 2 },
  { key: "weight", q: "Have you gained weight around your waist or find it hard to lose weight?", w: 2 },
  { key: "dark_skin", q: "Do you have dark, velvety skin patches (neck, underarms)?", w: 2 },
  { key: "conceive", q: "Have you had difficulty getting pregnant?", w: 2 },
  { key: "hair_fall", q: "Have you noticed thinning hair on your scalp?", w: 1 },
  { key: "mood", q: "Do you often experience mood swings, anxiety or low mood?", w: 1 },
  { key: "family", q: "Does anyone in your family have PCOS or type 2 diabetes?", w: 1 },
] as const;

export function pcodRisk(score: number): { level: "low" | "moderate" | "high"; text: string } {
  if (score >= 10) return { level: "high", text: "Your answers show several signs commonly linked with PCOD. We recommend a consultation with a gynaecologist, who may suggest blood tests and an ultrasound." };
  if (score >= 5) return { level: "moderate", text: "Some of your answers match common PCOD signs. Keep tracking your cycle and consider a consultation to rule it out." };
  return { level: "low", text: "Your answers show few PCOD signs. Keep tracking your cycle — if things change, you can retake this check." };
}

// ---------- PCOD diet plan templates (Indian, low-GI) ----------
type Meal = { breakfast: string; lunch: string; snack: string; dinner: string };
export const DIET: Record<"veg" | "eggetarian" | "non_veg", Meal[]> = {
  veg: [
    { breakfast: "Vegetable besan chilla + mint chutney", lunch: "2 multigrain rotis, palak dal, cucumber raita", snack: "Roasted chana + green tea", dinner: "Paneer bhurji, sautéed veggies, 1 jowar roti" },
    { breakfast: "Vegetable oats upma + handful of nuts", lunch: "Brown rice (½ cup), rajma, salad", snack: "Apple + 1 tbsp peanut butter", dinner: "Moong dal khichdi with lots of veggies, curd" },
    { breakfast: "Ragi dosa + sambar", lunch: "2 bajra rotis, mixed veg sabzi, dal", snack: "Sprouts chaat", dinner: "Tofu/paneer tikka, quinoa salad" },
    { breakfast: "Greek yoghurt/curd + chia + berries", lunch: "Millet pulao, chole, salad", snack: "Buttermilk + makhana", dinner: "Lauki chana dal, 1 multigrain roti" },
    { breakfast: "Moong dal cheela + curd", lunch: "2 rotis, bhindi, dal tadka, salad", snack: "Guava + walnuts", dinner: "Vegetable soup + paneer salad" },
    { breakfast: "Poha with peanuts & veggies (small bowl)", lunch: "Brown rice, kadhi (low oil), sautéed beans", snack: "Roasted seeds mix", dinner: "Soya chunks curry, 1 jowar roti" },
    { breakfast: "Dalia (broken wheat) with veggies", lunch: "Thali: dal, sabzi, 1 roti, ½ cup rice, salad", snack: "Coconut water + almonds", dinner: "Grilled paneer, stir-fried veggies" },
  ],
  eggetarian: [
    { breakfast: "2-egg vegetable omelette + 1 multigrain toast", lunch: "2 multigrain rotis, palak dal, raita", snack: "Roasted chana + green tea", dinner: "Egg bhurji, sautéed veggies, 1 jowar roti" },
    { breakfast: "Vegetable oats upma + boiled egg", lunch: "Brown rice (½ cup), rajma, salad", snack: "Apple + peanut butter", dinner: "Moong dal khichdi, curd" },
    { breakfast: "Ragi dosa + sambar", lunch: "2 bajra rotis, egg curry, salad", snack: "Sprouts chaat", dinner: "Paneer tikka, quinoa salad" },
    { breakfast: "Curd + chia + berries", lunch: "Millet pulao, chole, salad", snack: "Boiled egg + buttermilk", dinner: "Lauki chana dal, 1 roti" },
    { breakfast: "Moong dal cheela + curd", lunch: "2 rotis, bhindi, dal, salad", snack: "Guava + walnuts", dinner: "Egg drop vegetable soup + salad" },
    { breakfast: "Poha with peanuts & veggies", lunch: "Brown rice, egg curry, beans", snack: "Roasted seeds mix", dinner: "Soya chunks curry, 1 jowar roti" },
    { breakfast: "Dalia with veggies + boiled egg", lunch: "Thali: dal, sabzi, roti, ½ cup rice", snack: "Coconut water + almonds", dinner: "Grilled paneer, stir-fried veggies" },
  ],
  non_veg: [
    { breakfast: "2-egg vegetable omelette + 1 multigrain toast", lunch: "2 rotis, chicken curry (less oil), salad", snack: "Roasted chana + green tea", dinner: "Grilled fish, sautéed veggies" },
    { breakfast: "Vegetable oats upma + boiled egg", lunch: "Brown rice (½ cup), dal, chicken tikka", snack: "Apple + peanut butter", dinner: "Chicken clear soup + salad" },
    { breakfast: "Ragi dosa + sambar", lunch: "2 bajra rotis, fish curry, salad", snack: "Sprouts chaat", dinner: "Egg bhurji, 1 jowar roti, veggies" },
    { breakfast: "Curd + chia + berries", lunch: "Millet pulao, chicken curry, raita", snack: "Boiled egg + buttermilk", dinner: "Lauki chana dal, 1 roti" },
    { breakfast: "Moong dal cheela + curd", lunch: "2 rotis, keema with peas (lean), salad", snack: "Guava + walnuts", dinner: "Grilled chicken salad" },
    { breakfast: "Poha with peanuts & veggies", lunch: "Brown rice, fish curry, beans", snack: "Roasted seeds mix", dinner: "Paneer/chicken stir-fry" },
    { breakfast: "Dalia with veggies + boiled egg", lunch: "Thali: dal, chicken, roti, ½ cup rice", snack: "Coconut water + almonds", dinner: "Tandoori fish, salad" },
  ],
};

// ---------- PCOD home fitness plan (weekday 0 = Sunday) ----------
export const FITNESS: Record<"beginner" | "intermediate" | "advanced", { title: string; items: string[] }[]> = {
  beginner: [
    { title: "Rest & stretch", items: ["10 min gentle stretching", "Deep breathing (5 min)"] },
    { title: "Strength A", items: ["Bodyweight squats 2×10", "Wall push-ups 2×10", "Glute bridges 2×12", "Plank 2×20s"] },
    { title: "Brisk walk", items: ["Brisk walk 25 min", "Calf stretches"] },
    { title: "Yoga for PCOD", items: ["Butterfly pose", "Cobra pose", "Child's pose", "Malasana", "Anulom vilom 5 min"] },
    { title: "Strength B", items: ["Lunges 2×8 each", "Knee push-ups 2×8", "Bird-dog 2×10", "Side plank 2×15s"] },
    { title: "Cardio", items: ["Skipping/jumping jacks 5×1 min", "Walk 15 min"] },
    { title: "Active rest", items: ["Easy walk 20 min", "Foam/towel stretching"] },
  ],
  intermediate: [
    { title: "Rest & mobility", items: ["15 min mobility flow"] },
    { title: "Strength A", items: ["Squats 3×15", "Push-ups 3×10", "Glute bridges 3×15", "Plank 3×40s"] },
    { title: "Cardio intervals", items: ["Brisk walk/jog intervals 30 min (1 min fast / 2 min easy)"] },
    { title: "Yoga flow", items: ["Surya namaskar ×6", "Bhujangasana", "Dhanurasana", "Baddha konasana", "Bhramari 5 min"] },
    { title: "Strength B", items: ["Reverse lunges 3×12", "Chair dips 3×10", "Dead bugs 3×12", "Side plank 3×30s"] },
    { title: "HIIT", items: ["20 min: squat jumps, mountain climbers, high knees (40s on / 20s off)"] },
    { title: "Long walk", items: ["Walk 40 min outdoors"] },
  ],
  advanced: [
    { title: "Rest & mobility", items: ["20 min yoga / mobility"] },
    { title: "Strength A", items: ["Jump squats 4×12", "Push-ups 4×15", "Single-leg bridges 3×12", "Plank 3×60s"] },
    { title: "Run / cycle", items: ["35 min steady cardio"] },
    { title: "Power yoga", items: ["Surya namaskar ×12", "Balance poses", "Pranayama 10 min"] },
    { title: "Strength B", items: ["Bulgarian split squats 3×10", "Pike push-ups 3×10", "Hollow hold 3×30s", "Side plank 3×45s"] },
    { title: "HIIT", items: ["25 min Tabata circuit"] },
    { title: "Long walk / hike", items: ["60 min easy outdoor activity"] },
  ],
};

// ---------- Pregnancy planning ----------
export const TTC_CHECKLIST = [
  ["folic_acid", "Start folic acid (ask your doctor for the right dose)", "At least 3 months before trying"],
  ["checkup", "General health check-up", "BP, blood sugar, haemoglobin, thyroid"],
  ["rubella", "Check rubella & other vaccinations", "Some vaccines must be taken before pregnancy"],
  ["meds_review", "Review regular medicines with a doctor", "Some medicines are not safe in pregnancy"],
  ["no_smoke_alcohol", "Stop smoking and alcohol", "For both partners"],
  ["weight", "Work towards a healthy weight", "Balanced food + regular movement"],
  ["dental", "Dental check-up", "Gum health matters in pregnancy"],
  ["partner", "Partner health check", "Lifestyle, semen analysis if needed"],
] as const;

// ---------- Menopause ----------
export const MENO_SYMPTOMS = [
  ["hot_flashes", "Hot flashes"], ["night_sweats", "Night sweats"], ["sleep_problems", "Sleep problems"],
  ["mood_changes", "Mood changes"], ["joint_pain", "Joint pain"], ["vaginal_dryness", "Vaginal dryness"],
  ["low_libido", "Low libido"], ["brain_fog", "Brain fog"],
] as const;
export const SEVERITY = ["None", "Mild", "Moderate", "Severe"];

export function menoBand(score: number) {
  if (score >= 16) return { label: "Severe", color: "text-rose-600", advice: "Your symptoms are significantly affecting you. Please consult a menopause specialist — effective treatments exist." };
  if (score >= 9) return { label: "Moderate", color: "text-amber-600", advice: "Lifestyle changes may help; a consultation can explore treatment options." };
  if (score >= 1) return { label: "Mild", color: "text-emerald-600", advice: "Keep tracking. Sleep, movement and diet changes often help mild symptoms." };
  return { label: "None", color: "text-slate-500", advice: "No symptoms logged today." };
}

export const MENO_LIFESTYLE = [
  ["🥛", "Calcium & vitamin D", "Dairy, ragi, sesame, greens + sunlight. Ask your doctor about supplements."],
  ["🏋️", "Strength & weight-bearing exercise", "Protects bones and muscles — 2–3 times a week."],
  ["🧘", "Pelvic floor exercises", "Kegels daily help bladder control and pelvic health."],
  ["🛏️", "Sleep routine", "Cool, dark room; no screens 1 hour before bed; limit tea/coffee after 3 pm."],
  ["🌶️", "Hot flash triggers", "Spicy food, alcohol, caffeine and stress can trigger flashes — note yours."],
  ["❤️", "Heart health", "Check BP, sugar and cholesterol yearly after 40."],
] as const;

export const EMERGENCY_TEXT =
  "If you have very heavy bleeding with dizziness or fainting, severe abdominal pain, or chest pain, call 112 or go to the nearest hospital immediately.";

// FIX: Replaced non-resolving vite/client reference with a manual type declaration for import.meta.env
// This resolves errors about 'env' not existing on 'ImportMeta'.
declare global {
  interface ImportMeta {
    readonly env: {
      readonly VITE_API_URL: string;
      readonly VITE_STRIPE_PUBLISHABLE_KEY: string;
    };
  }
}

import React, { useState, useRef, ChangeEvent, useEffect, useMemo } from 'react';
import { GoogleGenAI } from "@google/genai";
import { loadStripe } from '@stripe/stripe-js';

// --- FORM CHECKER TYPES ---
interface Improvement {
  section_id: string;
  before_fa?: string;
  after_fa?: string;
  rationale_fa?: string;
  before_en?: string;
  after_en?: string;
  rationale_en?: string;
  before_uk?: string;
  after_uk?: string;
  rationale_uk?: string;
}

type FormCheckerFormType = 'pip' | 'uc' | 'carers_allowance' | 'nhs_forms' | 'student_finance' | 'immigration' | 'council_tax' | 'blue_badge' | 'dvla_forms' | 'hmrc_forms';

interface FormCheckerResponse {
  language: 'fa' | 'en' | 'uk';
  form_type: FormCheckerFormType;
  overall_stars: 1 | 2 | 3 | 4 | 5 | 6;
  scores: {
    completeness: number;
    consistency: number;
    evidence_linkage: number;
    relevance: number;
    tone_clarity: number;
    risk_flags: number;
  };
  translation_summary: string;
  key_findings: string[];
  missing_evidence: string[];
  improvements: Improvement[];
  per_question_scores?: { [key: string]: number };
  next_steps_fa: string[];
  next_steps_en: string[];
  next_steps_uk: string[];
  disclaimer_fa: string;
  disclaimer_en: string;
  disclaimer_uk: string;
}


// --- DATA STORE FOR ALL FORM MODULES ---

// Define types for our form content for type safety
interface FormOption {
  value: string;
  label_fa: string;
  label_en: string;
  label_uk: string;
  tip_fa?: string;
  tip_en?: string;
  tip_uk?: string;
}

// Add a recursive type for children
type FormQuestion = {
  id: string;
  type: 'long-text' | 'single-select' | 'multi-select' | 'short-text' | 'file' | 'group' | 'currency' | 'number' | 'date';
  question_fa: string;
  question_en: string;
  question_uk: string;
  description_fa?: string;
  description_en?: string;
  description_uk?: string;
  options?: FormOption[];
  placeholder_fa?: string;
  placeholder_en?: string;
  placeholder_uk?: string;
  allowProof?: boolean;
  proof_hint_fa?: string;
  proof_hint_en?: string;
  proof_hint_uk?: string;
  starEnabled?: boolean;
  bookEnabled?: boolean;
  when?: { [key: string]: string }; // For conditional logic
  children?: FormQuestion[]; // For grouped questions
}

interface FormModuleContent {
  moduleId: string;
  title_fa: string;
  title_en: string;
  title_uk: string;
  intro_fa: string;
  intro_en: string;
  intro_uk: string;
  questions: FormQuestion[];
}

const formContent: { [key: string]: FormModuleContent } = {
  pip: {
    moduleId: 'pip',
    title_fa: 'فرم PIP (ارزیابی کامل)',
    title_en: 'PIP Form (Full Assessment)',
    title_uk: 'Форма PIP (Повна оцінка)',
    intro_fa: 'این فرم جامع به شما کمک می‌کند تا تمام جنبه‌های تأثیر ناتوانی بر زندگی روزمره و تحرک خود را برای درخواست PIP شرح دهید. برای هر سوال، شدت اثر (⭐) و طول پاسخ (📚) را تنظیم کنید.',
    intro_en: 'This comprehensive form helps you describe all aspects of how your disability affects your daily living and mobility for your PIP application. For each question, adjust the impact strength (⭐) and answer length (📚).',
    intro_uk: 'Ця комплексна форма допоможе вам описати всі аспекти впливу вашої інвалідності на повсякденне життя та мобільність для вашої заявки на PIP. Для кожного питання налаштуйте силу впливу (⭐) та довжину відповіді (📚).',
    questions: [
      // Daily Living
      { id: 'preparing_food', type: 'long-text', question_fa: '۱. آماده کردن غذا', question_en: '1. Preparing food', question_uk: '1. Приготування їжі', description_fa: 'مشکلات خود را در پوست کندن و خرد کردن سبزیجات، باز کردن بسته‌بندی‌ها، استفاده از اجاق گاز یا مایکروویو، و نیاز به کمک یا وسایل کمکی توضیح دهید. به انگیزه و ایمنی نیز اشاره کنید.', description_en: 'Describe your difficulties with peeling/chopping vegetables, opening packaging, using a cooker or microwave, and any need for aids or assistance. Also mention motivation and safety.', description_uk: 'Опишіть свої труднощі з чищенням/нарізанням овочів, відкриттям упаковок, використанням плити або мікрохвильової печі, а також будь-яку потребу в допоміжних засобах чи допомозі. Також згадайте про мотивацію та безпеку.', allowProof: true, starEnabled: true, bookEnabled: true },
      { id: 'eating_drinking', type: 'long-text', question_fa: '۲. خوردن و آشامیدن', question_en: '2. Eating and drinking', question_uk: '2. Вживання їжі та пиття', description_fa: 'مشکلات مربوط به بریدن غذا، بردن غذا به دهان، جویدن، بلعیدن، یا نیاز به لوله‌های تغذیه را شرح دهید.', description_en: 'Describe problems with cutting food, bringing food to your mouth, chewing, swallowing, or needing feeding tubes.', description_uk: 'Опишіть проблеми з нарізанням їжі, піднесенням їжі до рота, жуванням, ковтанням або потребою в зондах для годування.', allowProof: true, starEnabled: true, bookEnabled: true },
      { id: 'managing_treatments', type: 'long-text', question_fa: '۳. مدیریت درمان‌ها', question_en: '3. Managing treatments', question_uk: '3. Керування лікуванням', description_fa: 'توضیح دهید که آیا برای مصرف دارو (قرص، تزریق)، انجام فیزیوتراپی در خانه، یا نظارت بر وضعیت سلامتی خود (مانند قند خون) به کمک یا یادآوری نیاز دارید.', description_en: 'Explain if you need help or reminders to take medication (pills, injections), do physiotherapy at home, or monitor a health condition (like blood sugar).', description_uk: 'Поясніть, чи потрібна вам допомога або нагадування для прийому ліків (таблетки, ін\'єкції), виконання фізіотерапії вдома або моніторингу стану здоров\'я (наприклад, рівня цукру в крові).', allowProof: true, starEnabled: true, bookEnabled: true },
      { id: 'washing_bathing', type: 'long-text', question_fa: '۴. شست‌وشو و حمام کردن', question_en: '4. Washing and bathing', question_uk: '4. Миття та купання', description_fa: 'مشکلات مربوط به ورود و خروج از وان یا دوش، شستن کامل بدن، و ایمنی هنگام شست‌وشو را شرح دهید.', description_en: 'Describe difficulties getting in/out of a bath or shower, washing your whole body, and safety issues while washing.', description_uk: 'Опишіть труднощі з входом/виходом з ванни або душу, миттям всього тіла та питаннями безпеки під час миття.', allowProof: true, starEnabled: true, bookEnabled: true },
      { id: 'managing_toilet_needs', type: 'long-text', question_fa: '۵. مدیریت نیازهای توالت', question_en: '5. Managing toilet needs', question_uk: '5. Керування туалетними потребами', description_fa: 'مشکلات مربوط به رفتن به توالت، تمیز کردن خود، یا مدیریت بی‌اختیاری (استفاده از پد یا سوند) را توضیح دهید.', description_en: 'Explain problems with getting to/from the toilet, cleaning yourself, or managing incontinence (using pads or catheters).', description_uk: 'Поясніть проблеми з відвідуванням туалету, особистою гігієною або керуванням нетриманням (використання прокладок або катетерів).', allowProof: true, starEnabled: true, bookEnabled: true },
      { id: 'dressing_undressing', type: 'long-text', question_fa: '۶. لباس پوشیدن و درآوردن', question_en: '6. Dressing and undressing', question_uk: '6. Одягання та роздягання', description_fa: 'مشکلات خود در پوشیدن و درآوردن لباس و کفش، بستن دکمه‌ها، زیپ‌ها، یا استفاده از وسایل کمکی را شرح دهید.', description_en: 'Describe difficulties with putting on/taking off clothes and shoes, doing up buttons, zips, or using any aids.', description_uk: 'Опишіть труднощі з одяганням/роздяганням одягу та взуття, застібанням ґудзиків, блискавок або використанням будь-яких допоміжних засобів.', allowProof: true, starEnabled: true, bookEnabled: true },
      { id: 'communicating_verbally', type: 'long-text', question_fa: '۷. ارتباط کلامی', question_en: '7. Communicating verbally', question_uk: '7. Вербальне спілкування', description_fa: 'مشکلاتی که در صحبت کردن، درک کردن صحبت دیگران، یا نیاز به وسایل کمکی برای برقراری ارتباط دارید را توضیح دهید.', description_en: 'Describe any problems you have with speaking, understanding what people say to you, or needing aids to communicate.', description_uk: 'Опишіть будь-які проблеми, які у вас є з мовленням, розумінням того, що вам кажуть люди, або потребою в допоміжних засобах для спілкування.', allowProof: true, starEnabled: true, bookEnabled: true },
      { id: 'using_telephone', type: 'long-text', question_fa: '۸. استفاده از تلفن', question_en: '8. Using a telephone', question_uk: '8. Користування телефоном', description_fa: 'مشکلات خود را در استفاده از تلفن استاندارد، مانند شماره‌گیری، شنیدن یا درک مکالمه، و اینکه آیا به کمک یا دستگاه‌های خاصی نیاز دارید، توضیح دهید.', description_en: 'Describe your difficulties using a standard telephone, such as dialling, hearing or understanding conversations, and whether you need help or special devices.', description_uk: 'Опишіть свої труднощі з використанням стандартного телефону, такі як набір номера, слухання або розуміння розмов, і чи потрібна вам допомога або спеціальні пристрої.', allowProof: true, starEnabled: true, bookEnabled: true },
      { id: 'reading_understanding', type: 'long-text', question_fa: '۹. خواندن و درک کردن', question_en: '9. Reading and understanding', question_uk: '9. Читання та розуміння', description_fa: 'مشکلات مربوط به خواندن و درک علائم، نمادها، و کلمات (مثلاً به دلیل مشکلات بینایی یا شناختی) را شرح دهید.', description_en: 'Describe difficulties with reading and understanding signs, symbols, and words (e.g., due to vision or cognitive issues).', description_uk: 'Опишіть труднощі з читанням і розумінням знаків, символів та слів (наприклад, через проблеми із зором або когнітивні проблеми).', allowProof: true, starEnabled: true, bookEnabled: true },
      { id: 'managing_correspondence', type: 'long-text', question_fa: '۱۰. مدیریت نامه‌ها و مکاتبات', question_en: '10. Managing correspondence', question_uk: '10. Керування кореспонденцією', description_fa: 'مشکلات خود در خواندن، درک کردن و اقدام بر اساس نامه‌های رسمی، قبوض یا ایمیل‌ها را شرح دهید. به نیاز به کمک برای مدیریت این امور اشاره کنید.', description_en: 'Describe your problems with reading, understanding, and acting on official letters, bills, or emails. Mention any help you need to manage these tasks.', description_uk: 'Опишіть свої проблеми з читанням, розумінням та реагуванням на офіційні листи, рахунки або електронні листи. Згадайте будь-яку допомогу, яка вам потрібна для виконання цих завдань.', allowProof: true, starEnabled: true, bookEnabled: true },
      { id: 'engaging_socially', type: 'long-text', question_fa: '۱۱. تعامل با دیگران', question_en: '11. Engaging with other people', question_uk: '11. Соціальна взаємодія', description_fa: 'مشکلات مربوط به تعامل رو در رو با دیگران به دلیل اضطراب شدید، پریشانی روانی، یا مشکلات شناختی را توضیح دهید.', description_en: 'Explain difficulties with engaging face-to-face with others due to severe anxiety, psychological distress, or cognitive issues.', description_uk: 'Поясніть труднощі з особистою взаємодією з іншими через сильну тривогу, психологічний стрес або когнітивні проблеми.', allowProof: true, starEnabled: true, bookEnabled: true },
      { id: 'making_budgeting_decisions', type: 'long-text', question_fa: '۱۲. تصمیم‌گیری در مورد بودجه', question_en: '12. Making budgeting decisions', question_uk: '12. Прийняття бюджетних рішень', description_fa: 'مشکلات خود در مدیریت پول، پرداخت قبوض، یا تصمیم‌گیری‌های مالی پیچیده را به دلیل مشکلات شناختی یا روانی شرح دهید.', description_en: 'Describe your problems with managing money, paying bills, or making complex financial decisions due to cognitive or mental health issues.', description_uk: 'Опишіть свої проблеми з управлінням грошима, оплатою рахунків або прийняттям складних фінансових рішень через когнітивні проблеми або проблеми з психічним здоров\'ям.', allowProof: true, starEnabled: true, bookEnabled: true },
      { id: 'safety_awareness', type: 'long-text', question_fa: '۱۳. آگاهی از خطرات و ایمنی', question_en: '13. Safety awareness', question_uk: '13. Усвідомлення небезпеки та безпека', description_fa: 'توضیح دهید که آیا به دلیل وضعیت سلامتی خود در معرض خطر هستید، مثلاً در آشپزخانه، حمام، یا هنگام عبور از خیابان. به مواردی مانند فراموشی، سرگیجه یا سقوط اشاره کنید.', description_en: 'Explain if you are at risk due to your health condition, for example in the kitchen, bathroom, or when crossing roads. Mention issues like forgetfulness, dizziness, or falls.', description_uk: 'Поясніть, чи наражаєтеся ви на ризик через стан свого здоров\'я, наприклад, на кухні, у ванній або при переході дороги. Згадайте такі проблеми, як забудькуватість, запаморочення або падіння.', allowProof: true, starEnabled: true, bookEnabled: true },
      // Mobility
      { id: 'planning_journeys', type: 'long-text', question_fa: '۱۴. برنامه‌ریزی و دنبال کردن سفر', question_en: '14. Planning and following journeys', question_uk: '14. Планування та дотримання маршруту', description_fa: 'مشکلات مربوط به برنامه‌ریزی یک مسیر، دنبال کردن آن (چه آشنا و چه ناآشنا)، یا نیاز به همراهی به دلیل اضطراب، سردرگمی، یا پریشانی روانی را توضیح دهید.', description_en: 'Describe difficulties with planning a route, following a route (both familiar and unfamiliar), or needing someone with you due to anxiety, disorientation, or psychological distress.', description_uk: 'Опишіть труднощі з плануванням маршруту, дотриманням маршруту (як знайомого, так і незнайомого) або потребою в супроводі через тривогу, дезорієнтацію або психологічний стрес.', allowProof: true, starEnabled: true, bookEnabled: true },
      { id: 'moving_around', type: 'long-text', question_fa: '۱۵. حرکت کردن در اطراف', question_en: '15. Moving around', question_uk: '15. Пересування', description_fa: 'توضیح دهید که چقدر می‌توانید راه بروید قبل از اینکه احساس درد، خستگی شدید، یا تنگی نفس کنید. به نوع سطح (صاف، شیب‌دار)، سرعت راه رفتن، و استفاده از وسایل کمکی (عصا، واکر، ویلچر) اشاره کنید.', description_en: 'Explain how far you can walk before feeling significant pain, severe fatigue, or breathlessness. Mention the type of surface (flat, sloped), your walking speed, and any aids you use (stick, walker, wheelchair).', description_uk: 'Поясніть, як далеко ви можете пройти, перш ніж відчуєте значний біль, сильну втому або задишку. Згадайте тип поверхні (рівна, похила), швидкість ходьби та будь-які допоміжні засоби, які ви використовуєте (палиця, ходунки, інвалідний візок).', allowProof: true, starEnabled: true, bookEnabled: true },
      { id: 'walking_pain_details', type: 'long-text', question_fa: '۱۶. جزئیات درد هنگام راه رفتن', question_en: '16. Pain while walking', question_uk: '16. Деталі болю під час ходьби', description_fa: 'نوع، شدت و محل درد هنگام راه رفتن را توصیف کنید. توضیح دهید که درد چگونه بر سرعت، نحوه راه رفتن و توانایی شما برای ادامه دادن تأثیر می‌گذارد.', description_en: 'Describe the type, severity, and location of the pain you experience while walking. Explain how the pain affects your speed, gait, and ability to continue.', description_uk: 'Опишіть тип, інтенсивність та локалізацію болю, який ви відчуваєте під час ходьби. Поясніть, як біль впливає на вашу швидкість, ходу та здатність продовжувати рух.', allowProof: true, starEnabled: true, bookEnabled: true },
      { id: 'using_mobility_aids', type: 'long-text', question_fa: '۱۷. استفاده از وسایل کمکی حرکتی', question_en: '17. Using mobility aids', question_uk: '17. Використання допоміжних засобів для пересування', description_fa: 'توضیح دهید که چرا و چگونه از وسایل کمکی (مانند عصا، واکر، ویلچر) استفاده می‌کنید. آیا برای استفاده از آن‌ها به کمک نیاز دارید؟ این وسایل چقدر به شما کمک می‌کنند؟', description_en: 'Explain why and how you use mobility aids (like a stick, walker, wheelchair). Do you need help to use them? How much do they help you?', description_uk: 'Поясніть, чому і як ви використовуєте допоміжні засоби для пересування (наприклад, палицю, ходунки, інвалідний візок). Чи потрібна вам допомога для їх використання? Наскільки вони вам допомагають?', allowProof: true, starEnabled: true, bookEnabled: true }
    ]
  },
  uc: {
    "moduleId": "uc",
    "title_fa": "یونیورسال کردیت (Universal Credit)",
    "title_en": "Universal Credit",
    "title_uk": "Універсальний кредит (Universal Credit)",
    "intro_fa": "این فرم به شما کمک می‌کند تا برای Universal Credit درخواست دهید یا حساب خود را مدیریت کنید. به سوالات پاسخ دهید تا راهنمایی، چک‌لیست مدارک و مراحل بعدی را دریافت کنید.",
    "intro_en": "This form helps you apply for or manage your Universal Credit account. Answer the questions to get guidance, a document checklist, and next steps.",
    "intro_uk": "Ця форма допоможе вам подати заявку або керувати своїм обліковим записом Universal Credit. Дайте відповідь на запитання, щоб отримати інструкції, перелік документів та подальші кроки.",
    "questions": [
      { "id": "claim_type", "type": "single-select", "question_fa": "نوع درخواست شما چیست؟", "question_en": "What is the type of your claim?", "question_uk": "Який тип вашої заявки?", "options": [ { "value": "new", "label_fa": "درخواست جدید", "label_en": "New claim", "label_uk": "Нова заявка" }, { "value": "manage", "label_fa": "مدیریت حساب فعلی", "label_en": "Manage existing account", "label_uk": "Керувати існуючим обліковим записом" } ] },
      { "id": "household", "type": "single-select", "question_fa": "چه کسی در درخواست شما حضور دارد؟", "question_en": "Who is on your claim?", "question_uk": "Хто вказаний у вашій заявці?", "options": [ { "value": "single", "label_fa": "فقط من", "label_en": "Just me", "label_uk": "Тільки я" }, { "value": "couple", "label_fa": "من و همسرم/پارتنرم", "label_en": "Me and my partner", "label_uk": "Я та мій партнер" } ] },
      { "id": "has_children", "type": "single-select", "question_fa": "آیا فرزندی دارید که با شما زندگی کند؟", "question_en": "Do you have any children who live with you?", "question_uk": "Чи є у вас діти, які проживають з вами?", "options": [ { "value": "yes", "label_fa": "بله", "label_en": "Yes", "label_uk": "Так" }, { "value": "no", "label_fa": "خیر", "label_en": "No", "label_uk": "Ні" } ] },
      { "id": "housing_costs", "type": "single-select", "question_fa": "آیا برای خانه خود اجاره پرداخت می‌کنید؟", "question_en": "Do you pay rent for your home?", "question_uk": "Ви платите оренду за своє житло?", "options": [ { "value": "yes", "label_fa": "بله", "label_en": "Yes", "label_uk": "Так" }, { "value": "no", "label_fa": "خیر", "label_en": "No", "label_uk": "Ні" } ], "allowProof": true, "proof_hint_fa": "قرارداد اجاره یا نامه از صاحبخانه را بارگذاری کنید.", "proof_hint_en": "Upload your tenancy agreement or a letter from your landlord.", "proof_hint_uk": "Завантажте договір оренди або лист від орендодавця." },
      { "id": "savings", "type": "currency", "question_fa": "مجموع پس‌انداز و سرمایه‌گذاری شما (و همسرتان) چقدر است؟", "question_en": "What are your total savings and investments (and your partner's)?", "question_uk": "Яка загальна сума ваших заощаджень та інвестицій (і вашого партнера)?", "placeholder_fa": "£", "placeholder_en": "£", "placeholder_uk": "£", "allowProof": true, "proof_hint_fa": "صورت‌حساب‌های بانکی اخیر را بارگذاری کنید.", "proof_hint_en": "Upload recent bank statements.", "proof_hint_uk": "Завантажте останні банківські виписки." },
      { "id": "employment_status", "type": "single-select", "question_fa": "آیا شما یا همسرتان شاغل هستید؟", "question_en": "Are you or your partner employed?", "question_uk": "Ви або ваш партнер працевлаштовані?", "options": [ { "value": "yes", "label_fa": "بله", "label_en": "Yes", "label_uk": "Так" }, { "value": "no", "label_fa": "خیر", "label_en": "No", "label_uk": "Ні" } ], "allowProof": true, "proof_hint_fa": "آخرین فیش حقوقی خود را بارگذاری کنید.", "proof_hint_en": "Upload your most recent payslip.", "proof_hint_uk": "Завантажте свою останню платіжну відомість." },
      { "id": "health_condition", "type": "single-select", "question_fa": "آیا بیماری یا معلولیتی دارید که توانایی شما برای کار را محدود کند؟", "question_en": "Do you have a health condition or disability that limits your ability to work?", "question_uk": "Чи є у вас захворювання або інвалідність, що обмежує вашу працездатність?", "options": [ { "value": "yes", "label_fa": "بله", "label_en": "Yes", "label_uk": "Так" }, { "value": "no", "label_fa": "خیر", "label_en": "No", "label_uk": "Ні" } ], "allowProof": true, "proof_hint_fa": "یادداشت پزشک (Fit Note) یا مدارک پزشکی مرتبط را بارگذاری کنید.", "proof_hint_en": "Upload a Fit Note or any relevant medical evidence.", "proof_hint_uk": "Завантажте довідку про стан здоров'я (Fit Note) або будь-які відповідні медичні документи." }
    ]
  },
  // FIX: This 'immigration' object was corrupted and has been restored to the correct version.
  immigration: {
    "moduleId": "immigration",
    "title_fa": "امور مهاجرت",
    "title_en": "Immigration Affairs",
    "title_uk": "Імміграційні справи",
    "intro_fa": "این بخش برای راهنمایی در مورد فرم‌های رایج مهاجرتی در UK طراحی شده است. لطفاً نوع درخواست خود را مشخص کنید تا راهنمایی دقیق دریافت کنید.",
    "intro_en": "This section is designed to provide guidance on common immigration forms in the UK. Please specify your application type to get detailed help.",
    "intro_uk": "Цей розділ призначений для надання допомоги щодо поширених імміграційних форм у Великобританії. Будь ласка, вкажіть тип вашої заявки, щоб отримати детальну допомогу.",
    "questions": [
      { "id": "application_type", "type": "single-select", "question_fa": "چه نوع درخواست مهاجرتی دارید؟", "question_en": "What type of immigration application are you making?", "question_uk": "Який тип імміграційної заявки ви подаєте?", "options": [ { "value": "visa_extension", "label_fa": "تمدید ویزا", "label_en": "Visa Extension", "label_uk": "Продовження візи" }, { "value": "settlement", "label_fa": "اقامت دائم (ILR)", "label_en": "Settlement (ILR)", "label_uk": "Постійне проживання (ILR)" }, { "value": "citizenship", "label_fa": "شهروندی (تابعیت)", "label_en": "Citizenship (Naturalisation)", "label_uk": "Громадянство (Натуралізація)" }, { "value": "family_visa", "label_fa": "ویزای خانوادگی", "label_en": "Family Visa", "label_uk": "Сімейна віза" } ] },
      { "id": "current_visa", "type": "short-text", "question_fa": "نوع ویزای فعلی شما چیست؟", "question_en": "What is your current visa type?", "question_uk": "Який ваш поточний тип візи?", "placeholder_fa": "مثلاً: Skilled Worker, Student Visa", "placeholder_en": "e.g., Skilled Worker, Student Visa", "placeholder_uk": "напр., Skilled Worker, Student Visa", "allowProof": true, "proof_hint_fa": "کارت اقامت بیومتریک (BRP) خود را بارگذاری کنید.", "proof_hint_en": "Upload your Biometric Residence Permit (BRP).", "proof_hint_uk": "Завантажте свій біометричний дозвіл на проживання (BRP)." },
      { "id": "time_in_uk", "type": "short-text", "question_fa": "چه مدت به طور مداوم در UK زندگی کرده‌اید؟", "question_en": "How long have you lived continuously in the UK?", "question_uk": "Як довго ви безперервно проживаєте у Великобританії?", "placeholder_fa": "مثلاً: ۵ سال و ۲ ماه", "placeholder_en": "e.g., 5 years and 2 months", "placeholder_uk": "напр., 5 років і 2 місяці" },
      { "id": "absences", "type": "long-text", "when": { "application_type": "settlement" }, "question_fa": "در ۵ سال گذشته، سفرهای خود به خارج از UK را لیست کنید (تاریخ و دلیل).", "question_en": "In the last 5 years, list your trips outside the UK (dates and reason).", "question_uk": "За останні 5 років перелічіть свої поїздки за межі Великобританії (дати та причина).", "placeholder_fa": "مثلاً: 10/01/2022 - 25/01/2022 (تعطیلات)", "placeholder_en": "e.g., 10/01/2022 - 25/01/2022 (Holiday)", "placeholder_uk": "напр., 10/01/2022 - 25/01/2022 (Відпустка)", "allowProof": false },
      { "id": "english_test", "type": "single-select", "question_fa": "آیا در آزمون زبان انگلیسی مورد تایید قبول شده‌اید؟", "question_en": "Have you passed an approved English language test?", "question_uk": "Чи склали ви затверджений тест з англійської мови?", "options": [ { "value": "yes", "label_fa": "بله", "label_en": "Yes", "label_uk": "Так" }, { "value": "no", "label_fa": "خیر", "label_en": "No", "label_uk": "Ні" }, { "value": "exempt", "label_fa": "معاف هستم", "label_en": "I am exempt", "label_uk": "Я звільнений(а)" } ], "allowProof": true, "proof_hint_fa": "گواهی آزمون زبان خود را بارگذاری کنید.", "proof_hint_en": "Upload your language test certificate.", "proof_hint_uk": "Завантажте сертифікат про складання мовного тесту." },
      { "id": "life_in_uk_test", "type": "single-select", "when": { "application_type": "settlement" }, "question_fa": "آیا در آزمون \"زندگی در بریتانیا\" (Life in the UK) قبول شده‌اید؟", "question_en": "Have you passed the Life in the UK test?", "question_uk": "Чи склали ви тест 'Life in the UK'?", "options": [ { "value": "yes", "label_fa": "بله", "label_en": "Yes", "label_uk": "Так" }, { "value": "no", "label_fa": "خیر", "label_en": "No", "label_uk": "Ні" } ], "allowProof": true, "proof_hint_fa": "نامه قبولی آزمون را بارگذاری کنید.", "proof_hint_en": "Upload your test pass letter.", "proof_hint_uk": "Завантажте лист про успішне складання тесту." }
    ]
  },
  blue_badge: {
      "moduleId": "blue_badge",
      "title_fa": "بلیو بج (کارت پارکینگ معلولیت)",
      "title_en": "Blue Badge (Disability Parking Permit)",
      "title_uk": "Синій значок (Дозвіл на паркування для людей з інвалідністю)",
      "intro_fa": "در این فرم با پاسخ‌های کوتاه و شفاف، شرایط شما برای دریافت Blue Badge بررسی و پاسخ مناسب تولید می‌شود. ⭐ شدت اثر پاسخ (ستاره‌ها) و 📚 طول پاسخ (کتاب‌ها) را برای هر سوال تنظیم کنید. آپلود مدرک، کیفیت خروجی را بالاتر می‌برد.",
      "intro_en": "In this form, your eligibility for a Blue Badge is assessed with clear and concise answers to generate a suitable response. ⭐ Adjust the impact strength (stars) and 📚 answer length (books) for each question. Uploading proof will improve the quality of the output.",
      "intro_uk": "У цій формі ваша відповідність критеріям для отримання Синього значка оцінюється за допомогою чітких та стислих відповідей для генерації відповідної відповіді. ⭐ Налаштуйте силу впливу (зірки) та 📚 довжину відповіді (книги) для кожного питання. Завантаження доказів покращить якість результату.",
      "questions": [
        { "id": "local_council", "type": "single-select", "question_fa": "شورای محل سکونت شما کدام است؟", "question_en": "Which is your local council?", "question_uk": "Яка ваша місцева рада?", "options": [ { "value": "england", "label_fa": "England", "label_en": "England", "label_uk": "Англія", "tip_fa": "اکثر درخواست‌ها آنلاین از طریق شورای محلی انجام می‌شود.", "tip_en": "Most applications are done online through the local council.", "tip_uk": "Більшість заявок подаються онлайн через місцеву раду." }, { "value": "scotland", "label_fa": "Scotland", "label_en": "Scotland", "label_uk": "Шотландія", "tip_fa": "قواعد مشابه است اما لینک درخواست متفاوت است.", "tip_en": "The rules are similar but the application link is different.", "tip_uk": "Правила схожі, але посилання для заявки відрізняється." }, { "value": "wales", "label_fa": "Wales", "label_en": "Wales", "label_uk": "Уельс", "tip_fa": "در ولز نیز درخواست از طریق council انجام می‌شود.", "tip_en": "In Wales, applications are also made through the council.", "tip_uk": "В Уельсі заявки також подаються через раду." }, { "value": "ni", "label_fa": "Northern Ireland", "label_en": "Northern Ireland", "label_uk": "Північна Ірландія", "tip_fa": "فرآیند متفاوت و وب‌سایت مخصوص دارد.", "tip_en": "The process is different and has a specific website.", "tip_uk": "Процес відрізняється і має окремий веб-сайт." } ], "allowProof": false, "starEnabled": true, "bookEnabled": true },
        { "id": "applicant_role", "type": "single-select", "question_fa": "شما راننده هستید یا مسافر (یا برای کودک زیر ۳ سال درخواست می‌دهید)؟", "question_en": "Are you the driver, a passenger (or applying for a child under 3)?", "question_uk": "Ви водій, пасажир (чи подаєте заявку на дитину до 3 років)?", "options": [ { "value": "driver", "label_fa": "راننده", "label_en": "Driver", "label_uk": "Водій", "tip_fa": "اگر خودتان رانندگی می‌کنید، توان حرکتی حین پیاده‌روی مهم است.", "tip_en": "If you drive yourself, your mobility while walking is important.", "tip_uk": "Якщо ви водите самі, важлива ваша мобільність під час ходьби." }, { "value": "passenger", "label_fa": "مسافر", "label_en": "Passenger", "label_uk": "Пасажир", "tip_fa": "اگر مسافر هستید، سختی جابه‌جایی تا خودرو و از خودرو اهمیت دارد.", "tip_en": "If you are a passenger, the difficulty of getting to and from the car is important.", "tip_uk": "Якщо ви пасажир, важлива складність дістатися до автомобіля та з нього." }, { "value": "child_u3", "label_fa": "کودک زیر ۳ سال", "label_en": "Child under 3", "label_uk": "Дитина до 3 років", "tip_fa": "برای کودکان نیاز به تجهیزات پزشکی یا خطرات فوری بررسی می‌شود.", "tip_en": "For children, the need for medical equipment or immediate risks is assessed.", "tip_uk": "Для дітей оцінюється потреба в медичному обладнанні або наявність безпосередніх ризиків." } ], "allowProof": true, "proof_hint_fa": "اگر کارت ناتوانی یا مدارک پزشکی دارید، بارگذاری کنید.", "proof_hint_en": "Upload a disability card or medical documents if you have them.", "proof_hint_uk": "Завантажте посвідчення про інвалідність або медичні документи, якщо вони у вас є.", "starEnabled": true, "bookEnabled": true },
        { "id": "pip_status", "type": "single-select", "question_fa": "وضعیت مزایای مرتبط (مثل PIP) شما چیست؟", "question_en": "What is your status regarding related benefits (like PIP)?", "question_uk": "Який ваш статус щодо відповідних пільг (наприклад, PIP)?", "options": [ { "value": "pip_enhanced_mobility", "label_fa": "PIP – Mobility (Enhanced)", "label_en": "PIP – Mobility (Enhanced)", "label_uk": "PIP – Мобільність (Підвищений)", "tip_fa": "امتیاز Mobility بالا معمولاً امتیاز مثبت برای Blue Badge است.", "tip_en": "A high Mobility score is usually a positive factor for a Blue Badge.", "tip_uk": "Високий бал за мобільністю зазвичай є позитивним фактором для отримання Синього значка." }, { "value": "pip_standard_mobility", "label_fa": "PIP – Mobility (Standard)", "label_en": "PIP – Mobility (Standard)", "label_uk": "PIP – Мобільність (Стандартний)", "tip_fa": "ممکن است نیاز به توضیح دقیق‌تری درباره محدودیت‌های حرکتی باشد.", "tip_en": "You may need to provide a more detailed explanation of your mobility limitations.", "tip_uk": "Можливо, вам доведеться надати більш детальне пояснення ваших обмежень мобільності." }, { "value": "none", "label_fa": "مزایای مرتبط ندارم", "label_en": "I do not have related benefits", "label_uk": "У мене немає відповідних пільг", "tip_fa": "اشکالی ندارد؛ محدودیت‌های حرکتی را دقیق توضیح می‌دهیم.", "tip_en": "That's okay; we will explain the mobility limitations in detail.", "tip_uk": "Це нормально; ми детально пояснимо обмеження мобільності." } ], "allowProof": true, "proof_hint_fa": "نامه تصمیم PIP یا اسناد مزایا را در صورت وجود بارگذاری کنید.", "proof_hint_en": "Upload your PIP decision letter or benefit documents if available.", "proof_hint_uk": "Завантажте лист-рішення по PIP або документи про пільги, якщо вони є.", "starEnabled": true, "bookEnabled": true },
        { "id": "walking_distance", "type": "single-select", "question_fa": "حداکثر مسافتی که معمولاً می‌توانید بدون توقف پیاده‌روی کنید چقدر است؟", "question_en": "What is the maximum distance you can usually walk without stopping?", "question_uk": "Яку максимальну відстань ви зазвичай можете пройти без зупинки?", "options": [ { "value": "under20m", "label_fa": "کمتر از ۲۰ متر", "label_en": "Less than 20 meters", "label_uk": "Менше 20 метрів", "tip_fa": "این سطح معمولاً نشان‌دهنده محدودیت شدید حرکتی است.", "tip_en": "This level usually indicates a severe mobility limitation.", "tip_uk": "Цей рівень зазвичай вказує на значне обмеження мобільності." }, { "value": "20to50m", "label_fa": "۲۰ تا ۵۰ متر", "label_en": "20 to 50 meters", "label_uk": "20-50 метрів", "tip_fa": "محدودیت قابل توجه؛ علائم و سختی را شرح دهید.", "tip_en": "Significant limitation; describe symptoms and difficulties.", "tip_uk": "Значне обмеження; опишіть симптоми та труднощі." }, { "value": "50to100m", "label_fa": "۵۰ تا ۱۰۰ متر", "label_en": "50 to 100 meters", "label_uk": "50-100 метрів", "tip_fa": "محدودیت متوسط؛ شرایط و توقف‌ها را توضیح دهید.", "tip_en": "Moderate limitation; explain conditions and stops.", "tip_uk": "Помірне обмеження; поясніть умови та зупинки." }, { "value": "over100m", "label_fa": "بیشتر از ۱۰۰ متر", "label_en": "More than 100 meters", "label_uk": "Більше 100 метрів", "tip_fa": "اگر درد/تنگی نفس/خستگی دارید، جزئیات بدهید.", "tip_en": "If you have pain/shortness of breath/fatigue, provide details.", "tip_uk": "Якщо у вас є біль/задишка/втома, надайте деталі." } ], "allowProof": true, "proof_hint_fa": "گزارش پزشک، فیزیوتراپی، یا نسخه دارو را بارگذاری کنید.", "proof_hint_en": "Upload a doctor's report, physiotherapy report, or prescription.", "proof_hint_uk": "Завантажте звіт лікаря, звіт фізіотерапевта або рецепт.", "starEnabled": true, "bookEnabled": true },
        { "id": "time_80m", "type": "short-text", "question_fa": "طی کردن ۸۰ متر معمولاً چقدر برای شما زمان می‌برد و چند بار باید بایستید؟", "question_en": "How long does it usually take you to walk 80 meters, and how many times do you need to stop?", "question_uk": "Скільки часу вам зазвичай потрібно, щоб пройти 80 метрів, і скільки разів вам потрібно зупинитися?", "placeholder_fa": "مثلاً: حدود ۳ دقیقه، ۲ بار توقف به‌دلیل درد زانو", "placeholder_en": "e.g., About 3 minutes, 2 stops due to knee pain", "placeholder_uk": "напр., Близько 3 хвилин, 2 зупинки через біль у коліні", "allowProof": false, "starEnabled": true, "bookEnabled": true },
        { "id": "aids", "type": "multi-select", "question_fa": "برای راه رفتن از چه وسایل کمکی استفاده می‌کنید؟", "question_en": "What walking aids do you use?", "question_uk": "Які допоміжні засоби для ходьби ви використовуєте?", "options": [ { "value": "stick", "label_fa": "عصا", "label_en": "Walking stick", "label_uk": "Палиця" }, { "value": "crutches", "label_fa": "عصای زیر بغل", "label_en": "Crutches", "label_uk": "Милиці" }, { "value": "walker", "label_fa": "واکر", "label_en": "Walker", "label_uk": "Ходунки" }, { "value": "wheelchair", "label_fa": "ویلچر/اسکوتر متحرک", "label_en": "Wheelchair/Mobility scooter", "label_uk": "Інвалідний візок/Мобільний скутер" }, { "value": "none", "label_fa": "هیچ‌کدام", "label_en": "None", "label_uk": "Жодних" } ], "allowProof": true, "proof_hint_fa": "عکس یا نسخه تجویزی ابزار کمکی مفید است.", "proof_hint_en": "A photo or prescription for the aid is helpful.", "proof_hint_uk": "Фото або рецепт на допоміжний засіб буде корисним.", "starEnabled": true, "bookEnabled": true },
        { "id": "non_visible", "type": "single-select", "question_fa": "آیا مشکل غیرقابل مشاهده (مثل اوتیسم، اضطراب شدید، مشکلات قلب/ریه) دارید که حرکت را دشوار می‌کند؟", "question_en": "Do you have a non-visible condition (like autism, severe anxiety, heart/lung problems) that makes walking difficult?", "question_uk": "Чи є у вас невидимий стан (наприклад, аутизм, сильна тривожність, проблеми з серцем/легенями), що ускладнює ходьбу?", "options": [ { "value": "yes", "label_fa": "بله", "label_en": "Yes", "label_uk": "Так", "tip_fa": "علائم و تأثیر روزمره را با مثال توضیح بدهید.", "tip_en": "Explain the symptoms and daily impact with examples.", "tip_uk": "Поясніть симптоми та щоденний вплив на прикладах." }, { "value": "no", "label_fa": "خیر", "label_en": "No", "label_uk": "Ні" } ], "allowProof": true, "proof_hint_fa": "نامه پزشک/متخصص، ارزیابی‌ها یا طرح‌های مراقبتی را بارگذاری کنید.", "proof_hint_en": "Upload a letter from a doctor/specialist, assessments, or care plans.", "proof_hint_uk": "Завантажте лист від лікаря/спеціаліста, оцінки або плани догляду.", "starEnabled": true, "bookEnabled": true },
        { "id": "episodes", "type": "long-text", "question_fa": "اپیزودها یا وضعیت‌های خاصی که باعث توقف ناگهانی یا خطر هنگام راه رفتن می‌شود را توضیح دهید.", "question_en": "Describe any episodes or specific situations that cause you to stop suddenly or be at risk while walking.", "question_uk": "Опишіть будь-які епізоди або конкретні ситуації, які змушують вас раптово зупинятися або наражають на ризик під час ходьби.", "placeholder_fa": "مثلاً تنگی نفس ناگهانی, سرگیجه, سقوط, درد شدید...", "placeholder_en": "e.g., sudden breathlessness, dizziness, falls, severe pain...", "placeholder_uk": "напр., раптова задишка, запаморочення, падіння, сильний біль...", "allowProof": true, "starEnabled": true, "bookEnabled": true },
        { "id": "photo_id", "type": "file", "question_fa": "عکس پاسپورتی و مدرک هویتی را بارگذاری کنید.", "question_en": "Upload a passport-style photo and proof of identity.", "question_uk": "Завантажте фотографію паспортного формату та документ, що посвідчує особу.", "proof_hint_fa": "پس‌زمینه ساده، صورت کامل، نور مناسب.", "proof_hint_en": "Simple background, full face, good lighting.", "proof_hint_uk": "Простий фон, повне обличчя, хороше освітлення.", "allowProof": true, "starEnabled": false, "bookEnabled": false }
      ],
  },
  council_tax: {
    "moduleId": "council_tax",
    "title_fa": "کاهش مالیات شورای محلی (Council Tax Reduction)",
    "title_en": "Council Tax Reduction",
    "title_uk": "Знижка на муніципальний податок (Council Tax Reduction)",
    "intro_fa": "این فرم برای کسانی است که درآمد پایین دارند یا در شرایط خاص زندگی می‌کنند و می‌خواهند تخفیف یا کمک‌هزینه Council Tax بگیرند. لطفاً سوالات را به دقت پر کنید و مدارک لازم را بارگذاری کنید.",
    "intro_en": "This form is for those with low income or in special circumstances who want to apply for a Council Tax discount or support. Please fill out the questions carefully and upload the necessary documents.",
    "intro_uk": "Ця форма призначена для тих, хто має низький дохід або перебуває в особливих обставинах і хоче подати заявку на знижку або підтримку з муніципального податку. Будь ласка, уважно заповніть запитання та завантажте необхідні документи.",
    "questions": [
      { "id": "local_council", "type": "short-text", "question_fa": "نام شورای محل سکونت شما چیست؟", "question_en": "What is the name of your local council?", "question_uk": "Як називається ваша місцева рада?", "placeholder_fa": "مثلاً: London Borough of Camden", "placeholder_en": "e.g., London Borough of Camden", "placeholder_uk": "напр., London Borough of Camden", "allowProof": false, "starEnabled": false, "bookEnabled": false },
      { "id": "household", "type": "multi-select", "question_fa": "چه کسانی در منزل شما زندگی می‌کنند؟", "question_en": "Who lives in your household?", "question_uk": "Хто проживає у вашому домогосподарстві?", "options": [ { "value": "single", "label_fa": "فقط من (زندگی مجردی)", "label_en": "Just me (living alone)", "label_uk": "Тільки я (проживаю один)" }, { "value": "partner", "label_fa": "همسر/پارتنر", "label_en": "Spouse/Partner", "label_uk": "Чоловік/дружина/партнер" }, { "value": "children", "label_fa": "فرزند یا فرزندان", "label_en": "Child or children", "label_uk": "Дитина або діти" }, { "value": "other_adults", "label_fa": "بزرگسالان دیگر (مثلاً هم‌خانه)", "label_en": "Other adults (e.g., flatmate)", "label_uk": "Інші дорослі (напр., співмешканець)" } ], "allowProof": false, "starEnabled": false, "bookEnabled": false },
      { "id": "income", "type": "single-select", "question_fa": "منبع اصلی درآمد شما چیست؟", "question_en": "What is your main source of income?", "question_uk": "Яке ваше основне джерело доходу?", "options": [ { "value": "job", "label_fa": "شغل/حقوق", "label_en": "Employment/Salary", "label_uk": "Робота/Зарплата" }, { "value": "benefits", "label_fa": "کمک‌هزینه‌های دولتی (مثل UC, ESA)", "label_en": "Government benefits (e.g., UC, ESA)", "label_uk": "Державні пільги (напр., UC, ESA)" }, { "value": "pension", "label_fa": "بازنشستگی", "label_en": "Pension", "label_uk": "Пенсія" }, { "value": "none", "label_fa": "بدون درآمد", "label_en": "No income", "label_uk": "Без доходу" } ], "allowProof": true, "proof_hint_fa": "مدارک درآمد (فیش حقوقی، نامه مزایا، یا صورت‌حساب بانکی) را بارگذاری کنید.", "proof_hint_en": "Upload proof of income (payslip, benefit letter, or bank statement).", "proof_hint_uk": "Завантажте підтвердження доходу (платіжну відомість, лист про пільги або банківську виписку).", "starEnabled": false, "bookEnabled": false },
      { "id": "benefits", "type": "multi-select", "question_fa": "آیا یکی از این مزایا را دریافت می‌کنید؟", "question_en": "Do you receive any of these benefits?", "question_uk": "Чи отримуєте ви якісь із цих пільг?", "options": [ { "value": "uc", "label_fa": "Universal Credit", "label_en": "Universal Credit", "label_uk": "Universal Credit" }, { "value": "esa", "label_fa": "Employment and Support Allowance", "label_en": "Employment and Support Allowance", "label_uk": "Employment and Support Allowance" }, { "value": "jsa", "label_fa": "Jobseeker’s Allowance", "label_en": "Jobseeker’s Allowance", "label_uk": "Jobseeker’s Allowance" }, { "value": "pip", "label_fa": "PIP (Personal Independence Payment)", "label_en": "PIP (Personal Independence Payment)", "label_uk": "PIP (Personal Independence Payment)" }, { "value": "none", "label_fa": "هیچ‌کدام", "label_en": "None of the above", "label_uk": "Жодної з перелічених" } ], "allowProof": true, "proof_hint_fa": "نامه تأییدیه مزایا یا پرینت حساب بانکی.", "proof_hint_en": "Benefit award letter or bank statement printout.", "proof_hint_uk": "Лист про призначення пільг або роздруківка з банківського рахунку.", "starEnabled": false, "bookEnabled": false },
      { "id": "student_status", "type": "single-select", "question_fa": "آیا دانشجو هستید؟", "question_en": "Are you a student?", "question_uk": "Ви студент?", "options": [ { "value": "yes_full", "label_fa": "بله، تمام‌وقت", "label_en": "Yes, full-time", "label_uk": "Так, денна форма" }, { "value": "yes_part", "label_fa": "بله، پاره‌وقت", "label_en": "Yes, part-time", "label_uk": "Так, заочна форма" }, { "value": "no", "label_fa": "خیر", "label_en": "No", "label_uk": "Ні" } ], "allowProof": true, "proof_hint_fa": "نامه دانشگاه یا کارت دانشجویی.", "proof_hint_en": "University letter or student ID card.", "proof_hint_uk": "Лист з університету або студентський квиток.", "starEnabled": false, "bookEnabled": false },
      { "id": "disability", "type": "single-select", "question_fa": "آیا شما یا کسی در خانواده معلولیت دارد؟", "question_en": "Do you or someone in your family have a disability?", "question_uk": "Чи є у вас або у когось із вашої родини інвалідність?", "options": [ { "value": "yes", "label_fa": "بله", "label_en": "Yes", "label_uk": "Так" }, { "value": "no", "label_fa": "خیر", "label_en": "No", "label_uk": "Ні" } ], "allowProof": true, "proof_hint_fa": "مدارک پزشکی یا گواهی PIP/DLA.", "proof_hint_en": "Medical documents or PIP/DLA award letter.", "proof_hint_uk": "Медичні документи або лист про призначення PIP/DLA.", "starEnabled": false, "bookEnabled": false },
      { "id": "other_notes", "type": "long-text", "question_fa": "توضیحات اضافی که فکر می‌کنید به پرونده شما کمک می‌کند را بنویسید.", "question_en": "Write any additional information you think will help your case.", "question_uk": "Напишіть будь-яку додаткову інформацію, яка, на вашу думку, допоможе вашій справі.", "placeholder_fa": "مثلاً: به دلیل بیماری طولانی‌مدت قادر به کار نیستم...", "placeholder_en": "e.g., I am unable to work due to a long-term illness...", "placeholder_uk": "напр., Я не можу працювати через тривалу хворобу...", "allowProof": false, "starEnabled": false, "bookEnabled": false }
    ]
  },
  dvla_forms: {
    "moduleId": "dvla_forms",
    "title_fa": "فرم‌های DVLA (گواهینامه رانندگی)",
    "title_en": "DVLA Forms (Driving Licence)",
    "title_uk": "Форми DVLA (Водійське посвідчення)",
    "intro_fa": "این بخش برای راهنمایی ایرانیان مقیم UK در پر کردن فرم‌های DVLA طراحی شده است. شامل درخواست گواهینامه جدید، تعویض گواهینامه خارجی، یا تمدید می‌باشد.",
    "intro_en": "This section is designed to guide Iranians in the UK in filling out DVLA forms. It includes applying for a new licence, exchanging a foreign licence, or renewing an existing one.",
    "intro_uk": "Цей розділ призначений для допомоги українцям у Великобританії у заповненні форм DVLA. Він включає подання заявки на нове посвідчення, обмін іноземного посвідчення або поновлення існуючого.",
    "questions": [
      { "id": "application_type", "type": "single-select", "question_fa": "چه نوع درخواستی دارید؟", "question_en": "What type of application do you have?", "question_uk": "Який тип заявки ви подаєте?", "options": [ { "value": "new_provisional", "label_fa": "گواهینامه جدید (Provisional)", "label_en": "New Provisional Licence", "label_uk": "Нове тимчасове посвідчення (Provisional)" }, { "value": "full_uk", "label_fa": "گواهینامه کامل UK (Full UK Licence)", "label_en": "Full UK Licence", "label_uk": "Повне посвідчення Великобританії (Full UK Licence)" }, { "value": "exchange_foreign", "label_fa": "تعویض گواهینامه خارجی به UK", "label_en": "Exchange Foreign Licence to UK", "label_uk": "Обмін іноземного посвідчення на британське" }, { "value": "renewal", "label_fa": "تمدید گواهینامه موجود", "label_en": "Renew Existing Licence", "label_uk": "Поновлення існуючого посвідчення" }, { "value": "replacement", "label_fa": "صدور دوباره (در صورت گم‌شدن/دزدیده‌شدن)", "label_en": "Replacement (if lost/stolen)", "label_uk": "Заміна (у разі втрати/крадіжки)" } ], "allowProof": false },
      { "id": "identity", "type": "multi-select", "question_fa": "کدام مدارک هویتی را دارید؟", "question_en": "Which identity documents do you have?", "question_uk": "Які документи, що посвідчують особу, у вас є?", "options": [ { "value": "passport", "label_fa": "پاسپورت معتبر", "label_en": "Valid Passport", "label_uk": "Дійсний паспорт" }, { "value": "brp", "label_fa": "کارت اقامت بیومتریک (BRP)", "label_en": "Biometric Residence Permit (BRP)", "label_uk": "Біометричний дозвіл на проживання (BRP)" }, { "value": "id_card", "label_fa": "کارت شناسایی ملی", "label_en": "National ID Card", "label_uk": "Національне посвідчення особи" }, { "value": "none", "label_fa": "هیچ‌کدام", "label_en": "None", "label_uk": "Жодних" } ], "allowProof": true, "proof_hint_fa": "عکس واضح پاسپورت یا BRP بارگذاری کنید.", "proof_hint_en": "Upload a clear photo of your passport or BRP.", "proof_hint_uk": "Завантажте чітке фото вашого паспорта або BRP." },
      { "id": "address", "type": "short-text", "question_fa": "آدرس محل سکونت فعلی شما در UK چیست؟", "question_en": "What is your current address in the UK?", "question_uk": "Яка ваша поточна адреса у Великобританії?", "placeholder_fa": "مثلاً: 221B Baker Street, London", "placeholder_en": "e.g., 221B Baker Street, London", "placeholder_uk": "напр., 221B Baker Street, London", "allowProof": true, "proof_hint_fa": "صورت‌حساب آب/برق یا Council Tax را بارگذاری کنید.", "proof_hint_en": "Upload a utility bill or Council Tax statement.", "proof_hint_uk": "Завантажте рахунок за комунальні послуги або виписку про муніципальний податок." },
      { "id": "foreign_license", "type": "single-select", "question_fa": "آیا گواهینامه خارجی دارید؟", "question_en": "Do you have a foreign driving licence?", "question_uk": "Чи є у вас іноземне водійське посвідчення?", "options": [ { "value": "iranian", "label_fa": "بله، ایرانی", "label_en": "Yes, Iranian", "label_uk": "Так, українське" }, { "value": "other", "label_fa": "بله، کشور دیگر", "label_en": "Yes, from another country", "label_uk": "Так, з іншої країни" }, { "value": "none", "label_fa": "خیر", "label_en": "No", "label_uk": "Ні" } ], "allowProof": true, "proof_hint_fa": "عکس یا اسکن گواهینامه خارجی را بارگذاری کنید.", "proof_hint_en": "Upload a photo or scan of your foreign licence.", "proof_hint_uk": "Завантажте фото або скан вашого іноземного посвідчення." },
      { "id": "medical_conditions", "type": "single-select", "question_fa": "آیا شرایط پزشکی خاصی دارید که بر رانندگی تاثیر بگذارد؟", "question_en": "Do you have any medical conditions that could affect your driving?", "question_uk": "Чи є у вас медичні стани, які можуть вплинути на ваше водіння?", "options": [ { "value": "yes", "label_fa": "بله (مثلاً دیابت، مشکلات بینایی)", "label_en": "Yes (e.g., diabetes, vision problems)", "label_uk": "Так (напр., діабет, проблеми із зором)" }, { "value": "no", "label_fa": "خیر", "label_en": "No", "label_uk": "Ні" } ], "allowProof": true, "proof_hint_fa": "گواهی پزشکی یا نامه دکتر را بارگذاری کنید.", "proof_hint_en": "Upload a medical certificate or a letter from your doctor.", "proof_hint_uk": "Завантажте медичну довідку або лист від лікаря." },
      { "id": "vision_test", "type": "single-select", "question_fa": "آیا تست بینایی انجام داده‌اید؟", "question_en": "Have you taken a vision test?", "question_uk": "Ви проходили перевірку зору?", "options": [ { "value": "yes_passed", "label_fa": "بله، قبول شده‌ام", "label_en": "Yes, I passed", "label_uk": "Так, я пройшов(ла)" }, { "value": "yes_failed", "label_fa": "بله، اما قبول نشدم", "label_en": "Yes, but I failed", "label_uk": "Так, але я не пройшов(ла)" }, { "value": "no", "label_fa": "خیر", "label_en": "No", "label_uk": "Ні" } ], "allowProof": true, "proof_hint_fa": "نتیجه تست بینایی یا نسخه عینک را بارگذاری کنید.", "proof_hint_en": "Upload your vision test result or glasses prescription.", "proof_hint_uk": "Завантажте результат перевірки зору або рецепт на окуляри." },
      { "id": "photo", "type": "file", "question_fa": "عکس پاسپورتی اخیر خود را بارگذاری کنید.", "question_en": "Upload a recent passport-style photo.", "question_uk": "Завантажте свою недавню фотографію паспортного формату.", "proof_hint_fa": "پس‌زمینه روشن، بدون عینک آفتابی یا کلاه.", "proof_hint_en": "Light background, no sunglasses or hat.", "proof_hint_uk": "Світлий фон, без сонцезахисних окулярів чи капелюха.", "allowProof": true },
      { "id": "notes", "type": "long-text", "question_fa": "توضیحات اضافی:", "question_en": "Additional notes:", "question_uk": "Додаткові примітки:", "placeholder_fa": "مثلاً: گواهینامه ایرانی من فقط یک‌ساله است...", "placeholder_en": "e.g., My Iranian licence is only valid for one year...", "placeholder_uk": "напр., Моє українське посвідчення дійсне лише один рік...", "allowProof": false }
    ]
  },
  hmrc_forms: {
      "moduleId": "hmrc_forms", "title_fa": "فرم‌های HMRC (مالیات انگلستان)", "title_en": "HMRC Forms (UK Tax)", "title_uk": "Форми HMRC (Податки Великобританії)", "intro_fa": "در این ماژول، می‌توانید برای Self Assessment (اظهارنامه مالیاتی) یا Child Tax Credit راهنمای دقیق دریافت کنید. لطفاً نوع درخواست را انتخاب کنید و مدارک مرتبط را بارگذاری نمایید.", "intro_en": "In this module, you can get detailed guidance for Self Assessment or Child Tax Credit. Please select the application type and upload the relevant documents.", "intro_uk": "У цьому модулі ви можете отримати детальну інструкцію для Self Assessment (податкова декларація) або Child Tax Credit. Будь ласка, виберіть тип заявки та завантажте відповідні документи.",
      "questions": [
        { "id": "hmrc_flow", "type": "single-select", "question_fa": "کدام مورد را نیاز دارید؟", "question_en": "Which one do you need?", "question_uk": "Що вам потрібно?", "options": [ { "value": "self_assessment", "label_fa": "Self Assessment (اظهارنامه مالیاتی)", "label_en": "Self Assessment", "label_uk": "Self Assessment (Податкова декларація)" }, { "value": "child_tax_credit", "label_fa": "Child Tax Credit", "label_en": "Child Tax Credit", "label_uk": "Child Tax Credit" } ], "allowProof": false },
        { "id": "sa_utr", "type": "short-text", "when": { "hmrc_flow": "self_assessment" }, "question_fa": "آیا UTR (شماره مرجع مالیاتی) دارید؟", "question_en": "Do you have a UTR (Unique Taxpayer Reference)?", "question_uk": "Чи є у вас UTR (Унікальний номер платника податків)?", "placeholder_fa": "مثلاً: 10 رقمی UTR یا بنویسید «ندارم»", "placeholder_en": "e.g., 10-digit UTR or write 'I don't have one'", "placeholder_uk": "напр., 10-значний UTR або напишіть 'У мене немає'", "allowProof": true, "proof_hint_fa": "نامه‌های HMRC یا تصویر حساب آنلاین اگر دارید.", "proof_hint_en": "HMRC letters or a screenshot of your online account if you have it.", "proof_hint_uk": "Листи від HMRC або скріншот вашого онлайн-акаунту, якщо він є." },
        { "id": "sa_income_sources", "type": "multi-select", "when": { "hmrc_flow": "self_assessment" }, "question_fa": "منابع درآمد شما در سال مالی گذشته چیست؟", "question_en": "What were your sources of income in the last tax year?", "question_uk": "Які у вас були джерела доходу за останній податковий рік?", "options": [ { "value": "employment", "label_fa": "حقوق‌بگیری (P60/P45/P11D)", "label_en": "Employment (P60/P45/P11D)", "label_uk": "Робота за наймом (P60/P45/P11D)" }, { "value": "self_employed", "label_fa": "خویش‌فرما/سلف‌امپلویمنت", "label_en": "Self-employed", "label_uk": "Самозайнятість" }, { "value": "property", "label_fa": "اجاره ملک", "label_en": "Property rental", "label_uk": "Оренда нерухомості" }, { "value": "dividend", "label_fa": "سود سهام/بهره", "label_en": "Dividends/Interest", "label_uk": "Дивіденди/Відсотки" }, { "value": "other", "label_fa": "سایر", "label_en": "Other", "label_uk": "Інше" } ], "allowProof": true, "proof_hint_fa": "P60/P45، صورت‌حساب بانکی، فاکتورها، قرارداد اجاره و…", "proof_hint_en": "P60/P45, bank statements, invoices, rental agreements, etc.", "proof_hint_uk": "P60/P45, банківські виписки, рахунки-фактури, договори оренди тощо." },
        { "id": "sa_turnover_costs", "type": "group", "when": { "hmrc_flow": "self_assessment" }, "question_fa": "خلاصه مالی سلف‌امپلویمنت (در صورت وجود):", "question_en": "Self-employment financial summary (if applicable):", "question_uk": "Фінансовий звіт по самозайнятості (якщо застосовно):", "children": [ { "id": "turnover", "type": "currency", "question_fa": "گردش‌مالی/درآمد سالانه:", "question_en": "Annual turnover/income:", "question_uk": "Річний обіг/дохід:", "placeholder_fa": "£", "placeholder_en": "£", "placeholder_uk": "£" }, { "id": "expenses", "type": "currency", "question_fa": "هزینه‌های قابل قبول:", "question_en": "Allowable expenses:", "question_uk": "Дозволені витрати:", "placeholder_fa": "£", "placeholder_en": "£", "placeholder_uk": "£" } ], "allowProof": true, "proof_hint_fa": "فاکتورها/رسیدها/اکسل حسابداری.", "proof_hint_en": "Invoices/receipts/accounting spreadsheet.", "proof_hint_uk": "Рахунки-фактури/квитанції/бухгалтерська таблиця." },
        { "id": "sa_property_details", "type": "long-text", "when": { "hmrc_flow": "self_assessment" }, "question_fa": "اگر درآمد اجاره دارید، توضیح دهید:", "question_en": "If you have rental income, please explain:", "question_uk": "Якщо у вас є дохід від оренди, будь ласка, поясніть:", "placeholder_fa": "مبلغ اجاره، هزینه‌ها، دوره خالی بودن، هزینه‌های تعمیر و…", "placeholder_en": "Rental amount, expenses, void periods, repair costs, etc.", "placeholder_uk": "Сума оренди, витрати, періоди простою, витрати на ремонт тощо.", "allowProof": true },
        { "id": "sa_payments", "type": "single-select", "when": { "hmrc_flow": "self_assessment" }, "question_fa": "پرداخت‌های قبلی روی حساب (Payments on Account) داشته‌اید؟", "question_en": "Have you made any Payments on Account?", "question_uk": "Чи робили ви авансові платежі (Payments on Account)?", "options": [ { "value": "yes", "label_fa": "بله", "label_en": "Yes", "label_uk": "Так" }, { "value": "no", "label_fa": "خیر/نامشخص", "label_en": "No/Unsure", "label_uk": "Ні/Не впевнений(а)" } ], "allowProof": true, "proof_hint_fa": "اسکرین‌شات از اکانت HMRC یا رسید پرداخت.", "proof_hint_en": "Screenshot from your HMRC account or payment receipt.", "proof_hint_uk": "Скріншот з вашого акаунту HMRC або квитанція про оплату." },
        { "id": "ctc_children", "type": "group", "when": { "hmrc_flow": "child_tax_credit" }, "question_fa": "اطلاعات فرزندان:", "question_en": "Children's information:", "question_uk": "Інформація про дітей:", "children": [ { "id": "num_children", "type": "number", "question_fa": "تعداد فرزندان:", "question_en": "Number of children:", "question_uk": "Кількість дітей:", "placeholder_fa": "مثلاً: 2", "placeholder_en": "e.g., 2", "placeholder_uk": "напр., 2" }, { "id": "ages", "type": "short-text", "question_fa": "سن فرزندان:", "question_en": "Ages of children:", "question_uk": "Вік дітей:", "placeholder_fa": "مثلاً: 3 و 7 سال", "placeholder_en": "e.g., 3 and 7 years old", "placeholder_uk": "напр., 3 та 7 років" } ], "allowProof": true, "proof_hint_fa": "گواهی تولد/مدارک مدرسه.", "proof_hint_en": "Birth certificates/school documents.", "proof_hint_uk": "Свідоцтва про народження/шкільні документи." },
        { "id": "ctc_status", "type": "single-select", "when": { "hmrc_flow": "child_tax_credit" }, "question_fa": "وضعیت زندگی/سرپرستی:", "question_en": "Living/guardianship status:", "question_uk": "Статус проживання/опіки:", "options": [ { "value": "single", "label_fa": "سرپرست تنها", "label_en": "Single parent", "label_uk": "Один з батьків" }, { "value": "couple", "label_fa": "زوج (همراه با شریک زندگی)", "label_en": "Couple (with a partner)", "label_uk": "Пара (з партнером)" }, { "value": "shared_care", "label_fa": "سرپرستی مشترک", "label_en": "Shared care", "label_uk": "Спільна опіка" } ], "allowProof": false },
        { "id": "ctc_income", "type": "currency", "when": { "hmrc_flow": "child_tax_credit" }, "question_fa": "درآمد سالانه خانوار (تقریبی):", "question_en": "Annual household income (approximate):", "question_uk": "Річний дохід домогосподарства (приблизно):", "placeholder_fa": "£", "placeholder_en": "£", "placeholder_uk": "£", "allowProof": true, "proof_hint_fa": "P60/P45 یا صورت‌حساب بانکی.", "proof_hint_en": "P60/P45 or bank statement.", "proof_hint_uk": "P60/P45 або банківська виписка." },
        { "id": "ctc_benefits", "type": "multi-select", "when": { "hmrc_flow": "child_tax_credit" }, "question_fa": "مزایا/وضعیت‌های تاثیرگذار:", "question_en": "Affecting benefits/situations:", "question_uk": "Пільги/ситуації, що впливають:", "options": [ { "value": "disability_child", "label_fa": "ناتوانی کودک", "label_en": "Child's disability", "label_uk": "Інвалідність дитини" }, { "value": "childcare_costs", "label_fa": "هزینه مهد/نگهداری کودک", "label_en": "Childcare costs", "label_uk": "Витрати на догляд за дитиною" }, { "value": "none", "label_fa": "هیچ‌کدام", "label_en": "None", "label_uk": "Жодних" } ], "allowProof": true, "proof_hint_fa": "مدارک هزینه مهد، ارزیابی ناتوانی، یا نامه‌های مرتبط.", "proof_hint_en": "Childcare cost documents, disability assessment, or related letters.", "proof_hint_uk": "Документи про витрати на догляд за дитиною, оцінка інвалідності або пов'язані листи." }
      ]
  },
  carers_allowance: {
    "moduleId": "carers_allowance", "title_fa": "کمک‌هزینه مراقب (Carer’s Allowance)", "title_en": "Carer's Allowance", "title_uk": "Допомога по догляду (Carer's Allowance)", "intro_fa": "اگر شما حداقل 35 ساعت در هفته از فردی که مزایای ناتوانی دریافت می‌کند مراقبت می‌کنید، ممکن است واجد شرایط Carer’s Allowance باشید. به سوالات زیر پاسخ دهید و مدارک مرتبط را بارگذاری کنید.", "intro_en": "If you care for someone for at least 35 hours a week and they receive certain disability benefits, you might be eligible for Carer's Allowance. Answer the questions below and upload relevant documents.", "intro_uk": "Якщо ви доглядаєте за кимось щонайменше 35 годин на тиждень, і ця людина отримує певні пільги по інвалідності, ви можете мати право на Допомогу по догляду. Дайте відповідь на запитання нижче та завантажте відповідні документи.",
    "questions": [
        { "id": "cared_person_benefit", "type": "multi-select", "question_fa": "فردی که از او مراقبت می‌کنید کدام مزایا را دریافت می‌کند؟", "question_en": "Which benefits does the person you care for receive?", "question_uk": "Які пільги отримує людина, за якою ви доглядаєте?", "options": [ { "value": "pip_daily_living", "label_fa": "PIP - بخش Daily Living", "label_en": "PIP - Daily Living component", "label_uk": "PIP - компонент повсякденного життя" }, { "value": "dla_middle_high_care", "label_fa": "DLA - نرخ Middle/High Care", "label_en": "DLA - Middle or High rate care component", "label_uk": "DLA - компонент догляду середнього або високого рівня" }, { "value": "attendance_allowance", "label_fa": "Attendance Allowance", "label_en": "Attendance Allowance", "label_uk": "Attendance Allowance" }, { "value": "armed_forces_independence", "label_fa": "Armed Forces Independence Payment", "label_en": "Armed Forces Independence Payment", "label_uk": "Armed Forces Independence Payment" }, { "value": "none", "label_fa": "هیچ‌کدام/نامشخص", "label_en": "None/Unsure", "label_uk": "Жодної/Не впевнений(а)" } ], "allowProof": true, "proof_hint_fa": "نامه مزایای فرد تحت مراقبت (تصمیم‌نامه/اسکرین‌شات).", "proof_hint_en": "Benefit letter for the person being cared for (decision letter/screenshot).", "proof_hint_uk": "Лист про пільги особи, за якою доглядають (лист-рішення/скріншот)." },
        { "id": "hours_per_week", "type": "single-select", "question_fa": "چند ساعت در هفته مراقبت می‌کنید؟", "question_en": "How many hours a week do you spend caring?", "question_uk": "Скільки годин на тиждень ви витрачаєте на догляд?", "options": [ { "value": "lt35", "label_fa": "کمتر از 35 ساعت", "label_en": "Less than 35 hours", "label_uk": "Менше 35 годин" }, { "value": "gte35", "label_fa": "35 ساعت یا بیشتر", "label_en": "35 hours or more", "label_uk": "35 годин або більше" } ], "allowProof": false },
        { "id": "work_earnings", "type": "group", "question_fa": "وضعیت کار و درآمد شما:", "question_en": "Your work and earnings status:", "question_uk": "Ваш робочий статус та доходи:", "children": [ { "id": "employment_status", "type": "single-select", "question_fa": "وضعیت اشتغال:", "question_en": "Employment status:", "question_uk": "Статус зайнятості:", "options": [ { "value": "employed", "label_fa": "شاغل (کارمندی)", "label_en": "Employed", "label_uk": "Працевлаштований(а)" }, { "value": "self_employed", "label_fa": "خویش‌فرما", "label_en": "Self-employed", "label_uk": "Самозайнятий(а)" }, { "value": "unemployed", "label_fa": "بیکار", "label_en": "Unemployed", "label_uk": "Безробітний(а)" } ]}, { "id": "net_earnings_week", "type": "currency", "question_fa": "درآمد خالص هفتگی (بعد از کسورات):", "question_en": "Net weekly earnings (after deductions):", "question_uk": "Чистий тижневий заробіток (після відрахувань):", "placeholder_fa": "£", "placeholder_en": "£", "placeholder_uk": "£" } ], "allowProof": true, "proof_hint_fa": "فیش حقوق/سوابق بانکی/خلاصه درآمد خویش‌فرما.", "proof_hint_en": "Payslips/bank statements/self-employment income summary.", "proof_hint_uk": "Платіжні відомості/банківські виписки/звіт про доходи самозайнятої особи." },
        { "id": "education", "type": "single-select", "question_fa": "وضعیت تحصیل شما چیست؟", "question_en": "What is your education status?", "question_uk": "Який ваш освітній статус?", "options": [ { "value": "ft_21plus", "label_fa": "دانشجو تمام‌وقت (۲۱ ساعت+ در هفته)", "label_en": "Full-time student (21+ hours a week)", "label_uk": "Студент денної форми (21+ годин на тиждень)" }, { "value": "pt_or_none", "label_fa": "پاره‌وقت یا دانشجو نیستم", "label_en": "Part-time or not a student", "label_uk": "Заочна форма або не студент" } ], "allowProof": true, "proof_hint_fa": "نامه دانشگاه یا برنامه درسی اگر تمام‌وقت هستید.", "proof_hint_en": "University letter or course schedule if you are full-time.", "proof_hint_uk": "Лист з університету або розклад занять, якщо ви навчаєтесь на денній формі." },
        { "id": "overlap_benefits", "type": "multi-select", "question_fa": "مزایای دیگری که دریافت می‌کنید (برای قوانین همپوشانی):", "question_en": "Other benefits you receive (for overlapping benefit rules):", "question_uk": "Інші пільги, які ви отримуєте (для правил перекриття пільг):", "options": [ { "value": "state_pension", "label_fa": "State Pension", "label_en": "State Pension", "label_uk": "Державна пенсія" }, { "value": "new_style_esa_jsa", "label_fa": "New Style ESA/JSA", "label_en": "New Style ESA/JSA", "label_uk": "New Style ESA/JSA" }, { "value": "none", "label_fa": "هیچ‌کدام", "label_en": "None", "label_uk": "Жодних" } ], "allowProof": true, "proof_hint_fa": "نامه مزایا/اسکرین‌شات حساب کاربری.", "proof_hint_en": "Benefit letter/account screenshot.", "proof_hint_uk": "Лист про пільги/скріншот облікового запису." },
        { "id": "care_tasks", "type": "long-text", "question_fa": "کارهای مراقبتی‌ای که انجام می‌دهید چیست؟", "question_en": "What caring tasks do you perform?", "question_uk": "Які завдання по догляду ви виконуєте?", "placeholder_fa": "مثلاً: کمک در شست‌وشو/لباس پوشیدن، آماده‌سازی غذا، دارو، همراهی در مراجعات...", "placeholder_en": "e.g., helping with washing/dressing, preparing meals, medication, accompanying to appointments...", "placeholder_uk": "напр., допомога з миттям/одяганням, приготування їжі, ліки, супровід на прийоми..." },
        { "id": "relationship_address", "type": "group", "question_fa": "نسبت با فرد تحت مراقبت و محل سکونت:", "question_en": "Relationship with the person cared for and address:", "question_uk": "Відносини з особою, за якою доглядаєте, та адреса:", "children": [ { "id": "relationship", "type": "short-text", "question_fa": "نسبت شما:", "question_en": "Your relationship:", "question_uk": "Ваші стосунки:", "placeholder_fa": "مثلاً: همسر/فرزند/دوست/آشنا", "placeholder_en": "e.g., spouse/child/friend/acquaintance", "placeholder_uk": "напр., чоловік/дружина/дитина/друг/знайомий" }, { "id": "same_address", "type": "single-select", "question_fa": "آیا در همان آدرس زندگی می‌کنید؟", "question_en": "Do you live at the same address?", "question_uk": "Чи проживаєте ви за тією ж адресою?", "options": [ { "value": "yes", "label_fa": "بله", "label_en": "Yes", "label_uk": "Так" }, { "value": "no", "label_fa": "خیر", "label_en": "No", "label_uk": "Ні" } ]} ], "allowProof": true, "proof_hint_fa": "مدرک آدرس (قبوض/لیز) در صورت نیاز.", "proof_hint_en": "Proof of address (bills/lease) if needed.", "proof_hint_uk": "Підтвердження адреси (рахунки/договір оренди), якщо потрібно." }
    ]
  },
  nhs_forms: {
    "moduleId": "nhs_forms", "title_fa": "فرم‌های NHS (ثبت GP و کمک‌هزینه درمان)", "title_en": "NHS Forms (GP Registration & Health Costs)", "title_uk": "Форми NHS (Реєстрація у сімейного лікаря та допомога з медичними витратами)", "intro_fa": "این بخش برای راهنمایی در ثبت GP (پزشک عمومی) و فرم‌های HC1/HC2 جهت دریافت کمک‌هزینه هزینه‌های درمان، دارو و دندانپزشکی طراحی شده است.", "intro_en": "This section is designed to help with GP registration and HC1/HC2 forms for help with health, prescription, and dental costs.", "intro_uk": "Цей розділ призначений для допомоги з реєстрацією у сімейного лікаря (GP) та формами HC1/HC2 для отримання допомоги з медичними, рецептурними та стоматологічними витратами.",
    "questions": [
        { "id": "form_type", "type": "single-select", "question_fa": "برای کدام فرم نیاز به راهنمایی دارید؟", "question_en": "Which form do you need help with?", "question_uk": "З якою формою вам потрібна допомога?", "options": [ { "value": "gp", "label_fa": "ثبت GP (پزشک عمومی)", "label_en": "GP Registration", "label_uk": "Реєстрація у сімейного лікаря (GP)" }, { "value": "hc1", "label_fa": "فرم HC1/HC2 (کمک‌هزینه درمان/دارو/دندان)", "label_en": "HC1/HC2 Form (Help with health costs)", "label_uk": "Форма HC1/HC2 (Допомога з медичними витратами)" } ], "allowProof": false },
        { "id": "gp_address", "type": "short-text", "when": { "form_type": "gp" }, "question_fa": "آدرس کامل محل سکونت شما چیست؟", "question_en": "What is your full home address?", "question_uk": "Яка ваша повна домашня адреса?", "placeholder_fa": "مثلاً: 123 King’s Road, Manchester", "placeholder_en": "e.g., 123 King’s Road, Manchester", "placeholder_uk": "напр., 123 King’s Road, Manchester", "allowProof": true, "proof_hint_fa": "مدرک آدرس مثل قبض آب/برق یا قرارداد اجاره را بارگذاری کنید.", "proof_hint_en": "Upload proof of address like a utility bill or rental agreement.", "proof_hint_uk": "Завантажте підтвердження адреси, наприклад, рахунок за комунальні послуги або договір оренди." },
        { "id": "gp_id", "type": "multi-select", "when": { "form_type": "gp" }, "question_fa": "کدام مدارک هویتی دارید؟", "question_en": "Which identity documents do you have?", "question_uk": "Які документи, що посвідчують особу, у вас є?", "options": [ { "value": "passport", "label_fa": "پاسپورت", "label_en": "Passport", "label_uk": "Паспорт" }, { "value": "brp", "label_fa": "کارت اقامت (BRP)", "label_en": "Residence Permit (BRP)", "label_uk": "Дозвіл на проживання (BRP)" }, { "value": "ni", "label_fa": "شماره بیمه ملی (NI)", "label_en": "National Insurance (NI) Number", "label_uk": "Номер національного страхування (NI)" }, { "value": "none", "label_fa": "هیچ‌کدام", "label_en": "None", "label_uk": "Жодних" } ], "allowProof": true, "proof_hint_fa": "عکس پاسپورت یا BRP را بارگذاری کنید.", "proof_hint_en": "Upload a photo of your passport or BRP.", "proof_hint_uk": "Завантажте фото паспорта або BRP." },
        { "id": "gp_medical", "type": "long-text", "when": { "form_type": "gp" }, "question_fa": "آیا بیماری یا داروی خاصی دارید که GP باید بداند؟", "question_en": "Do you have any illnesses or take any medication the GP should know about?", "question_uk": "Чи є у вас якісь захворювання або ви приймаєте ліки, про які повинен знати сімейний лікар?", "placeholder_fa": "مثلاً: فشار خون بالا، دیابت، داروهای روزانه...", "placeholder_en": "e.g., high blood pressure, diabetes, daily medications...", "placeholder_uk": "напр., високий кров'яний тиск, діабет, щоденні ліки...", "allowProof": true, "proof_hint_fa": "نسخه دارو یا نامه پزشک را بارگذاری کنید.", "proof_hint_en": "Upload a prescription or a doctor's letter.", "proof_hint_uk": "Завантажте рецепт або лист від лікаря." },
        { "id": "hc1_status", "type": "single-select", "when": { "form_type": "hc1" }, "question_fa": "وضعیت مالی/شغلی شما چیست؟", "question_en": "What is your financial/work status?", "question_uk": "Який ваш фінансовий/робочий статус?", "options": [ { "value": "benefits", "label_fa": "دریافت‌کننده مزایا (مثل UC/ESA)", "label_en": "Receiving benefits (e.g., UC/ESA)", "label_uk": "Отримувач пільг (напр., UC/ESA)" }, { "value": "low_income", "label_fa": "درآمد پایین", "label_en": "Low income", "label_uk": "Низький дохід" }, { "value": "student", "label_fa": "دانشجو", "label_en": "Student", "label_uk": "Студент" }, { "value": "other", "label_fa": "سایر", "label_en": "Other", "label_uk": "Інше" } ], "allowProof": true, "proof_hint_fa": "نامه مزایا، فیش حقوقی یا کارت دانشجویی را بارگذاری کنید.", "proof_hint_en": "Upload a benefit letter, payslip, or student ID.", "proof_hint_uk": "Завантажте лист про пільги, платіжну відомість або студентський квиток." },
        { "id": "hc1_household", "type": "multi-select", "when": { "form_type": "hc1" }, "question_fa": "چه کسانی در خانه شما زندگی می‌کنند؟", "question_en": "Who lives in your home?", "question_uk": "Хто живе у вашому домі?", "options": [ { "value": "partner", "label_fa": "همسر/پارتنر", "label_en": "Spouse/Partner", "label_uk": "Чоловік/дружина/партнер" }, { "value": "children", "label_fa": "فرزند", "label_en": "Child", "label_uk": "Дитина" }, { "value": "other", "label_fa": "دیگران", "label_en": "Others", "label_uk": "Інші" } ], "allowProof": false },
        { "id": "hc1_income", "type": "currency", "when": { "form_type": "hc1" }, "question_fa": "درآمد خالص ماهیانه خانوار:", "question_en": "Net monthly household income:", "question_uk": "Чистий місячний дохід домогосподарства:", "placeholder_fa": "£", "placeholder_en": "£", "placeholder_uk": "£", "allowProof": true, "proof_hint_fa": "صورت‌حساب بانکی یا فیش حقوقی.", "proof_hint_en": "Bank statement or payslip.", "proof_hint_uk": "Банківська виписка або платіжна відомість." },
        { "id": "hc1_savings", "type": "currency", "when": { "form_type": "hc1" }, "question_fa": "میزان پس‌انداز/سرمایه:", "question_en": "Amount of savings/capital:", "question_uk": "Сума заощаджень/капіталу:", "placeholder_fa": "£", "placeholder_en": "£", "placeholder_uk": "£", "allowProof": true, "proof_hint_fa": "استیتمنت بانکی.", "proof_hint_en": "Bank statement.", "proof_hint_uk": "Банківська виписка." }
    ]
  },
  student_finance: {
    "moduleId": "student_finance", "title_fa": "فرم‌های Student Finance (وام و کمک‌هزینه تحصیل)", "title_en": "Student Finance Forms (Tuition & Maintenance Loans)", "title_uk": "Форми студентського фінансування (Позики на навчання та утримання)", "intro_fa": "این بخش برای ایرانیان مقیم UK طراحی شده تا بتوانند فرم‌های Student Finance (شهریه و کمک‌هزینه زندگی) را به‌راحتی پر کنند. پاسخ‌ها به زبان فارسی ساده راهنمایی خواهند داد.", "intro_en": "This section is designed for Iranians in the UK to easily fill out Student Finance forms (for tuition fees and living costs). The answers will provide guidance in simple Farsi.", "intro_uk": "Цей розділ призначений для українців у Великобританії, щоб легко заповнювати форми студентського фінансування (на оплату навчання та проживання). Відповіді надаватимуть інструкції простою українською мовою.",
    "questions": [
      { "id": "study_level", "type": "single-select", "question_fa": "در چه سطحی تحصیل می‌کنید؟", "question_en": "At what level are you studying?", "question_uk": "На якому рівні ви навчаєтесь?", "options": [ { "value": "undergrad", "label_fa": "کارشناسی (Undergraduate)", "label_en": "Undergraduate", "label_uk": "Бакалаврат (Undergraduate)" }, { "value": "postgrad", "label_fa": "کارشناسی ارشد/دکتری (Postgraduate)", "label_en": "Postgraduate (Master's/PhD)", "label_uk": "Магістратура/Аспірантура (Postgraduate)" }, { "value": "other", "label_fa": "سایر", "label_en": "Other", "label_uk": "Інше" } ], "allowProof": false },
      { "id": "institution", "type": "short-text", "question_fa": "نام دانشگاه/کالج محل تحصیل:", "question_en": "Name of your university/college:", "question_uk": "Назва вашого університету/коледжу:", "placeholder_fa": "مثلاً: University of Manchester", "placeholder_en": "e.g., University of Manchester", "placeholder_uk": "напр., University of Manchester", "allowProof": true, "proof_hint_fa": "نامه پذیرش یا کارت دانشجویی.", "proof_hint_en": "Offer letter or student ID.", "proof_hint_uk": "Лист про зарахування або студентський квиток." },
      { "id": "course_length", "type": "single-select", "question_fa": "طول دوره تحصیلی شما چند سال است؟", "question_en": "How many years is your course?", "question_uk": "Скільки років триває ваш курс?", "options": [ { "value": "1", "label_fa": "یک سال", "label_en": "One year", "label_uk": "Один рік" }, { "value": "2", "label_fa": "دو سال", "label_en": "Two years", "label_uk": "Два роки" }, { "value": "3", "label_fa": "سه سال", "label_en": "Three years", "label_uk": "Три роки" }, { "value": "4plus", "label_fa": "چهار سال یا بیشتر", "label_en": "Four years or more", "label_uk": "Чотири роки або більше" } ], "allowProof": false },
      { "id": "residency_status", "type": "single-select", "question_fa": "وضعیت اقامتی شما چیست؟", "question_en": "What is your residency status?", "question_uk": "Який ваш статус резидента?", "options": [ { "value": "settled", "label_fa": "دارای اقامت دائم (Settled/ILR)", "label_en": "Settled/ILR status", "label_uk": "Статус осілості/ILR" }, { "value": "pre_settled", "label_fa": "Pre-settled", "label_en": "Pre-settled status", "label_uk": "Попередній статус осілості" }, { "value": "refugee", "label_fa": "پناهنده/حمایت انسانی", "label_en": "Refugee/Humanitarian Protection", "label_uk": "Біженець/Гуманітарний захист" }, { "value": "other", "label_fa": "سایر", "label_en": "Other", "label_uk": "Інше" } ], "allowProof": true, "proof_hint_fa": "کارت BRP یا نامه Home Office.", "proof_hint_en": "BRP card or Home Office letter.", "proof_hint_uk": "Картка BRP або лист від Home Office." },
      { "id": "household_income", "type": "currency", "question_fa": "درآمد سالانه خانوار:", "question_en": "Annual household income:", "question_uk": "Річний дохід домогосподарства:", "placeholder_fa": "£", "placeholder_en": "£", "placeholder_uk": "£", "allowProof": true, "proof_hint_fa": "P60، فیش حقوقی یا استیتمنت بانکی والدین/خودتان.", "proof_hint_en": "P60, payslips, or bank statements for your parents/yourself.", "proof_hint_uk": "P60, платіжні відомості або банківські виписки ваших батьків/ваші." },
      { "id": "living_arrangements", "type": "single-select", "question_fa": "محل سکونت شما در طول تحصیل:", "question_en": "Where will you be living during your studies?", "question_uk": "Де ви будете проживати під час навчання?", "options": [ { "value": "with_parents", "label_fa": "زندگی با والدین", "label_en": "Living with parents", "label_uk": "Проживання з батьками" }, { "value": "away_outside_london", "label_fa": "خارج از لندن (خوابگاه/خانه مستقل)", "label_en": "Away from home, outside London", "label_uk": "Поза домом, за межами Лондона" }, { "value": "away_london", "label_fa": "داخل لندن (خوابگاه/خانه مستقل)", "label_en": "Away from home, in London", "label_uk": "Поза домом, у Лондоні" } ], "allowProof": false },
      { "id": "dependents", "type": "single-select", "question_fa": "آیا فرزند یا فرد تحت تکفل دارید؟", "question_en": "Do you have any children or other dependents?", "question_uk": "Чи є у вас діти або інші утриманці?", "options": [ { "value": "yes", "label_fa": "بله", "label_en": "Yes", "label_uk": "Так" }, { "value": "no", "label_fa": "خیر", "label_en": "No", "label_uk": "Ні" } ], "allowProof": true, "proof_hint_fa": "گواهی تولد فرزند یا مدارک وابستگی.", "proof_hint_en": "Child's birth certificate or dependency documents.", "proof_hint_uk": "Свідоцтво про народження дитини або документи про утримання." },
      { "id": "special_support", "type": "single-select", "question_fa": "آیا شرایط خاصی دارید (معلولیت، بیماری، هزینه اضافی تحصیل)؟", "question_en": "Do you have any special circumstances (disability, illness, extra study costs)?", "question_uk": "Чи є у вас особливі обставини (інвалідність, хвороба, додаткові витрати на навчання)?", "options": [ { "value": "yes", "label_fa": "بله", "label_en": "Yes", "label_uk": "Так" }, { "value": "no", "label_fa": "خیر", "label_en": "No", "label_uk": "Ні" } ], "allowProof": true, "proof_hint_fa": "نامه پزشک یا ارزیابی آموزشی.", "proof_hint_en": "Doctor's letter or educational assessment.", "proof_hint_uk": "Лист від лікаря або освітня оцінка." }
    ]
  }
};


// --- UI COMPONENTS ---

const Logo = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" className={className} aria-label="UK PIP Assist Logo">
        <defs>
            <linearGradient id="shieldGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00529F" />
                <stop offset="100%" stopColor="#002D62" />
            </linearGradient>
        </defs>
        <path d="M50 5 C 50 5, 95 15, 95 40 V 85 L 50 95 L 5 85 V 40 C 5 15, 50 5, 50 5 Z" fill="url(#shieldGrad)" stroke="#C41E3A" strokeWidth="3" />
        <path d="M35 25 H 65 V 75 H 35 V 25 Z" fill="#FFFFFF" stroke="#CCCCCC" strokeWidth="2" rx="3" />
        <path d="M40 35 H 60" stroke="#00529F" strokeWidth="3" strokeLinecap="round" />
        <path d="M40 45 H 60" stroke="#00529F" strokeWidth="3" strokeLinecap="round" />
        <path d="M40 55 H 50" stroke="#00529F" strokeWidth="3" strokeLinecap="round" />
        <path d="M45 65 L 50 70 L 60 60" stroke="#007A33" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const CardIcon = ({ path }: { path: string }) => (
  <svg className="w-12 h-12 mb-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={path}></path>
  </svg>
);

const modules = [
  { id: 'pip', name: { fa: 'فرم PIP', en: 'PIP Form', uk: 'Форма PIP' }, iconPath: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
  { id: 'uc', name: { fa: 'Universal Credit', en: 'Universal Credit', uk: 'Універсальний Кредит' }, iconPath: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v.01M12 6v-1h4v1m-7 6v-1h-4v1m11 0v-1h2v1m-4-8V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v1h10z' },
  { id: 'carers_allowance', name: { fa: 'کمک‌هزینه مراقب', en: "Carer's Allowance", uk: 'Допомога по догляду' }, iconPath: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z' },
  { id: 'nhs_forms', name: { fa: 'فرم‌های NHS', en: 'NHS Forms', uk: 'Форми NHS' }, iconPath: 'M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z' },
  { id: 'student_finance', name: { fa: 'وام دانشجویی', en: 'Student Finance', uk: 'Студентське фінансування' }, iconPath: 'M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.258-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0l-3.07-.822A49.98 49.98 0 0112 2.25c2.11 0 4.155.223 6.153.642l-3.07.822m0 0l-3.07-.822A49.98 49.98 0 0112 2.25c2.11 0 4.155.223 6.153.642l-3.07.822' },
  { id: 'immigration', name: { fa: 'امور مهاجرت', en: 'Immigration Affairs', uk: 'Імміграційні справи' }, iconPath: 'M3 12h18M3 12a9 9 0 0118 0M3 12a9 9 0 0018 0M12 3v18' },
  { id: 'council_tax', name: { fa: 'کاهش مالیات شورا', en: 'Council Tax Reduction', uk: 'Знижка на муніципальний податок' }, iconPath: 'M14.121 15.536c-1.171 1.952-3.07 1.952-4.242 0-1.172-1.953-1.172-5.119 0-7.072 1.171-1.952 3.07-1.952 4.242 0 1.172 1.953 1.172 5.119 0 7.072zM12 12a3 3 0 100-6 3 3 0 000 6z' },
  { id: 'blue_badge', name: { fa: 'بلیو بج', en: 'Blue Badge', uk: 'Синій значок' }, iconPath: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
  { id: 'dvla_forms', name: { fa: 'فرم‌های DVLA', en: 'DVLA Forms', uk: 'Форми DVLA' }, iconPath: 'M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002 2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2z' },
  { id: 'hmrc_forms', name: { fa: 'فرم‌های HMRC', en: 'HMRC Forms', uk: 'Форми HMRC' }, iconPath: 'M9 8h6m-5 4h5m2 5H8M5 5h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z' },
  { id: 'form_checker', name: { fa: 'چک‌کردن فرم‌ها', en: 'Form Checker', uk: 'Перевірка форм' }, iconPath: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
];

interface ModuleCardProps {
  name: string;
  iconPath: string;
  onClick: () => void;
  lang: 'fa' | 'en' | 'uk';
}

const ModuleCard: React.FC<ModuleCardProps> = ({ name, iconPath, onClick, lang }) => {
    const labels = {
        fa: 'انتخاب فرم',
        en: 'Select form',
        uk: 'Вибрати форму',
    }
    return (
        <button
            onClick={onClick}
            className="bg-white rounded-xl shadow-lg p-6 flex flex-col items-center justify-center text-center transform hover:-translate-y-1 transition-transform duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
            aria-label={`${labels[lang]} ${name}`}
        >
            <CardIcon path={iconPath} />
            <span className="font-semibold text-slate-700">{name}</span>
        </button>
    );
}

// --- FORM FLOW COMPONENTS ---

const playSound = () => {
  const audio = new Audio("data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA");
  audio.play().catch(e => console.error("Audio playback failed:", e));
};

const StarRating = ({ rating, setRating, disabled, lang }: { rating: number; setRating: (r: number) => void, disabled?: boolean, lang: 'fa' | 'en' | 'uk' }) => {
    const labels = {
        fa: 'قدرت تاثیر (Impact Strength)',
        en: 'Impact Strength',
        uk: 'Сила впливу'
    };
    return (
        <div>
            <h3 className="font-semibold text-slate-700 mb-2">{labels[lang]}</h3>
            <div className="flex items-center space-x-1" dir="ltr">
                {[1, 2, 3, 4, 5, 6].map((star) => (
                    <button key={star} onClick={() => { setRating(star); playSound(); }} disabled={disabled} className="focus:outline-none transform transition-transform duration-150 hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" 
                             className={`w-8 h-8 ${rating >= star ? 'text-yellow-400' : 'text-slate-300'}`}>
                            <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.007z" clipRule="evenodd" />
                        </svg>
                    </button>
                ))}
            </div>
        </div>
    );
}

const BookLengthSelector = ({ length, setLength, disabled, lang }: { length: number; setLength: (l: number) => void, disabled?: boolean, lang: 'fa' | 'en' | 'uk' }) => {
    const labels = {
        fa: 'طول پاسخ (Answer Length)',
        en: 'Answer Length',
        uk: 'Довжина відповіді'
    };
    return (
        <div>
            <h3 className="font-semibold text-slate-700 mb-2">{labels[lang]}</h3>
            <div className="flex items-center space-x-2" dir="ltr">
                {[1, 2, 3, 4].map((book) => (
                    <button key={book} onClick={() => setLength(book)} disabled={disabled} className="focus:outline-none transform transition-transform duration-150 hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" 
                             className={`w-8 h-8 ${length >= book ? 'text-blue-600' : 'text-slate-300'}`}>
                            <path d="M11.25 4.533A9.707 9.707 0 006 3a9.735 9.735 0 00-3.25.555.75.75 0 00-.5.707v14.25a.75.75 0 001 .707A9.735 9.735 0 006 21a9.707 9.707 0 005.25-1.533.75.75 0 000-1.329v-3.881a.75.75 0 00-.596-.748 13.434 13.434 0 01-1.154-.257.75.75 0 01-.596-.748V9.333a.75.75 0 00.596-.748c.39-.085.772-.18 1.154-.257a.75.75 0 01.596-.748V6.333a.75.75 0 000-1.329V4.533z" />
                            <path d="M12.75 4.533A9.707 9.707 0 0118 3a9.735 9.735 0 013.25.555.75.75 0 01.5.707v14.25a.75.75 0 01-1 .707A9.735 9.735 0 0118 21a9.707 9.707 0 01-5.25-1.533.75.75 0 010-1.329v-3.881a.75.75 0 01.596-.748 13.434 13.434 0 001.154-.257.75.75 0 00.596-.748V9.333a.75.75 0 01-.596-.748c-.39-.085-.772-.18-1.154-.257a.75.75 0 00-.596-.748V6.333a.75.75 0 010-1.329V4.533z" />
                        </svg>
                    </button>
                ))}
            </div>
        </div>
    );
};

const ProofUploader = ({ files, setFiles, hint, lang }: { files: File[]; setFiles: (f: File[]) => void; hint?: string; lang: 'fa' | 'en' | 'uk' }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) {
            setFiles(Array.from(event.target.files));
        }
    };
    
    const labels = {
        fa: { title: 'بارگذاری مدرک (Upload Proof)', select: 'انتخاب فایل‌ها', selected: 'فایل انتخاب شد' },
        en: { title: 'Upload Proof', select: 'Select files', selected: 'file(s) selected' },
        uk: { title: 'Завантажити доказ (Upload Proof)', select: 'Вибрати файли', selected: 'файл(ів) вибрано' },
    };
    const t = labels[lang];

    return (
        <div className="mt-4">
            <h3 className="font-semibold text-slate-700 mb-2">{t.title}</h3>
            {hint && <p className="text-sm text-slate-500 mb-2">{hint}</p>}
            <input type="file" multiple ref={fileInputRef} onChange={handleFileChange} className="hidden" />
            <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center justify-center px-4 py-3 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors duration-200 border-2 border-dashed border-slate-300">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-6 h-6 ${lang === 'fa' ? 'ml-2' : 'mr-2'}`}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l-3.75 3.75M12 9.75l3.75 3.75M3 17.25V6.75A2.25 2.25 0 015.25 4.5h13.5A2.25 2.25 0 0121 6.75v10.5A2.25 2.25 0 0118.75 19.5H5.25A2.25 2.25 0 013 17.25z" />
                </svg>
                {files.length > 0
                    ? `${files.length} ${t.selected}`
                    : t.select}
            </button>
        </div>
    );
};

const ProgressBar = ({ current, total }: { current: number, total: number }) => (
    <div className="w-full bg-slate-200 rounded-full h-2.5 mb-4">
        <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-500 ease-out" style={{ width: `${(current / total) * 100}%` }}></div>
    </div>
);

// --- DYNAMIC QUESTION RENDERER ---
const QuestionRenderer = ({ question, answer, setAnswerProperty, lang }: { question: FormQuestion; answer: any; setAnswerProperty: (prop: string, value: any) => void; lang: 'fa' | 'en' | 'uk' }) => {
    
    const handleMultiSelectChange = (optionValue: string) => {
        const currentValue = answer.value || [];
        const newValue = currentValue.includes(optionValue)
            ? currentValue.filter((v: string) => v !== optionValue)
            : [...currentValue, optionValue];
        setAnswerProperty('value', newValue);
    };

    switch (question.type) {
        case 'single-select':
            return (
                <div className="space-y-3">
                    {question.options?.map(option => (
                        <label key={option.value} className="flex items-start p-3 bg-white rounded-lg border border-slate-300 has-[:checked]:bg-blue-50 has-[:checked]:border-blue-500 transition-colors">
                            <input type="radio" name={question.id} value={option.value} checked={answer.value === option.value} onChange={(e) => setAnswerProperty('value', e.target.value)} className="mt-1 form-radio h-5 w-5 text-blue-600 focus:ring-blue-500 border-slate-300" />
                            <div className={lang === 'fa' ? "mr-3" : "ml-3"}>
                                <span className="font-medium text-slate-800">{option[`label_${lang}`]}</span>
                                {option[`tip_${lang}`] && <p className="text-sm text-slate-500">{option[`tip_${lang}`]}</p>}
                            </div>
                        </label>
                    ))}
                </div>
            );
        case 'multi-select':
             return (
                <div className="space-y-3">
                    {question.options?.map(option => (
                        <label key={option.value} className="flex items-start p-3 bg-white rounded-lg border border-slate-300 has-[:checked]:bg-blue-50 has-[:checked]:border-blue-500 transition-colors">
                            <input type="checkbox" name={question.id} value={option.value} checked={(answer.value || []).includes(option.value)} onChange={() => handleMultiSelectChange(option.value)} className="mt-1 form-checkbox h-5 w-5 text-blue-600 focus:ring-blue-500 border-slate-300 rounded" />
                             <div className={lang === 'fa' ? "mr-3" : "ml-3"}>
                                <span className="font-medium text-slate-800">{option[`label_${lang}`]}</span>
                                {option[`tip_${lang}`] && <p className="text-sm text-slate-500">{option[`tip_${lang}`]}</p>}
                            </div>
                        </label>
                    ))}
                </div>
            );
        case 'short-text':
            return <input type="text" value={answer.value || ''} onChange={(e) => setAnswerProperty('value', e.target.value)} placeholder={question[`placeholder_${lang}`]} className="w-full p-2 border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-blue-50" />;
        case 'long-text':
             return <textarea value={answer.value || ''} onChange={(e) => setAnswerProperty('value', e.target.value)} placeholder={question[`placeholder_${lang}`]} rows={5} className="w-full p-2 border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-blue-50" />;
        case 'file':
            const fileTexts = {
                fa: 'آپلود فایل توسط بخش بارگذاری مدرک انجام می‌شود.',
                en: 'File upload functionality will be handled by the proof uploader.',
                uk: 'Завантаження файлів буде оброблятися через завантажувач доказів.'
            };
            return <p className="text-slate-600 text-center py-4">{fileTexts[lang]}</p>;
        case 'group':
            return (
                <div className="space-y-4 p-4 border border-slate-200 rounded-lg bg-slate-50">
                    {question.children?.map(childQuestion => (
                        <div key={childQuestion.id}>
                            <label className="block text-sm font-medium text-slate-700 mb-1">{childQuestion[`question_${lang}`]}</label>
                            <div className="relative">
                                {childQuestion.type === 'currency' && <span className={`absolute ${lang === 'fa' ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-slate-400`}>£</span>}
                                <input
                                    type={childQuestion.type === 'number' ? 'number' : 'text'}
                                    value={(answer.value && answer.value[childQuestion.id]) || ''}
                                    onChange={e => {
                                        const newGroupValue = { ...(answer.value || {}), [childQuestion.id]: e.target.value };
                                        setAnswerProperty('value', newGroupValue);
                                    }}
                                    placeholder={childQuestion[`placeholder_${lang}`]}
                                    className={`w-full p-2 border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-blue-50 ${childQuestion.type === 'currency' ? (lang === 'fa' ? 'pr-7' : 'pl-7') : ''}`}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            );
        case 'currency':
        case 'number':
             return (
                <div className="relative">
                    {question.type === 'currency' && <span className={`absolute ${lang === 'fa' ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-slate-400`}>£</span>}
                    <input
                        type={question.type === 'number' ? 'number' : 'text'}
                        value={answer.value || ''}
                        onChange={(e) => setAnswerProperty('value', e.target.value)}
                        placeholder={question[`placeholder_${lang}`]}
                        className={`w-full p-2 border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-blue-50 ${question.type === 'currency' ? (lang === 'fa' ? 'pr-7' : 'pl-7') : ''}`}
                    />
                </div>
            );
        default:
            return null;
    }
};


// --- GENERALIZED FORM FLOW ENGINE ---
const FormFlow = ({ moduleContent, lang }: { moduleContent: FormModuleContent, lang: 'fa' | 'en' | 'uk' }) => {
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [answers, setAnswers] = useState(() => {
        const createDefaultState = () =>
            moduleContent.questions.map(q => ({
                questionId: q.id,
                rating: q.starEnabled ? 1 : 0,
                length: 1,
                files: [] as File[],
                value: q.type === 'multi-select' ? [] : (q.type === 'group' ? {} : ''),
                aiResponse: null as any,
            }));

        const savedProgress = localStorage.getItem(`form-progress-${moduleContent.moduleId}`);
        if (savedProgress) {
            try {
                const parsedAnswers = JSON.parse(savedProgress);
                const defaultState = createDefaultState();
                return defaultState.map(defaultAnswer => {
                    const savedAnswer = parsedAnswers.find((a: any) => a.questionId === defaultAnswer.questionId);
                    if (savedAnswer) {
                        return {
                            ...defaultAnswer,
                            rating: savedAnswer.rating,
                            length: savedAnswer.length,
                            value: savedAnswer.value,
                        };
                    }
                    return defaultAnswer;
                });
            } catch (e) {
                console.error("Failed to parse saved form progress:", e);
                return createDefaultState();
            }
        }
        return createDefaultState();
    });
    const [isLoading, setIsLoading] = useState(false);
    const [isExplanationVisible, setIsExplanationVisible] = useState(false);

    useEffect(() => {
        const serializableAnswers = answers.map(({ questionId, rating, length, value }) => ({
            questionId,
            rating,
            length,
            value,
        }));
        try {
            localStorage.setItem(`form-progress-${moduleContent.moduleId}`, JSON.stringify(serializableAnswers));
        } catch (e) {
            console.error("Failed to save form progress to localStorage:", e);
        }
    }, [answers, moduleContent.moduleId]);

    const visibleQuestions = useMemo(() => {
        return moduleContent.questions.filter(q => {
            if (!q.when) return true;
            const [conditionKey, conditionValue] = Object.entries(q.when)[0];
            const conditionAnswer = answers.find(a => a.questionId === conditionKey);
            return conditionAnswer?.value === conditionValue;
        });
    }, [answers, moduleContent.questions]);

    const currentQuestion = visibleQuestions[currentQuestionIndex];
    // Find the original index to access the correct answer state
    const originalIndex = moduleContent.questions.findIndex(q => q.id === currentQuestion.id);
    const currentAnswer = answers[originalIndex];

    const setAnswerProperty = (prop: string, value: any) => {
        setAnswers(prevAnswers => {
            const newAnswers = [...prevAnswers];
            newAnswers[originalIndex] = { ...newAnswers[originalIndex], [prop]: value };
            return newAnswers;
        });
    };

    const generateAIPrompt = (module: FormModuleContent, question: FormQuestion, answer: any, allAnswers: any[]): string => {
        const impactMap: { [key: number]: string } = { 1: 'very low impact', 2: 'low impact', 3: 'neutral impact', 4: 'somewhat impactful', 5: 'high impact', 6: 'maximum impact' };
        const lengthMap: { [key: number]: string } = { 1: 'a very short answer (1-2 sentences)', 2: 'a medium-short answer (3-4 sentences)', 3: 'a semi-detailed answer (a short paragraph)', 4: 'a full, detailed answer (a long paragraph)' };

        const langDetails = {
            fa: { name: 'Farsi (RTL)', people: 'Iranians' },
            en: { name: 'English', people: 'users' },
            uk: { name: 'Ukrainian', people: 'Ukrainians' }
        };
        const currentLang = langDetails[lang];

        const baseJsonInstruction = `You are an expert assistant for completing UK government forms. Your goal is to help ${currentLang.people} in the UK.
            You MUST return a single, valid JSON object and nothing else. The JSON object must have two keys: "answer_${lang}" and "explanation_${lang}".
            - "answer_${lang}" (string): The response in clear, professional ${currentLang.name}.
            - "explanation_${lang}" (string): Briefly explain *why* you generated that specific answer, referencing the user's input.`;
        
        const multiPartInstruction = `You are an expert assistant for completing UK government forms. Your goal is to help ${currentLang.people} in the UK.
            You MUST return a single, valid JSON object and nothing else. The JSON object must have four keys: "answer_${lang}", "evidence_checklist_${lang}", "next_steps_${lang}", and "explanation_${lang}".
            - "answer_${lang}" (string): Provide tailored guidance in polite, professional ${currentLang.name}.
            - "evidence_checklist_${lang}" (string): Provide a bulleted list (using '-') of documents the user should prepare.
            - "next_steps_${lang}" (string): Provide a bulleted list (using '-') of the next actions the user should take.
            - "explanation_${lang}" (string): Briefly explain the reasoning for the guidance you provided, referencing the user's input.`;
            
        const allAnswersContext = JSON.stringify(allAnswers.map(a => ({q: a.questionId, v: a.value})));

        if (module.moduleId === 'blue_badge') {
            return `${baseJsonInstruction}
            You are generating ${currentLang.name} answers for a UK Blue Badge application.
            - Impact level (stars): ${answer.rating}/6 (${impactMap[answer.rating]}) must control assertiveness and emphasis on mobility limitations.
            - Length level (books): ${answer.length}/4 (${lengthMap[answer.length]}) must control answer depth and detail.
            Current Question: "${question[`question_${lang}`]}"
            User's input: ${JSON.stringify(answer.value)}
            Based on these requirements, generate a suitable response. Reflect real functional difficulties: distance limits, pain, fatigue, safety risks, non-visible conditions.`;
        }
        
        if (module.moduleId === 'council_tax') {
            return `${baseJsonInstruction}
            You are generating ${currentLang.name} answers for a UK Council Tax Reduction application. The tone should be formal and clear.
            Current Question: "${question[`question_${lang}`]}"
            User's input: ${JSON.stringify(answer.value)}
            Based on the user's input, generate a simple, direct, and professional answer.`;
        }

        if (module.moduleId === 'dvla_forms') {
            return `${multiPartInstruction}
            Current Question: "${question[`question_${lang}`]}"
            User's input: ${JSON.stringify(answer.value)}
            Based on the user's input, provide specific advice in ${currentLang.name}:
            - If their foreign license is from a non-exchangeable country, explain that they need to apply for a Provisional Licence and take UK tests.
            - If they report a medical condition, advise them they must declare it and may need to fill out specific medical forms (e.g., MED1).
            - If they failed a vision test, advise them to see an optician before proceeding.`;
        }

        if (module.moduleId === 'hmrc_forms') {
             const flow = allAnswers.find(a => a.questionId === 'hmrc_flow')?.value;
             if (flow === 'self_assessment') {
                 return `${multiPartInstruction}
                 You generate clear ${currentLang.name} guidance for HMRC Self Assessment.
                 Current Question: "${question[`question_${lang}`]}"
                 User's input for this question: ${JSON.stringify(answer.value)}
                 Full form context: ${allAnswersContext}
                 Return tailored answers, an exact evidence checklist, and concise next steps to file online.`;
             }
             if (flow === 'child_tax_credit') {
                 return `${multiPartInstruction}
                 You generate clear ${currentLang.name} guidance for Child Tax Credit.
                 Current Question: "${question[`question_${lang}`]}"
                 User's input for this question: ${JSON.stringify(answer.value)}
                 Full form context: ${allAnswersContext}
                 Return tailored answers, an evidence checklist, and next steps on how to apply/update details.`;
             }
             return `${baseJsonInstruction} Please select a form type to get started.`;
        }
        
        if (module.moduleId === 'carers_allowance') {
            return `${multiPartInstruction}
            You generate clear ${currentLang.name} guidance for a UK Carer’s Allowance claim.
            Current Question: "${question[`question_${lang}`]}"
            User's input for this question: ${JSON.stringify(answer.value)}
            Full form context: ${allAnswersContext}
            Return tailored answers, an exact evidence checklist, and next steps on how to submit online.
            Provide warnings if user seems ineligible (e.g., <35 hours, high earnings, full-time student).`;
        }

        if (module.moduleId === 'nhs_forms') {
             const flow = allAnswers.find(a => a.questionId === 'form_type')?.value;
             if (flow === 'gp') {
                 return `${multiPartInstruction}
                 You generate clear ${currentLang.name} guidance for NHS GP Registration.
                 Current Question: "${question[`question_${lang}`]}"
                 User's input for this question: ${JSON.stringify(answer.value)}
                 Explain how to register with a GP using ID, proof of address, and medical history. Return tailored answers, a checklist, and next steps.`;
             }
             if (flow === 'hc1') {
                 return `${multiPartInstruction}
                 You generate clear ${currentLang.name} guidance for NHS HC1/HC2 forms (Low Income Scheme).
                 Current Question: "${question[`question_${lang}`]}"
                 User's input for this question: ${JSON.stringify(answer.value)}
                 Explain eligibility based on benefits, income, savings, and household. Return tailored answers, a checklist, and next steps.`;
             }
             return `${baseJsonInstruction} Please select a form type to get started.`;
        }

        if (module.moduleId === 'student_finance') {
            return `${multiPartInstruction}
            You generate clear ${currentLang.name} guidance for Student Finance applications (UK).
            Current Question: "${question[`question_${lang}`]}"
            User's input for this question: ${JSON.stringify(answer.value)}
            Full form context: ${allAnswersContext}
            Use inputs: study level, institution, course length, residency status, household income, living arrangements, dependents, and special support needs.
            Return tailored answers, an evidence checklist (documents: admission letter, BRP, income proofs, child dependents, disability assessments), and next steps (how to apply online, deadlines, processing times).`;
        }
        
        if (module.moduleId === 'uc') {
            return `${multiPartInstruction}
            You are generating clear ${currentLang.name} guidance for a UK Universal Credit application.
            Current Question: "${question[`question_${lang}`]}"
            User's input for this question: ${JSON.stringify(answer.value)}
            Full form context: ${allAnswersContext}
            Based on all user inputs (household, children, housing costs, savings, employment, health), provide tailored advice. 
            For the 'evidence_checklist_${lang}', list specific documents like tenancy agreements, payslips, bank statements, or Fit Notes based on their answers.
            For 'next_steps_${lang}', explain how to complete the online application on GOV.UK, report changes, and manage their journal.`;
        }

        if (module.moduleId === 'immigration') {
            return `${multiPartInstruction}
            You are generating clear ${currentLang.name} guidance for a UK Immigration application.
            Current Question: "${question[`question_${lang}`]}"
            User's input for this question: ${JSON.stringify(answer.value)}
            Full form context: ${allAnswersContext}
            Tailor the guidance based on the application type (visa extension, settlement, citizenship). 
            For 'evidence_checklist_${lang}', be specific. For Settlement, mention BRP, Life in the UK certificate, English test, and proof of residence. For visa extensions, mention financial documents and proof of ties.
            For 'next_steps_${lang}', explain the online application process, booking biometrics, and typical waiting times. If they mention absences for ILR, explain the rules clearly.`;
        }

        // Default to PIP prompt logic
        return `${baseJsonInstruction}
        You are generating a ${currentLang.name} response for a UK PIP (Personal Independence Payment) application.
        Current Question: "${question[`question_${lang}`]}"
        Description: "${question[`description_${lang}`]}"
        User's requirement for the answer:
        - Impact Strength: ${answer.rating}/6 (${impactMap[answer.rating]})
        - Answer Length: ${answer.length}/4 (${lengthMap[answer.length]})
        Based on these requirements, generate a suitable response. The tone should be supportive but professional.`;
    };

    useEffect(() => {
        setIsExplanationVisible(false);
    }, [currentQuestionIndex]);

    useEffect(() => {
        if (!currentAnswer) return;

        const generateAnswer = async () => {
             const isValueEmpty = !currentAnswer.value || (Array.isArray(currentAnswer.value) && currentAnswer.value.length === 0) || (typeof currentAnswer.value === 'object' && Object.keys(currentAnswer.value).length === 0);
             const shouldSkip = (currentQuestion.starEnabled && currentAnswer.rating === 0) || (!currentQuestion.starEnabled && isValueEmpty);

             if (shouldSkip) {
                setAnswerProperty('aiResponse', null);
                return;
            }

            setIsLoading(true);
            setAnswerProperty('aiResponse', null);

            try {
                const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
                const prompt = generateAIPrompt(moduleContent, currentQuestion, currentAnswer, answers);

                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: prompt,
                });

                try {
                    const cleanedText = response.text.replace(/```json|```/g, '').trim();
                    const jsonResponse = JSON.parse(cleanedText);
                    setAnswerProperty('aiResponse', jsonResponse);
                } catch (e) {
                    console.error("Failed to parse AI JSON response:", e, "Raw text:", response.text);
                    const errorMessages = {
                        fa: "پاسخ دریافت شده معتبر نیست.",
                        en: "The received response is not valid.",
                        uk: "Отримана відповідь недійсна."
                    };
                    const fallbackMessages = {
                        fa: "پاسخ خالی دریافت شد.",
                        en: "Received an empty response.",
                        uk: "Отримано порожню відповідь."
                    }
                    setAnswerProperty('aiResponse', { 
                        error: errorMessages[lang],
                        [`answer_${lang}`]: response.text || fallbackMessages[lang]
                    });
                }

            } catch (error) {
                const errorMessages = {
                    fa: "متاسفانه در تولید پاسخ خطایی رخ داد. لطفا دوباره تلاش کنید.",
                    en: "An error occurred while generating the response. Please try again.",
                    uk: "Під час генерації відповіді сталася помилка. Будь ласка, спробуйте ще раз."
                };
                console.error("AI generation failed:", error);
                const errorMessage = { error: errorMessages[lang] };
                setAnswerProperty('aiResponse', errorMessage);
            } finally {
                setIsLoading(false);
            }
        };

        const handler = setTimeout(() => {
            generateAnswer();
        }, 1000);

        return () => clearTimeout(handler);

    }, [currentAnswer?.rating, currentAnswer?.length, currentAnswer?.value, currentQuestionIndex, lang]);

    const goToNext = () => setCurrentQuestionIndex(i => Math.min(i + 1, visibleQuestions.length - 1));
    const goToPrev = () => setCurrentQuestionIndex(i => Math.max(i - 1, 0));
    
    if (!currentQuestion || !currentAnswer) {
        return <div>Loading form...</div>; // Or some other placeholder
    }

    const isControlsEnabled = currentQuestion.starEnabled || currentQuestion.bookEnabled;

    const renderAIResponse = () => {
        const labels = {
            fa: { generating: 'در حال تولید پاسخ...', selectStrength: 'برای تولید پاسخ، قدرت تاثیر و طول پاسخ را انتخاب کنید', selectOption: 'برای مشاهده راهنمایی، گزینه‌ها را انتخاب کنید', why: 'چرا این پاسخ؟', hide: 'پنهان کردن توضیح', explanation: 'توضیح AI:', guidance: 'راهنمایی:', checklist: 'چک‌لیست مدارک:', nextSteps: 'مراحل بعدی:' },
            en: { generating: 'Generating response...', selectStrength: 'Select impact strength and answer length to generate a response', selectOption: 'Select an option to see guidance', why: 'Why this answer?', hide: 'Hide explanation', explanation: 'AI Explanation:', guidance: 'Guidance:', checklist: 'Evidence Checklist:', nextSteps: 'Next Steps:' },
            uk: { generating: 'Генерація відповіді...', selectStrength: 'Виберіть силу впливу та довжину відповіді, щоб згенерувати відповідь', selectOption: 'Виберіть опцію, щоб побачити підказку', why: 'Чому така відповідь?', hide: 'Сховати пояснення', explanation: 'Пояснення від ШІ:', guidance: 'Рекомендація:', checklist: 'Перелік доказів:', nextSteps: 'Наступні кроки:' },
        };
        const t = labels[lang];

        if (isLoading) {
            return (
                <div className="flex items-center justify-center h-full text-slate-500">
                   <svg className="animate-spin h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                   <span className={lang === 'fa' ? 'mr-2' : 'ml-2'}>{t.generating}</span>
                </div>
            );
        }

        if (!currentAnswer.aiResponse) {
             const placeholderText = isControlsEnabled ? t.selectStrength : t.selectOption;
             return <p className="italic text-slate-500 text-center pt-8">{placeholderText}</p>;
        }

        if (currentAnswer.aiResponse.error && !currentAnswer.aiResponse[`answer_${lang}`]) {
            return <p className="text-red-600 text-center pt-8">{currentAnswer.aiResponse.error}</p>;
        }
        
        const responseData = currentAnswer.aiResponse;
        const answerText = responseData[`answer_${lang}`];
        const explanationText = responseData[`explanation_${lang}`];
        const checklistText = responseData[`evidence_checklist_${lang}`];
        const nextStepsText = responseData[`next_steps_${lang}`];
        const isMultiPartStyle = checklistText || nextStepsText;

        const explanationComponent = explanationText ? (
            <div className="mt-3 pt-3 border-t border-blue-200">
                <button 
                    onClick={() => setIsExplanationVisible(prev => !prev)} 
                    className="text-xs text-blue-600 hover:underline font-semibold flex items-center gap-1"
                    aria-expanded={isExplanationVisible}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    {isExplanationVisible ? t.hide : t.why}
                </button>
                {isExplanationVisible && (
                    <div className="mt-2 p-3 bg-slate-100 border border-slate-200 text-slate-700 rounded-md text-sm animate-fade-in">
                        <p className="font-semibold">{t.explanation}</p>
                        <p className="whitespace-pre-wrap">{explanationText}</p>
                    </div>
                )}
            </div>
        ) : null;

        if (isMultiPartStyle) {
            return (
                <>
                    <p className="whitespace-pre-wrap font-semibold">{t.guidance}</p>
                    <p className="whitespace-pre-wrap mb-4">{answerText}</p>
                    
                    {checklistText && (
                        <>
                            <p className="whitespace-pre-wrap font-semibold mt-4 pt-2 border-t border-blue-200">{t.checklist}</p>
                            <p className="whitespace-pre-wrap">{checklistText}</p>
                        </>
                    )}
                     {nextStepsText && (
                        <>
                            <p className="whitespace-pre-wrap font-semibold mt-4 pt-2 border-t border-blue-200">{t.nextSteps}</p>
                            <p className="whitespace-pre-wrap">{nextStepsText}</p>
                        </>
                    )}
                    {explanationComponent}
                </>
            );
        }

        return (
            <>
                <p className="whitespace-pre-wrap">{answerText}</p>
                {responseData.error && <p className="text-red-500 text-xs mt-2">{responseData.error}</p>}
                {explanationComponent}
            </>
        );
    };

    const navLabels = {
        fa: { prev: 'قبلی', next: 'بعدی', question: 'سوال', of: 'از' },
        en: { prev: 'Previous', next: 'Next', question: 'Question', of: 'of' },
        uk: { prev: 'Назад', next: 'Далі', question: 'Питання', of: 'з' },
    };
    const navT = navLabels[lang];

    return (
        <div className="space-y-6">
            <ProgressBar current={currentQuestionIndex + 1} total={visibleQuestions.length} />

            <div>
                <p className="text-sm font-semibold text-blue-600">
                    {navT.question} {currentQuestionIndex + 1} {navT.of} {visibleQuestions.length}
                </p>
                <h2 className="text-2xl font-bold text-slate-800">{currentQuestion[`question_${lang}`]}</h2>
                {currentQuestion[`description_${lang}`] && <p className="mt-2 text-slate-600">{currentQuestion[`description_${lang}`]}</p>}
            </div>

            <QuestionRenderer question={currentQuestion} answer={currentAnswer} setAnswerProperty={setAnswerProperty} lang={lang} />

            <div className={`bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-4 ${!isControlsEnabled && 'hidden'}`}>
                <div className="flex flex-col sm:flex-row justify-between gap-4">
                    <StarRating rating={currentAnswer.rating} setRating={(r) => setAnswerProperty('rating', r)} disabled={!currentQuestion.starEnabled} lang={lang} />
                    <BookLengthSelector length={currentAnswer.length} setLength={(l) => setAnswerProperty('length', l)} disabled={!currentQuestion.bookEnabled} lang={lang}/>
                </div>
            </div>
            
            {currentQuestion.allowProof && (
                <ProofUploader files={currentAnswer.files} setFiles={(f) => setAnswerProperty('files', f)} hint={currentQuestion[`proof_hint_${lang}`]} lang={lang}/>
            )}

            <div className={`bg-blue-50 p-4 rounded-lg border border-blue-200`}>
                <h3 className="font-semibold text-blue-800 mb-2">{lang === 'fa' ? 'راهنمای هوشمند (AI Guidance)' : (lang === 'en' ? 'AI Guidance' : 'Підказки від ШІ')}</h3>
                <div className="text-sm text-blue-700/80 p-3 bg-white rounded-md min-h-[120px]">
                     {renderAIResponse()}
                </div>
            </div>

            <div className="flex justify-between items-center pt-4">
                <button onClick={goToPrev} disabled={currentQuestionIndex === 0} className="bg-slate-300 hover:bg-slate-400 text-slate-800 font-bold py-2 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">{navT.prev}</button>
                <button onClick={goToNext} disabled={currentQuestionIndex === visibleQuestions.length - 1} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">{navT.next}</button>
            </div>
        </div>
    );
};


// --- FORM CHECKER VIEW ---

const FormCheckerStarRating = ({ score }: { score: number }) => (
  <div className="flex items-center justify-center">
    <span className="text-xl font-bold text-yellow-400 mr-2">{score}/6</span>
    <div className="flex">
      {[...Array(6)].map((_, i) => (
        <svg
          key={i}
          className={`w-6 h-6 ${i < score ? 'text-yellow-400' : 'text-gray-300'}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.96a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.368 2.448a1 1 0 00-.364 1.118l1.287 3.96c.3.921-.755 1.688-1.54 1.118l-3.368-2.448a1 1 0 00-1.175 0l-3.368 2.448c-.784.57-1.838-.197-1.54-1.118l1.287-3.96a1 1 0 00-.364-1.118L2.07 9.387c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.96z" />
        </svg>
      ))}
    </div>
  </div>
);

const FormCheckerView = ({ onBack, lang, isUnlocked }: { onBack: () => void, lang: 'fa' | 'en' | 'uk', isUnlocked: boolean }) => {
  const [formType, setFormType] = useState<FormCheckerFormType>('pip');
  const [mainFile, setMainFile] = useState<File | null>(null);
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [apiResponse, setApiResponse] = useState<FormCheckerResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const translations = {
    fa: { title: 'چک‌کردن فرم‌های پُر‌شده', formType: 'نوع فرم', uploadForm: 'آپلود فرم تکمیل‌شده', uploadEvidence: 'مدارک (اختیاری)', analyze: 'تحلیل و امتیازدهی', paywall: 'برای استفاده از این ویژگی، لطفاً ابتدا هزینه دسترسی را پرداخت کنید.', overallScore: 'امتیاز کلی', subScores: 'امتیازهای جزئی', pipScores: 'امتیازات بر اساس توصیف‌گر', summary: 'ترجمه و خلاصه', keyFindings: 'یافته‌های کلیدی', recommendedEvidence: 'مدارک پیشنهادی', improvements: 'پیشنهادات بهبود', before: 'قبل', after: 'بعد', rationale: 'دلیل', download: 'دانلود اصلاحات (فایل متنی)', uploading: 'در حال آپلود و تحلیل...', back: 'بازگشت' },
    en: { title: 'Filled Form Checker', formType: 'Form Type', uploadForm: 'Upload completed form', uploadEvidence: 'Evidence (optional)', analyze: 'Analyze & Score', paywall: 'To use this feature, please complete the payment first.', overallScore: 'Overall Score', subScores: 'Sub-scores', pipScores: 'Per-Descriptor Scores', summary: 'Translation & Summary', keyFindings: 'Key Findings', recommendedEvidence: 'Recommended Evidence', improvements: 'Improvement Suggestions', before: 'Before', after: 'After', rationale: 'Rationale', download: 'Download improvements (TXT)', uploading: 'Uploading & Analyzing...', back: 'Back' },
    uk: { title: 'Перевірка заповнених форм', formType: 'Тип форми', uploadForm: 'Завантажити заповнену форму', uploadEvidence: 'Докази (необов\'язково)', analyze: 'Аналізувати та оцінити', paywall: 'Щоб використовувати цю функцію, будь ласка, спочатку здійсніть оплату.', overallScore: 'Загальна оцінка', subScores: 'Проміжні оцінки', pipScores: 'Оцінки за дескрипторами', summary: 'Переклад та резюме', keyFindings: 'Ключові висновки', recommendedEvidence: 'Рекомендовані докази', improvements: 'Пропозиції щодо покращення', before: 'До', after: 'Після', rationale: 'Обґрунтування', download: 'Завантажити покращення (TXT)', uploading: 'Завантаження та аналіз...', back: 'Назад' },
  };
  const t = translations[lang];
  
  const formTypes: { key: FormCheckerFormType; fa: string; en: string; uk: string; }[] = [
      { key: 'pip', fa: 'فرم PIP', en: 'PIP Form', uk: 'Форма PIP' },
      { key: 'uc', fa: 'Universal Credit', en: 'Universal Credit', uk: 'Універсальний Кредит' },
      { key: 'carers_allowance', fa: 'کمک‌هزینه مراقب', en: "Carer's Allowance", uk: 'Допомога по догляду' },
      { key: 'nhs_forms', fa: 'فرم‌های NHS', en: 'NHS Forms', uk: 'Форми NHS' },
      { key: 'student_finance', fa: 'وام دانشجویی', en: 'Student Finance', uk: 'Студентське фінансування' },
      { key: 'immigration', fa: 'امور مهاجرت', en: 'Immigration Affairs', uk: 'Імміграційні справи' },
      { key: 'council_tax', fa: 'کاهش مالیات شورا', en: 'Council Tax Reduction', uk: 'Знижка на муніципальний податок' },
      { key: 'blue_badge', fa: 'بلیو بج', en: 'Blue Badge', uk: 'Синій значок' },
      { key: 'dvla_forms', fa: 'فرم‌های DVLA', en: 'DVLA Forms', uk: 'Форми DVLA' },
      { key: 'hmrc_forms', fa: 'فرم‌های HMRC', en: 'HMRC Forms', uk: 'Форми HMRC' },
  ];

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>, fileType: 'main' | 'evidence') => {
    if (!e.target.files) return;
    if (fileType === 'main') {
      setMainFile(e.target.files[0]);
    } else {
      setEvidenceFiles(Array.from(e.target.files));
    }
  };
  
  const handleAnalyze = async () => {
    if (!mainFile) return;
    setIsLoading(true);
    setError(null);
    setApiResponse(null);
    
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

        const toBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve((reader.result as string).split(',')[1]);
            reader.onerror = error => reject(error);
        });

        const fileToPart = async (file: File) => ({
            inlineData: {
                mimeType: file.type,
                data: await toBase64(file),
            },
        });
        
        const mainFilePart = await fileToPart(mainFile);
        const evidenceFileParts = await Promise.all(evidenceFiles.map(fileToPart));

        const prompt = `You are an expert AI assistant for reviewing UK benefit application forms.
        Analyze the provided form ("${mainFile.name}") and any supporting evidence documents.
        The user's primary language is "${lang}", but you must provide all text outputs in English (en), Farsi (fa), and Ukrainian (uk).
        The form type is "${formType}".

        Your task is to return a single, valid JSON object and nothing else. The JSON object must match this structure:
        {
          "language": "${lang}",
          "form_type": "${formType}",
          "overall_stars": "integer (1-6)",
          "scores": { "completeness": "int(1-6)", "consistency": "int(1-6)", "evidence_linkage": "int(1-6)", "relevance": "int(1-6)", "tone_clarity": "int(1-6)", "risk_flags": "int(1-6)" },
          "translation_summary": "string in ${lang}",
          "key_findings": ["array of strings in ${lang}"],
          "missing_evidence": ["array of strings in ${lang}"],
          "improvements": [{ "section_id": "string", "before_fa": "string", "after_fa": "string", "rationale_fa": "string", "before_en": "string", "after_en": "string", "rationale_en": "string", "before_uk": "string", "after_uk": "string", "rationale_uk": "string" }],
          "per_question_scores": { "Question Name from form": "int(1-6)" },
          "next_steps_fa": ["array of strings"],
          "next_steps_en": ["array of strings"],
          "next_steps_uk": ["array of strings"],
          "disclaimer_fa": "این یک تحلیل خودکار است و جایگزین مشاوره حرفه‌ای نمی‌شود.",
          "disclaimer_en": "This is an automated analysis and does not replace professional advice.",
          "disclaimer_uk": "Це автоматизований аналіз, який не замінює професійної консультації."
        }
        Critically evaluate the documents and provide accurate scores and concrete, actionable feedback in the JSON format. Ensure all text fields are correctly translated as requested.`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    { text: prompt },
                    mainFilePart,
                    ...evidenceFileParts
                ]
            },
            config: {
                responseMimeType: "application/json",
            }
        });

        const cleanedText = response.text.replace(/```json|```/g, '').trim();
        const jsonResponse = JSON.parse(cleanedText);
        setApiResponse(jsonResponse);

    } catch (e) {
        console.error("Analysis failed:", e);
        const errorMessages = {
            fa: 'تحلیل انجام نشد. ممکن است فایل پشتیبانی نشده باشد یا خطایی در ارتباط با سرور رخ داده باشد. لطفا دوباره تلاش کنید.',
            en: 'Analysis failed. The file may be unsupported or there was a server error. Please try again.',
            uk: 'Аналіз не вдався. Можливо, файл не підтримується або сталася помилка сервера. Будь ласка, спробуйте ще раз.'
        };
        setError(errorMessages[lang]);
    } finally {
        setIsLoading(false);
    }
  };
  
  const handleDownloadImprovements = () => {
    if (!apiResponse) return;
    const content = apiResponse.improvements
        .map(imp => {
            const before = imp[`before_${lang}`];
            const after = imp[`after_${lang}`];
            const rationale = imp[`rationale_${lang}`];
            return `Section: ${imp.section_id}\nBefore: ${before}\nAfter: ${after}\nRationale: ${rationale}`;
        })
        .join('\n\n---\n\n');
    
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `form-improvements-${lang}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  return (
    <div className="bg-white/95 rounded-xl shadow-2xl p-6 sm:p-8 text-slate-800 animate-fade-in w-full">
        <header className="flex items-center justify-between mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-blue-900">{t.title}</h2>
            <button onClick={onBack} className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-2 px-4 rounded-lg transition-colors duration-300" aria-label={t.back}>
                {t.back} &rarr;
            </button>
        </header>

        {!isUnlocked && (
            <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-6 rounded-md" role="alert">
                <p className="font-bold">{t.paywall}</p>
            </div>
        )}

        <div className="bg-white p-6 rounded-lg shadow-inner border border-slate-200 mb-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label htmlFor="form-type-select" className="block text-sm font-medium text-slate-700 mb-1">{t.formType}</label>
                  <select id="form-type-select" value={formType} onChange={(e) => setFormType(e.target.value as FormCheckerFormType)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-slate-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md">
                    {formTypes.map(ft => <option key={ft.key} value={ft.key}>{ft[lang]}</option>)}
                  </select>
                </div>
            </div>
          
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                    <label className="block text-sm font-medium text-slate-700">{t.uploadForm} <span className="text-red-500">*</span></label>
                    <input type="file" onChange={(e) => handleFileChange(e, 'main')} accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" className="mt-1 block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"/>
                </div>
                 <div>
                    <label className="block text-sm font-medium text-slate-700">{t.uploadEvidence}</label>
                    <input type="file" multiple onChange={(e) => handleFileChange(e, 'evidence')} accept=".pdf,.jpg,.jpeg,.png" className="mt-1 block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"/>
                </div>
            </div>

            <div className="text-center">
                 <button onClick={handleAnalyze} disabled={!mainFile || isLoading || !isUnlocked} className="w-full md:w-auto inline-flex justify-center items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-slate-400 disabled:cursor-not-allowed">
                    {isLoading ? t.uploading : t.analyze}
                 </button>
            </div>
        </div>

        {error && (
            <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded-md" role="alert">
                <p>{error}</p>
            </div>
        )}
        
        {apiResponse && (
           <div className="bg-white p-6 rounded-lg shadow-inner border border-slate-200 animate-fade-in">
              <div className="text-center border-b pb-4 mb-4">
                <h2 className="text-lg font-semibold text-slate-600 mb-2">{t.overallScore}</h2>
                <FormCheckerStarRating score={apiResponse.overall_stars} />
              </div>

              <div className="mb-6">
                  <h3 className="text-md font-semibold text-slate-800 mb-3">{t.subScores}</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-center">
                    {Object.entries(apiResponse.scores).map(([key, value]) => (
                      <div key={key} className="bg-slate-100 p-3 rounded-md">
                        <div className="text-sm font-medium text-slate-600 capitalize">{key.replace('_', ' ')}</div>
                        <div className="text-lg font-bold text-blue-600">{value}/6</div>
                      </div>
                    ))}
                  </div>
              </div>

              {apiResponse.form_type === 'pip' && apiResponse.per_question_scores && (
                <div className="mb-6">
                  <h3 className="text-md font-semibold text-slate-800 mb-3">{t.pipScores}</h3>
                  <ul className="space-y-2">
                    {Object.entries(apiResponse.per_question_scores).map(([desc, score]) => (
                      <li key={desc} className="flex justify-between items-center bg-slate-50 p-2 rounded">
                        <span className="text-sm text-slate-700">{desc}</span>
                        <span className="font-bold text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded-full">{score}/6</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              <div className="space-y-6">
                <div><h3 className="text-md font-semibold text-slate-800 mb-2">{t.summary}</h3><p className="text-slate-600 text-sm leading-relaxed bg-slate-50 p-3 rounded-md">{apiResponse.translation_summary}</p></div>
                <div><h3 className="text-md font-semibold text-slate-800 mb-2">{t.keyFindings}</h3><ul className="list-disc list-inside space-y-1 text-sm text-slate-600 marker:text-blue-500 bg-slate-50 p-3 rounded-md">{apiResponse.key_findings.map((item, i) => <li key={i}>{item}</li>)}</ul></div>
                <div><h3 className="text-md font-semibold text-slate-800 mb-2">{t.recommendedEvidence}</h3><ul className="list-disc list-inside space-y-1 text-sm text-slate-600 marker:text-blue-500 bg-slate-50 p-3 rounded-md">{apiResponse.missing_evidence.map((item, i) => <li key={i}>{item}</li>)}</ul></div>

                <div>
                    <h3 className="text-md font-semibold text-slate-800 mb-3">{t.improvements}</h3>
                    <div className="space-y-4">
                        {apiResponse.improvements.map((imp) => (
                          <div key={imp.section_id} className="border border-slate-200 rounded-lg overflow-hidden">
                              <div className="p-4 bg-white">
                                <p className="text-xs text-slate-500 mb-2">Section: {imp.section_id}</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                    <h4 className="font-semibold text-sm text-red-600 mb-1">{t.before}</h4>
                                    <p className="text-sm bg-red-50 p-2 rounded-md font-mono text-slate-700">{imp[`before_${lang}`]}</p>
                                  </div>
                                  <div>
                                    <h4 className="font-semibold text-sm text-green-600 mb-1">{t.after}</h4>
                                    <p className="text-sm bg-green-50 p-2 rounded-md font-mono text-slate-800">{imp[`after_${lang}`]}</p>
                                  </div>
                                </div>
                                <div className="mt-3">
                                  <h4 className="font-semibold text-sm text-blue-600 mb-1">{t.rationale}</h4>
                                  <p className="text-sm text-slate-600">{imp[`rationale_${lang}`]}</p>
                                </div>
                              </div>
                          </div>
                        ))}
                    </div>
                </div>
              </div>

              <div className="text-center mt-8 border-t pt-6">
                <button onClick={handleDownloadImprovements} className="px-5 py-2.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 focus:ring-4 focus:outline-none focus:ring-green-300">
                    {t.download}
                </button>
              </div>

              <footer className="text-center mt-6">
                 <p className="text-xs text-slate-500">{apiResponse[`disclaimer_${lang}`]}</p>
              </footer>
           </div>
        )}
    </div>
  );
};



// --- VIEWS & ROUTING ---
const FormView = ({ moduleId, onBack, lang }: { moduleId: string, onBack: () => void, lang: 'fa' | 'en' | 'uk' }) => {
    const content = formContent[moduleId];
    const t = {
        fa: { back: 'بازگشت به لیست فرم‌ها' },
        en: { back: 'Back to form list' },
        uk: { back: 'Повернутися до списку форм' }
    }[lang];

    return (
        <div className="bg-white/95 rounded-xl shadow-2xl p-6 sm:p-8 text-slate-800 animate-fade-in w-full">
            <header className="flex items-center justify-between mb-8">
                <h2 className="text-2xl sm:text-3xl font-bold text-blue-900">{content ? content[`title_${lang}`] : `Form ${moduleId}`}</h2>
                <button onClick={onBack} className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-2 px-4 rounded-lg transition-colors duration-300" aria-label={t.back}>
                    {lang === 'fa' ? 'بازگشت' : (lang === 'en' ? 'Back' : 'Назад')} &rarr;
                </button>
            </header>
            {content ? (
                <>
                    {content.questions && content.questions.length > 0 ? (
                        <FormFlow moduleContent={content} lang={lang} />
                    ) : (
                        <div className="text-slate-700 min-h-[200px]">
                            <p>{content[`intro_${lang}`]}</p>
                        </div>
                    )}
                </>
            ) : (
                <div className="text-center py-10 border-2 border-dashed border-slate-300 rounded-lg">
                    <p className="text-slate-600">{lang === 'fa' ? 'محل نمایش سوالات و دستیار هوش مصنوعی' : 'AI assistant and questions will be displayed here'}</p>
                    <p className="text-sm text-slate-400 mt-2">{lang === 'fa' ? 'این بخش در حال توسعه است' : 'This section is under development'}</p>
                </div>
            )}
        </div>
    );
}

const PaymentGateway = ({ moduleId, onUnlock, onBack, lang }: { moduleId: string, onUnlock: () => void, onBack: () => void, lang: 'fa' | 'en' | 'uk' }) => {
  const [processing, setProcessing] = useState(false);
  
  const details = useMemo(() => {
    const paymentDetails = {
        pip: {
            price: 29.99,
            fa: { title: "دستیار فرم PIP را باز کنید", features: ["تمام ۱۷ بخش فرم PIP را با راهنمایی هوش مصنوعی تکمیل کنید.", "پاسخ‌های دقیق و شخصی‌سازی شده برای شرایط خود تولید کنید.", "یک درخواست قوی و متقاعدکننده برای افزایش شانس موفقیت خود آماده کنید."], uses: "شامل یک بار استفاده کامل از دستیار فرم." },
            en: { title: "Unlock the PIP Form Assistant", features: ["Complete all 17 sections of the PIP form with AI guidance.", "Generate detailed, personalized answers for your situation.", "Prepare a strong, persuasive application to maximize your chances of success."], uses: "Includes one-time full use of the form assistant." },
            uk: { title: "Розблокуйте асистента для форми PIP", features: ["Заповніть усі 17 розділів форми PIP за допомогою ШІ.", "Створюйте детальні, персоналізовані відповіді для вашої ситуації.", "Підготуйте сильну, переконливу заявку, щоб максимізувати ваші шанси на успіх."], uses: "Включає одноразове повне використання асистента." }
        },
        form_checker: {
            price: 9.99,
            fa: { title: "چک‌کننده فرم را باز کنید", features: ["بررسی تخصصی فرم‌های دولتی تکمیل‌شده شما توسط هوش مصنوعی.", "دریافت امتیاز کلی و بازخورد دقیق بر اساس ۶ معیار کلیدی.", "دریافت پیشنهادات مشخص برای بهبود پاسخ‌هایتان."], uses: "شامل پنج بار استفاده." },
            en: { title: "Unlock the Form Checker", features: ["Get an expert AI review of your completed government forms.", "Receive an overall score and detailed feedback on 6 key metrics.", "Get specific suggestions to improve your answers."], uses: "Includes 5 uses." },
            uk: { title: "Розблокуйте перевірку форм", features: ["Отримайте експертну перевірку ваших заповнених державних форм за допомогою ШІ.", "Отримайте загальну оцінку та детальний відгук за 6 ключовими показниками.", "Отримайте конкретні пропозиції для покращення ваших відповідей."], uses: "Включає 5 використань." }
        },
        default: {
            price: 14.99,
            fa: { title: "دستیار فرم را باز کنید", features: ["تمام سوالات را با راهنمایی هوش مصنوعی تکمیل کنید.", "پاسخ‌های دقیق و شخصی‌سازی شده برای شرایط خود تولید کنید.", "با اطمینان فرم خود را ارسال کنید."], uses: "شامل یک بار استفاده کامل از دستیار فرم." },
            en: { title: "Unlock the Form Assistant", features: ["Complete all questions with AI-powered guidance.", "Generate tailored, personalized answers for your situation.", "Submit your form with confidence."], uses: "Includes one-time full use of the form assistant." },
            uk: { title: "Розблокуйте асистента для форми", features: ["Заповніть усі питання за допомогою ШІ.", "Створюйте адаптовані, персоналізовані відповіді для вашої ситуації.", "Подавайте свою форму з упевненістю."], uses: "Включає одноразове повне використання асистента." }
        }
    };
    
    const moduleInfo = modules.find(m => m.id === moduleId);
    const specificDetails = paymentDetails[moduleId as keyof typeof paymentDetails] || paymentDetails.default;
    
    return {
      price: specificDetails.price,
      content: specificDetails[lang],
      module: moduleInfo ? { name: moduleInfo.name[lang], iconPath: moduleInfo.iconPath } : { name: '', iconPath: '' }
    }
  }, [moduleId, lang]);


  const handlePayClick = async () => {
    setProcessing(true);
    console.log(`Simulating payment of £${details.price} for ${moduleId}...`);
    setTimeout(() => {
      console.log("Simulated payment successful!");
      onUnlock();
      setProcessing(false);
    }, 2000);
  };
  
  const t = {
    fa: { pay: 'پرداخت امن', redirecting: 'در حال انتقال...', back: 'بازگشت' },
    en: { pay: 'Pay Securely', redirecting: 'Redirecting...', back: 'Back' },
    uk: { pay: 'Безпечна оплата', redirecting: 'Перенаправлення...', back: 'Назад' },
  }[lang];

  return (
    <div className="bg-white/95 rounded-xl shadow-2xl p-6 sm:p-8 text-slate-800 animate-fade-in w-full max-w-lg mx-auto text-center relative">
        <button onClick={onBack} className="absolute top-4 left-4 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-1 px-3 rounded-lg transition-colors duration-300 text-sm" aria-label={t.back}>
            &larr; {t.back}
        </button>
        <header className="mb-6 pt-8">
            <div className="inline-block mb-4 text-blue-600">
                <CardIcon path={details.module.iconPath} />
            </div>
            <h1 className="text-3xl font-bold text-blue-900">{details.content.title}</h1>
            <p className="mt-2 text-slate-600">{details.module.name}</p>
        </header>
        <div className={`space-y-3 mb-8 bg-slate-50 p-6 rounded-lg border border-slate-200 ${lang === 'fa' ? 'text-right' : 'text-left'}`}>
            {details.content.features.map((feature, i) => (
              <p key={i} className="flex items-start"><svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${lang === 'fa' ? 'ml-2' : 'mr-2'} text-green-500 shrink-0 mt-0.5`} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>{feature}</p>
            ))}
        </div>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center mb-6">
            <p className="text-4xl font-extrabold text-slate-800">£{details.price.toFixed(2)}</p>
            <p className="text-blue-700 font-semibold">{details.content.uses}</p>
        </div>

        <button 
            onClick={handlePayClick}
            disabled={processing}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors text-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-lg transform hover:scale-105"
        >
            {processing 
                ? (
                    <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        {t.redirecting}
                    </>
                )
                : `${t.pay} £${details.price.toFixed(2)}`
            }
        </button>
    </div>
  );
};

const LanguageSwitcher = ({ language, setLanguage }: { language: 'fa' | 'en' | 'uk', setLanguage: (lang: 'fa' | 'en' | 'uk') => void }) => {
    const languages = {
        fa: { name: 'فارسی', flag: '🇮🇷' },
        en: { name: 'English', flag: '🇬🇧' },
        uk: { name: 'Українська', flag: '🇺🇦' },
    };

    const handleLanguageChange = () => {
        const langCycle: ('fa' | 'en' | 'uk')[] = ['fa', 'en', 'uk'];
        const currentIndex = langCycle.indexOf(language);
        const nextIndex = (currentIndex + 1) % langCycle.length;
        setLanguage(langCycle[nextIndex]);
    };

    return (
        <button
            onClick={handleLanguageChange}
            className="bg-white/20 backdrop-blur-sm text-white font-semibold py-2 px-4 rounded-lg transition-colors hover:bg-white/30 flex items-center gap-2"
            aria-label="Change language"
        >
            <span>{languages[language].flag}</span>
            <span>{languages[language].name}</span>
        </button>
    );
};

interface UnlockedModule {
  unlocked: boolean;
  usesLeft: number;
}

// FIX: Export 'App' component as a named export to be used in src/main.tsx.
export const App = () => {
  const [language, setLanguage] = useState<'fa' | 'en' | 'uk'>('fa');
  const [unlockedModules, setUnlockedModules] = useState<{ [key: string]: UnlockedModule }>({});
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);

  useEffect(() => {
    // Load unlock status from localStorage on mount
    try {
        const savedStatus = localStorage.getItem('unlockedModules');
        if (savedStatus) {
            setUnlockedModules(JSON.parse(savedStatus));
        }
    } catch (e) {
        console.error("Could not parse unlockedModules from localStorage", e);
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'fa' ? 'rtl' : 'ltr';
    const titles = {
        fa: 'UK PIP Assist',
        en: 'UK PIP Assist',
        uk: 'UK PIP Assist'
    }
    document.title = titles[language];
  }, [language]);
  
  const handleUnlockModule = (moduleId: string) => {
    const uses = moduleId === 'form_checker' ? 5 : 1;
    const newState = {
      ...unlockedModules,
      [moduleId]: { unlocked: true, usesLeft: uses }
    };
    setUnlockedModules(newState);
    localStorage.setItem('unlockedModules', JSON.stringify(newState));
  };
  
  const handleBack = () => {
      setSelectedModuleId(null);
  };
  
  const t = {
    fa: { header: 'UK PIP Assist', subheader: 'برای شروع، نوع فرم مورد نظر خود را انتخاب کنید', subtitle: 'آموزش دیده بر روی بیش از ۲۰٬۰۰۰ پرونده' },
    en: { header: 'UK PIP Assist', subheader: 'To get started, select the type of form you need', subtitle: 'Trained on over 20,000 cases' },
    uk: { header: 'UK PIP Assist', subheader: 'Для початку виберіть потрібний тип форми', subtitle: 'Навчено на понад 20 000 справах' }
  }[language];
  
  const renderContent = () => {
    if (selectedModuleId) {
      const isModuleUnlocked = !!unlockedModules[selectedModuleId]?.unlocked;

      if (!isModuleUnlocked) {
        return (
          <PaymentGateway 
            moduleId={selectedModuleId} 
            onUnlock={() => handleUnlockModule(selectedModuleId)} 
            onBack={handleBack} 
            lang={language} 
          />
        );
      }
      
      switch (selectedModuleId) {
        case 'form_checker':
          return <FormCheckerView onBack={handleBack} lang={language} isUnlocked={isModuleUnlocked} />;
        default:
          return <FormView moduleId={selectedModuleId} onBack={handleBack} lang={language} />;
      }
    }

    return (
      <>
        <header className="text-center mb-10 text-white">
          <div className="inline-block mb-4">
             <Logo className="w-32 h-32" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold">{t.header}</h1>
          <p className="mt-2 text-lg text-blue-200">{t.subtitle}</p>
          <p className="mt-4 text-lg text-blue-100">{t.subheader}</p>
        </header>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 sm:gap-6">
          {modules.map((module) => (
            <ModuleCard 
              key={module.id} 
              name={module.name[language]} 
              iconPath={module.iconPath} 
              onClick={() => setSelectedModuleId(module.id)}
              lang={language}
            />
          ))}
        </div>

        <footer className="text-center mt-12 text-blue-200 text-sm">
          <p>Created by Manix</p>
        </footer>
      </>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-green-400 p-4 sm:p-6 md:p-8 flex items-center justify-center relative">
      <div className="absolute top-4 right-4 z-10">
          <LanguageSwitcher language={language} setLanguage={setLanguage} />
      </div>
      <main className="max-w-4xl mx-auto w-full">
        {renderContent()}
      </main>
    </div>
  );
};

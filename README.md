# DJ Remax — دي جي ريمكس

تطبيق لإدارة حجوزات خدمة الدي جي.

- **الحجوزات:** تقويم شهري. اضغط على اليوم لإضافة حجز، واضغط على الحجز لعرض معلوماته أو نسخ رسالة الحجز مع سياسة الإلغاء.
- **المصاريف:** تسجيل المصاريف وربطها بحجز معيّن إذا تبي.
- **المالية:** خصم المصاريف من الحجوزات، وعرض صافي كل حجز وكل شهر والسنة.
- **الإعدادات:** اسم الخدمة ورقم التواصل والموقع وسياسة الإلغاء، والحساب، والنسخ الاحتياطي.

## النشر على GitHub Pages
كل دفع على `main` ينشر التطبيق تلقائيًا (`.github/workflows/pages.yml`).
مرة وحدة فقط: Settings → Pages → Source → **GitHub Actions**.
GitHub Pages يشتغل على المستودعات العامة، أو الخاصة مع اشتراك GitHub Pro.

## المزامنة بين الأجهزة (Supabase)
1. سوِّ مشروع مجاني في https://supabase.com
2. SQL Editor → الصق محتوى `supabase.sql` → Run.
3. Authentication → Users → Add user: بريدك وكلمة مرور (هذا حساب الدخول للتطبيق).
4. Authentication → Sign In / Providers → أطفئ **Allow new users to sign up**.
5. Project Settings → API: انسخ Project URL و anon public key وحطهم في `config.js`.

إذا كان `config.js` فاضي، التطبيق يحفظ البيانات على الجهاز فقط.

## التشغيل محليًا
```
python3 -m http.server 8000
```

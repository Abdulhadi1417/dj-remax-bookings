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

## المزامنة بين الأجهزة (Firebase)
1. افتح https://console.firebase.google.com وسوِّ مشروع جديد (Google Analytics مو ضروري).
2. **Build → Authentication → Get started → Email/Password → Enable → Save**.
3. **Authentication → Users → Add user**: بريدك وكلمة مرور (هذا حساب الدخول للتطبيق).
4. **Authentication → Settings → User actions**: شيل علامة **Enable create (sign-up)** عشان محد غيرك يسوي حساب.
5. **Build → Firestore Database → Create database** (اختر أقرب منطقة، و Production mode).
6. **Firestore → Rules**: الصق محتوى `firestore.rules` ← **Publish**.
7. **Project settings ⚙️ → Your apps → Web `</>`**: سجّل تطبيق، وانسخ `firebaseConfig` وحطه في `config.js`:
   `window.DJ_FIREBASE_CONFIG = { apiKey: "...", authDomain: "...", projectId: "...", ... };`

إذا كان `config.js` فيه `null`، التطبيق يحفظ البيانات على الجهاز فقط.

## التشغيل محليًا
```
python3 -m http.server 8000
```

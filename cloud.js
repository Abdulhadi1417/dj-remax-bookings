// طبقة المزامنة مع Firebase (Firestore + تسجيل الدخول بالبريد).
// المجموعات: bookings/{id} و expenses/{id} و settings/main
window.Cloud = (() => {
  const config = window.DJ_FIREBASE_CONFIG;
  const enabled = Boolean(config && config.apiKey && window.firebase);
  if (!enabled) return { enabled: false };

  firebase.initializeApp(config);
  const auth = firebase.auth();
  const db = firebase.firestore();

  // ننتظر Firebase يتحقق من الجلسة المحفوظة قبل ما نقرر نعرض شاشة الدخول
  const authReady = new Promise((resolve) => {
    const stop = auth.onAuthStateChanged(() => {
      stop();
      resolve();
    });
  });

  async function session() {
    await authReady;
    return auth.currentUser ? { user: auth.currentUser } : null;
  }

  async function signIn(email, password) {
    await auth.signInWithEmailAndPassword(email, password);
  }

  async function signOut() {
    await auth.signOut();
  }

  async function fetchAll() {
    const [bookings, expenses, settings] = await Promise.all([
      db.collection("bookings").get(),
      db.collection("expenses").get(),
      db.collection("settings").doc("main").get(),
    ]);
    return {
      bookings: bookings.docs.map((d) => d.data()),
      expenses: expenses.docs.map((d) => d.data()),
      settings: settings.exists ? settings.data() : null,
    };
  }

  // Firestore يقبل 500 عملية كحد أقصى في الدفعة الوحدة
  async function commitInChunks(ops) {
    for (let i = 0; i < ops.length; i += 450) {
      const batch = db.batch();
      ops.slice(i, i + 450).forEach((op) => op(batch));
      await batch.commit();
    }
  }

  async function upsert(collection, rows) {
    rows = [].concat(rows);
    await commitInChunks(rows.map((r) => (batch) => batch.set(db.collection(collection).doc(r.id), r)));
  }

  async function remove(collection, ids) {
    ids = [].concat(ids);
    await commitInChunks(ids.map((id) => (batch) => batch.delete(db.collection(collection).doc(id))));
  }

  async function saveSettings(settings) {
    await db.collection("settings").doc("main").set(settings);
  }

  // استبدال كل البيانات أونلاين بنسخة كاملة (للاستيراد ورفع البيانات المحلية)
  async function replaceAll({ bookings, expenses, settings }) {
    for (const name of ["bookings", "expenses"]) {
      const snap = await db.collection(name).get();
      await commitInChunks(snap.docs.map((d) => (batch) => batch.delete(d.ref)));
    }
    await upsert("bookings", bookings);
    await upsert("expenses", expenses);
    await saveSettings(settings);
  }

  return { enabled: true, session, signIn, signOut, fetchAll, upsert, remove, saveSettings, replaceAll };
})();

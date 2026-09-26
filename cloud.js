// طبقة المزامنة مع Supabase. كل سجل يُحفظ كصف: id + data (jsonb).
window.Cloud = (() => {
  const url = window.DJ_SUPABASE_URL || "";
  const key = window.DJ_SUPABASE_ANON_KEY || "";
  const enabled = Boolean(url && key && window.supabase);
  if (!enabled) return { enabled: false };

  const client = window.supabase.createClient(url, key);
  const now = () => new Date().toISOString();

  function check(result) {
    if (result.error) throw result.error;
    return result.data;
  }

  async function session() {
    const { data } = await client.auth.getSession();
    return data.session;
  }

  async function signIn(email, password) {
    check(await client.auth.signInWithPassword({ email, password }));
  }

  async function signOut() {
    await client.auth.signOut();
  }

  async function fetchAll() {
    const [bookings, expenses, settings] = await Promise.all([
      client.from("bookings").select("data"),
      client.from("expenses").select("data"),
      client.from("settings").select("data").eq("id", "main").maybeSingle(),
    ]);
    return {
      bookings: check(bookings).map((r) => r.data),
      expenses: check(expenses).map((r) => r.data),
      settings: check(settings) ? settings.data.data : null,
    };
  }

  async function upsert(table, rows) {
    rows = [].concat(rows);
    if (!rows.length) return;
    check(await client.from(table).upsert(rows.map((r) => ({ id: r.id, data: r, updated_at: now() }))));
  }

  async function remove(table, ids) {
    ids = [].concat(ids);
    if (!ids.length) return;
    check(await client.from(table).delete().in("id", ids));
  }

  async function saveSettings(settings) {
    check(await client.from("settings").upsert({ id: "main", data: settings, updated_at: now() }));
  }

  // استبدال كل البيانات أونلاين بنسخة كاملة (للاستيراد ورفع البيانات المحلية)
  async function replaceAll({ bookings, expenses, settings }) {
    check(await client.from("bookings").delete().neq("id", ""));
    check(await client.from("expenses").delete().neq("id", ""));
    await upsert("bookings", bookings);
    await upsert("expenses", expenses);
    await saveSettings(settings);
  }

  return { enabled: true, session, signIn, signOut, fetchAll, upsert, remove, saveSettings, replaceAll };
})();

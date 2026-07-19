import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { BookOpen, Eye, EyeOff, AlertCircle, Loader2, ArrowLeft, Users, FileText, BookMarked } from "lucide-react";
import { useAuth } from "./AuthContext";
import { GOOGLE_AUTH_URL, LINE_AUTH_URL } from "../../services/auth.service";
import { CSITArtwork } from "./CSITArtwork";

const DEMO_HINT_ADMIN = "admin@csitsheet.app  /  Admin@1234";
const DEMO_HINT_USER  = "user@csitsheet.app  /  User@1234";

const STATS = [
  { icon: Users,      value: "1,200+", label: "นิสิต" },
  { icon: FileText,   value: "850+",   label: "ชีทสรุป" },
  { icon: BookMarked, value: "60+",    label: "รายวิชา" },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const { user, loading, loginAttempts, login } = useAuth();

  const [form, setForm]     = useState({ usernameOrEmail: "", password: "" });
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const [busy, setBusy]     = useState(false);

  useEffect(() => {
    if (!loading && user) {
      navigate(user.role === "ADMIN" ? "/admin" : "/dashboard", { replace: true });
    }
  }, [user, loading, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const u = await login({ usernameOrEmail: form.usernameOrEmail, password: form.password });
      navigate(u.role === "ADMIN" ? "/admin" : "/dashboard", { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setBusy(false);
    }
  }

  const attemptsLeft = 5 - loginAttempts;

  return (
    <div className="flex min-h-screen">
      {/* ── LEFT PANEL ──────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-[#0B0B0B]">
        {/* Animated CSIT wireframe canvas */}
        <CSITArtwork />

        {/* Overlay content */}
        <div className="absolute inset-0 flex flex-col justify-between p-10 z-10 pointer-events-none">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 pointer-events-auto w-fit">
            <div
              className="w-9 h-9 rounded-[10px] flex items-center justify-center border"
              style={{ backgroundColor: "rgba(255,255,255,0.08)", borderColor: "rgba(255,255,255,0.15)" }}
            >
              <BookOpen className="w-5 h-5 text-[#9FE870]" />
            </div>
            <span style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 900, fontSize: 18, color: "#fff", letterSpacing: "0.02em" }}>
              CSIT SHEET
            </span>
          </Link>

          {/* Bottom text block */}
          <div>
            {/* Live badge */}
            <div
              className="mb-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full border"
              style={{ backgroundColor: "rgba(255,255,255,0.07)", borderColor: "rgba(255,255,255,0.15)" }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#9FE870] animate-pulse block" />
              <span style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 600, fontSize: 11, color: "rgba(255,255,255,0.65)", letterSpacing: "0.08em" }}>
                CSIT · NARESUAN UNIVERSITY
              </span>
            </div>

            <h2 style={{ fontFamily: "'Outfit','Noto Sans Thai',sans-serif", fontWeight: 900, fontSize: 30, color: "#fff", lineHeight: 1.3 }}>
              แพลตฟอร์มแชร์ชีทสรุป<br />สำหรับนิสิต CSIT
            </h2>
            <p style={{ fontFamily: "'Noto Sans Thai',sans-serif", fontSize: 14, color: "rgba(255,255,255,0.45)", marginTop: 10, lineHeight: 1.7 }}>
              รวบรวมชีทสรุปจากรุ่นพี่ ตรวจสอบโดยอาจารย์<br />เพื่อให้น้องๆ เรียนรู้ได้ง่ายและเร็วขึ้น
            </p>

            {/* Stats */}
            <div className="flex items-center gap-8 mt-7">
              {STATS.map(({ icon: Icon, value, label }) => (
                <div key={label}>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <Icon className="w-3.5 h-3.5 text-[#9FE870]" />
                    <span style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 900, fontSize: 20, color: "#fff" }}>
                      {value}
                    </span>
                  </div>
                  <span style={{ fontFamily: "'Noto Sans Thai',sans-serif", fontSize: 12, color: "rgba(255,255,255,0.35)" }}>
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL ─────────────────────────────────────────── */}
      <div className="flex-1 bg-white flex flex-col">
        {/* Mobile header */}
        <div className="lg:hidden flex items-center justify-between px-6 pt-6 pb-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-[9px] bg-[#1F1F1F] flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-[#9FE870]" />
            </div>
            <span style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 900, fontSize: 17, color: "#1F1F1F" }}>
              CSIT SHEET
            </span>
          </Link>
          <Link to="/" className="flex items-center gap-1 text-[#6B6B6B] hover:text-[#1F1F1F] transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span style={{ fontFamily: "'Noto Sans Thai',sans-serif", fontSize: 13 }}>กลับ</span>
          </Link>
        </div>

        {/* Form area */}
        <div className="flex-1 flex items-center justify-center px-8 py-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="w-full max-w-[400px]"
          >
            {/* Title */}
            <h1
              style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 900, fontSize: 32, color: "#0A0A0A", letterSpacing: "-0.02em" }}
              className="mb-1"
            >
              Log in
            </h1>
            <p style={{ fontFamily: "'Noto Sans Thai',sans-serif", fontSize: 14, color: "#6B6B6B" }} className="mb-7">
              ยินดีต้อนรับกลับสู่ CSIT SHEET
            </p>

            {/* Demo hint */}
            <div
              className="mb-6 rounded-[12px] p-3.5 border"
              style={{ backgroundColor: "#FAFAFA", borderColor: "#EBEBEB" }}
            >
              <p style={{ fontFamily: "'Outfit',sans-serif", fontSize: 11, fontWeight: 700, color: "#1F1F1F", letterSpacing: "0.06em" }} className="mb-1.5">
                DEMO ACCOUNTS
              </p>
              <p style={{ fontFamily: "ui-monospace,monospace", fontSize: 11, color: "#6B6B6B" }}>👤 {DEMO_HINT_USER}</p>
              <p style={{ fontFamily: "ui-monospace,monospace", fontSize: 11, color: "#6B6B6B" }}>🛡️ {DEMO_HINT_ADMIN}</p>
            </div>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-5 flex items-start gap-2 rounded-[10px] bg-red-50 border border-red-200 px-4 py-3"
                >
                  <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                  <div>
                    <p style={{ fontFamily: "'Noto Sans Thai',sans-serif", fontSize: 13, color: "#b91c1c" }}>{error}</p>
                    {loginAttempts > 0 && loginAttempts < 5 && (
                      <p style={{ fontFamily: "'Noto Sans Thai',sans-serif", fontSize: 11, color: "#6B6B6B" }} className="mt-0.5">
                        เหลืออีก {attemptsLeft} ครั้งก่อนถูกล็อก
                      </p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {/* Username / Email */}
              <div className="flex flex-col gap-1.5">
                <label
                  style={{ fontFamily: "'Outfit',sans-serif", fontSize: 13, fontWeight: 600, color: "#1F1F1F", letterSpacing: "0.01em" }}
                >
                  Username or Email
                </label>
                <input
                  type="text"
                  autoComplete="username"
                  required
                  value={form.usernameOrEmail}
                  onChange={e => setForm(f => ({ ...f, usernameOrEmail: e.target.value }))}
                  className="w-full px-4 py-3 rounded-[10px] border bg-white text-[#1F1F1F] outline-none transition"
                  style={{
                    fontFamily: "'Noto Sans Thai',sans-serif",
                    fontSize: 14,
                    borderColor: "#E0E0E0",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                  }}
                  onFocus={e => { e.target.style.borderColor = "#1F1F1F"; e.target.style.boxShadow = "0 0 0 3px rgba(31,31,31,0.08)"; }}
                  onBlur={e => { e.target.style.borderColor = "#E0E0E0"; e.target.style.boxShadow = "0 1px 2px rgba(0,0,0,0.04)"; }}
                  placeholder="username หรือ email@example.com"
                />
              </div>

              {/* Password */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label
                    style={{ fontFamily: "'Outfit',sans-serif", fontSize: 13, fontWeight: 600, color: "#1F1F1F", letterSpacing: "0.01em" }}
                  >
                    Password
                  </label>
                  <button
                    type="button"
                    style={{ fontFamily: "'Noto Sans Thai',sans-serif", fontSize: 12, color: "#6B6B6B" }}
                    className="hover:text-[#1F1F1F] transition-colors underline underline-offset-2"
                  >
                    ลืมรหัสผ่าน?
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPw ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    className="w-full px-4 py-3 pr-12 rounded-[10px] border bg-white text-[#1F1F1F] outline-none transition"
                    style={{
                      fontFamily: "ui-monospace,monospace",
                      fontSize: 14,
                      borderColor: "#E0E0E0",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                      letterSpacing: "0.06em",
                    }}
                    onFocus={e => { e.target.style.borderColor = "#1F1F1F"; e.target.style.boxShadow = "0 0 0 3px rgba(31,31,31,0.08)"; }}
                    onBlur={e => { e.target.style.borderColor = "#E0E0E0"; e.target.style.boxShadow = "0 1px 2px rgba(0,0,0,0.04)"; }}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPw(v => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9E9E9E] hover:text-[#1F1F1F] transition"
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Remember me */}
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <div
                  className="relative w-4 h-4 rounded-[4px] border flex items-center justify-center transition-all"
                  style={{
                    borderColor: remember ? "#1F1F1F" : "#D0D0D0",
                    backgroundColor: remember ? "#1F1F1F" : "transparent",
                  }}
                  onClick={() => setRemember(v => !v)}
                >
                  {remember && (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <span style={{ fontFamily: "'Noto Sans Thai',sans-serif", fontSize: 13, color: "#4A4A4A" }}>
                  จดจำฉันไว้
                </span>
              </label>

              {/* Submit */}
              <button
                type="submit"
                disabled={busy}
                className="w-full py-3 rounded-[10px] flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-60"
                style={{
                  fontFamily: "'Outfit',sans-serif",
                  fontWeight: 700,
                  fontSize: 15,
                  backgroundColor: "#0A0A0A",
                  color: "#fff",
                  letterSpacing: "0.01em",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.18), 0 4px 12px rgba(0,0,0,0.12)",
                }}
                onMouseEnter={e => { if (!busy) (e.target as HTMLElement).style.backgroundColor = "#222"; }}
                onMouseLeave={e => { (e.target as HTMLElement).style.backgroundColor = "#0A0A0A"; }}
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {busy ? "Signing in…" : "Sign in"}
              </button>
            </form>

            {/* Divider */}
            <div className="my-5 flex items-center gap-3">
              <div className="flex-1 h-px" style={{ backgroundColor: "#EBEBEB" }} />
              <span style={{ fontFamily: "'Outfit',sans-serif", fontSize: 12, color: "#ABABAB", letterSpacing: "0.04em" }}>
                OR
              </span>
              <div className="flex-1 h-px" style={{ backgroundColor: "#EBEBEB" }} />
            </div>

            {/* OAuth */}
            <div className="flex flex-col gap-3">
              <a
                href={GOOGLE_AUTH_URL}
                className="flex items-center justify-center gap-3 py-2.5 rounded-[10px] border transition-all duration-200"
                style={{
                  fontFamily: "'Outfit',sans-serif",
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#1F1F1F",
                  borderColor: "#E0E0E0",
                  backgroundColor: "#fff",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "#FAFAFA"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "#fff"; }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Continue with Google
              </a>
              <a
                href={LINE_AUTH_URL}
                className="flex items-center justify-center gap-3 py-2.5 rounded-[10px] transition-all duration-200"
                style={{
                  fontFamily: "'Outfit',sans-serif",
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#fff",
                  backgroundColor: "#06C755",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.filter = "brightness(1.08)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.filter = "none"; }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                  <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596a.631.631 0 0 1-.215.038.635.635 0 0 1-.5-.242l-2.443-3.317v2.929c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595a.641.641 0 0 1 .216-.039c.195 0 .378.094.5.24l2.444 3.317V8.108c0-.345.282-.63.628-.63.345 0 .629.285.629.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
                </svg>
                Continue with LINE
              </a>
            </div>

            {/* Register link */}
            <p className="mt-7 text-center" style={{ fontFamily: "'Noto Sans Thai',sans-serif", fontSize: 13, color: "#8A8A8A" }}>
              ยังไม่มีบัญชี?{" "}
              <Link
                to="/register"
                className="transition-colors"
                style={{ color: "#0A0A0A", fontWeight: 700, textDecoration: "underline", textUnderlineOffset: 3 }}
              >
                สมัครสมาชิก
              </Link>
            </p>

            {/* Back to home — desktop only */}
            <div className="hidden lg:flex justify-center mt-5">
              <Link
                to="/"
                className="flex items-center gap-1.5 transition-colors"
                style={{ fontFamily: "'Noto Sans Thai',sans-serif", fontSize: 12, color: "#ABABAB" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#1F1F1F"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#ABABAB"; }}
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                กลับสู่หน้าหลัก
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

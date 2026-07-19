import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import {
  BookOpen, Home, Inbox, Activity, MessageSquare,
  LogOut, User, CheckCircle, XCircle, Clock, Shield,
  Users, FileStack, AlertTriangle, ChevronDown,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import {
  mockGetPendingSheets, mockGetStats,
  type AdminSheet, type PlatformStats,
} from "../../services/auth.service";

const ADMIN_NAV = [
  { label: "HOME",     icon: Home,         to: "/admin" },
  { label: "REQUEST",  icon: Inbox,         to: "/admin/requests" },
  { label: "STATUS",   icon: Activity,      to: "/admin/status" },
  { label: "FEEDBACK", icon: MessageSquare, to: "/admin/feedback" },
];

export default function AdminDashboard() {
  const { user, logout, logoutAll } = useAuth();
  const navigate = useNavigate();
  const [sheets, setSheets]   = useState<AdminSheet[]>([]);
  const [stats, setStats]     = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen]       = useState(false);
  const [showLogoutMenu, setShowLogoutMenu] = useState(false);
  const [rejectId, setRejectId]   = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => {
    Promise.all([mockGetPendingSheets(), mockGetStats()]).then(([s, t]) => {
      setSheets(s); setStats(t); setLoading(false);
    });
  }, []);

  async function handleLogout() { await logout();    navigate("/login"); }
  async function handleLogoutAll() { await logoutAll(); navigate("/login"); }

  function handleApprove(id: string) {
    setSheets(prev => prev.filter(s => s.id !== id));
  }

  function openReject(id: string) { setRejectId(id); setRejectReason(""); }
  function confirmReject() {
    if (rejectId) setSheets(prev => prev.filter(s => s.id !== rejectId));
    setRejectId(null);
  }

  return (
    <div className="min-h-screen bg-[#F5F5EF] flex">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-[#1F1F1F] flex flex-col transition-transform duration-300 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0 lg:static lg:flex lg:shrink-0`}>
        {/* Logo */}
        <div className="px-6 py-5 flex items-center gap-2 border-b border-white/10">
          <div className="w-8 h-8 rounded-[10px] bg-[#9FE870] flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-[#1F1F1F]" />
          </div>
          <span style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 900, fontSize: 18, color: "#fff" }}>
            CSIT SHEET
          </span>
        </div>

        {/* Admin badge */}
        <div className="mx-4 mt-3 mb-1 flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-[#9FE870]/10 border border-[#9FE870]/20">
          <Shield className="w-3.5 h-3.5 text-[#9FE870]" />
          <span style={{ fontFamily: "'Outfit',sans-serif", fontSize: 11, fontWeight: 700, color: "#9FE870" }}>ADMIN MODE</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-3 flex flex-col gap-1 overflow-y-auto">
          {ADMIN_NAV.map(item => {
            const Icon = item.icon;
            const isActive = location.pathname === item.to;
            return (
              <Link
                key={item.label}
                to={item.to}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-[12px] transition-all duration-150 ${isActive ? "bg-[#9FE870] text-[#1F1F1F]" : "text-white/60 hover:bg-white/10 hover:text-white"}`}
                style={{ fontFamily: "'Outfit',sans-serif", fontSize: 13, fontWeight: 700 }}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User + logout */}
        <div className="px-4 py-4 border-t border-white/10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
              <User className="w-4 h-4 text-white/60" />
            </div>
            <div className="min-w-0">
              <p style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 13, color: "#fff" }} className="truncate">{user?.username}</p>
              <p style={{ fontFamily: "'Noto Sans Thai',sans-serif", fontSize: 11, color: "rgba(255,255,255,0.4)" }} className="truncate">{user?.email}</p>
            </div>
          </div>
          <div className="relative">
            <button
              onClick={() => setShowLogoutMenu(v => !v)}
              className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-[10px] text-white/60 hover:bg-white/10 hover:text-white transition-all duration-150"
              style={{ fontFamily: "'Noto Sans Thai',sans-serif", fontSize: 13 }}
            >
              <span className="flex items-center gap-2"><LogOut className="w-4 h-4" /> ออกจากระบบ</span>
              <ChevronDown className={`w-3 h-3 transition-transform ${showLogoutMenu ? "rotate-180" : ""}`} />
            </button>
            <AnimatePresence>
              {showLogoutMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  className="absolute bottom-full left-0 right-0 mb-1 bg-[#2a2a2a] rounded-[12px] border border-white/10 overflow-hidden"
                >
                  <button onClick={handleLogout} className="w-full px-4 py-2.5 text-left text-white/80 hover:bg-white/10 transition text-sm" style={{ fontFamily: "'Noto Sans Thai',sans-serif" }}>
                    ออกจากระบบอุปกรณ์นี้
                  </button>
                  <button onClick={handleLogoutAll} className="w-full px-4 py-2.5 text-left text-red-400 hover:bg-white/10 transition text-sm" style={{ fontFamily: "'Noto Sans Thai',sans-serif" }}>
                    ออกจากทุกอุปกรณ์
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 bg-black/30 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="sticky top-0 z-20 bg-white border-b border-[#DADAD2] px-6 h-14 flex items-center gap-4">
          <button className="lg:hidden p-1 text-[#6B6B6B]" onClick={() => setSidebarOpen(v => !v)}>
            <div className="w-5 h-0.5 bg-current mb-1" /><div className="w-5 h-0.5 bg-current mb-1" /><div className="w-5 h-0.5 bg-current" />
          </button>
          <p style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 15, color: "#1F1F1F" }}>
            Admin Dashboard
          </p>
          {sheets.length > 0 && (
            <span className="ml-auto flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-100 text-orange-700 text-xs" style={{ fontFamily: "'Noto Sans Thai',sans-serif", fontWeight: 600 }}>
              <AlertTriangle className="w-3 h-3" /> {sheets.length} รายการรออนุมัติ
            </span>
          )}
        </header>

        <main className="flex-1 px-6 py-8 max-w-5xl mx-auto w-full">
          {/* Platform stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[
              { label: "ผู้ใช้ทั้งหมด",  value: stats?.totalUsers,   icon: Users,     accent: "#9FE870" },
              { label: "ชีททั้งหมด",     value: stats?.totalSheets,  icon: FileStack, accent: "#9FE870" },
              { label: "รออนุมัติ",       value: stats?.pendingCount, icon: Clock,     accent: "#d97706" },
              { label: "อนุมัติแล้ว",    value: stats?.approvedCount,icon: CheckCircle,accent: "#16a34a" },
            ].map(stat => {
              const Icon = stat.icon;
              return (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                  className="bg-white rounded-[20px] border border-[#DADAD2] px-5 py-5 flex flex-col gap-2"
                >
                  <div className="w-8 h-8 rounded-[10px] flex items-center justify-center" style={{ background: stat.accent + "20" }}>
                    <Icon className="w-4 h-4" style={{ color: stat.accent }} />
                  </div>
                  <p style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 900, fontSize: 26, color: "#1F1F1F" }}>
                    {loading ? "—" : stat.value}
                  </p>
                  <p style={{ fontFamily: "'Noto Sans Thai',sans-serif", fontSize: 12, color: "#6B6B6B" }}>{stat.label}</p>
                </motion.div>
              );
            })}
          </div>

          {/* Moderation queue */}
          <div className="bg-white rounded-[20px] border border-[#DADAD2] p-6">
            <h2 style={{ fontFamily: "'Outfit','Noto Sans Thai',sans-serif", fontWeight: 900, fontSize: 18, color: "#1F1F1F" }} className="mb-5">
              คิวตรวจสอบชีท
            </h2>
            {loading ? (
              <div className="flex justify-center py-10">
                <div className="w-6 h-6 rounded-full border-2 border-[#9FE870] border-t-transparent animate-spin" />
              </div>
            ) : sheets.length === 0 ? (
              <div className="text-center py-10">
                <CheckCircle className="w-10 h-10 text-[#9FE870] mx-auto mb-2" />
                <p style={{ fontFamily: "'Noto Sans Thai',sans-serif", fontSize: 14, color: "#6B6B6B" }}>ไม่มีรายการรออนุมัติ</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {sheets.map(sheet => (
                  <motion.div
                    key={sheet.id}
                    layout
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-[14px] border border-[#DADAD2]"
                  >
                    <div className="flex-1 min-w-0">
                      <p style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 14, color: "#1F1F1F" }}>{sheet.title}</p>
                      <p style={{ fontFamily: "'Noto Sans Thai',sans-serif", fontSize: 12, color: "#6B6B6B" }}>
                        {sheet.subject} · โดย {sheet.uploaderUsername} ({sheet.uploaderEmail}) · {sheet.createdAt}
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => handleApprove(sheet.id)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-[12px] bg-[#9FE870] text-[#1F1F1F] text-sm hover:brightness-105 transition"
                        style={{ fontFamily: "'Noto Sans Thai',sans-serif", fontWeight: 600 }}
                      >
                        <CheckCircle className="w-3.5 h-3.5" /> อนุมัติ
                      </button>
                      <button
                        onClick={() => openReject(sheet.id)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-[12px] border border-red-200 text-red-600 text-sm hover:bg-red-50 transition"
                        style={{ fontFamily: "'Noto Sans Thai',sans-serif", fontWeight: 600 }}
                      >
                        <XCircle className="w-3.5 h-3.5" /> ปฏิเสธ
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Reject modal */}
      <AnimatePresence>
        {rejectId && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center px-4"
              onClick={() => setRejectId(null)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 16 }}
                onClick={e => e.stopPropagation()}
                className="bg-white rounded-[24px] p-8 w-full max-w-md border border-[#DADAD2] shadow-lg"
              >
                <h3 style={{ fontFamily: "'Outfit','Noto Sans Thai',sans-serif", fontWeight: 900, fontSize: 20, color: "#1F1F1F" }} className="mb-2">
                  ปฏิเสธชีท
                </h3>
                <p style={{ fontFamily: "'Noto Sans Thai',sans-serif", fontSize: 13, color: "#6B6B6B" }} className="mb-4">
                  กรุณาระบุเหตุผลเพื่อแจ้งผู้อัปโหลด
                </p>
                <textarea
                  rows={4}
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  placeholder="เนื้อหาไม่ถูกต้อง / ไม่เกี่ยวข้องกับรายวิชา..."
                  className="w-full px-4 py-3 rounded-[12px] border border-[#DADAD2] text-[#1F1F1F] text-sm outline-none focus:border-red-300 resize-none transition"
                  style={{ fontFamily: "'Noto Sans Thai',sans-serif" }}
                />
                <div className="flex gap-3 mt-5">
                  <button onClick={() => setRejectId(null)} className="flex-1 py-2.5 rounded-[12px] border border-[#DADAD2] text-[#6B6B6B] text-sm hover:bg-[#F5F5EF] transition" style={{ fontFamily: "'Noto Sans Thai',sans-serif" }}>
                    ยกเลิก
                  </button>
                  <button onClick={confirmReject} className="flex-1 py-2.5 rounded-[12px] bg-red-500 text-white text-sm hover:bg-red-600 transition" style={{ fontFamily: "'Noto Sans Thai',sans-serif", fontWeight: 600 }}>
                    ยืนยันปฏิเสธ
                  </button>
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

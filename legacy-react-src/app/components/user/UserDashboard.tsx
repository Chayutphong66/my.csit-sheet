import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { motion } from "motion/react";
import {
  BookOpen, Home, FileText, PlusCircle, HelpCircle,
  LogOut, User, Clock, CheckCircle, XCircle, ChevronRight, Upload,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { mockGetMySheets, type Sheet } from "../../services/auth.service";

const USER_NAV = [
  { label: "HOME",      icon: Home,       to: "/dashboard" },
  { label: "LECTURE",   icon: BookOpen,    to: "/dashboard/lecture" },
  { label: "SUM SHEET", icon: FileText,    to: "/dashboard/sheets" },
  { label: "ADD SHEET", icon: PlusCircle,  to: "/dashboard/add" },
  { label: "HELP",      icon: HelpCircle,  to: "/dashboard/help" },
];

const STATUS_BADGE: Record<Sheet["status"], { label: string; color: string; bg: string; icon: typeof CheckCircle }> = {
  APPROVED: { label: "อนุมัติแล้ว", color: "#166534", bg: "#dcfce7", icon: CheckCircle },
  PENDING:  { label: "รออนุมัติ",   color: "#92400e", bg: "#fef3c7", icon: Clock       },
  REJECTED: { label: "ปฏิเสธ",      color: "#991b1b", bg: "#fee2e2", icon: XCircle     },
};

export default function UserDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sheets, setSheets]     = useState<Sheet[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    mockGetMySheets().then(s => { setSheets(s); setLoadingData(false); });
  }, []);

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  const approved = sheets.filter(s => s.status === "APPROVED").length;
  const pending  = sheets.filter(s => s.status === "PENDING").length;

  return (
    <div className="min-h-screen bg-[#F5F5EF] flex">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-[#DADAD2] flex flex-col transition-transform duration-300 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0 lg:static lg:flex lg:shrink-0`}>
        {/* Logo */}
        <div className="px-6 py-5 flex items-center gap-2 border-b border-[#DADAD2]">
          <div className="w-8 h-8 rounded-[10px] bg-[#1F1F1F] flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-[#9FE870]" />
          </div>
          <span style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 900, fontSize: 18, color: "#1F1F1F" }}>
            CSIT SHEET
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-1 overflow-y-auto">
          {USER_NAV.map(item => {
            const Icon = item.icon;
            const isActive = location.pathname === item.to;
            return (
              <Link
                key={item.label}
                to={item.to}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-[12px] transition-all duration-150 ${isActive ? "bg-[#9FE870] text-[#1F1F1F]" : "text-[#6B6B6B] hover:bg-[#F5F5EF] hover:text-[#1F1F1F]"}`}
                style={{ fontFamily: "'Outfit',sans-serif", fontSize: 13, fontWeight: 700 }}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User profile */}
        <div className="px-4 py-4 border-t border-[#DADAD2]">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-[#EBEBE6] flex items-center justify-center">
              <User className="w-4 h-4 text-[#6B6B6B]" />
            </div>
            <div className="min-w-0">
              <p style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 13, color: "#1F1F1F" }} className="truncate">
                {user?.username}
              </p>
              <p style={{ fontFamily: "'Noto Sans Thai',sans-serif", fontSize: 11, color: "#6B6B6B" }} className="truncate">
                {user?.email}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-[10px] text-[#6B6B6B] hover:bg-red-50 hover:text-red-600 transition-all duration-150"
            style={{ fontFamily: "'Noto Sans Thai',sans-serif", fontSize: 13 }}
          >
            <LogOut className="w-4 h-4" /> ออกจากระบบ
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/20 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="sticky top-0 z-20 bg-white border-b border-[#DADAD2] px-6 h-14 flex items-center justify-between">
          <button className="lg:hidden p-1 text-[#6B6B6B]" onClick={() => setSidebarOpen(v => !v)}>
            <div className="w-5 h-0.5 bg-current mb-1" /><div className="w-5 h-0.5 bg-current mb-1" /><div className="w-5 h-0.5 bg-current" />
          </button>
          <p style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 15, color: "#1F1F1F" }}>
            สวัสดี, {user?.username} 👋
          </p>
          <Link
            to="/dashboard/add"
            className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-[24px] bg-[#9FE870] text-[#1F1F1F] hover:brightness-105 transition text-sm"
            style={{ fontFamily: "'Noto Sans Thai',sans-serif", fontWeight: 600 }}
          >
            <Upload className="w-4 h-4" /> อัปโหลดชีท
          </Link>
        </header>

        <main className="flex-1 px-6 py-8 max-w-5xl mx-auto w-full">
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
            {[
              { label: "ชีทที่อัปโหลด",   value: sheets.length,  color: "#9FE870", bg: "#f0fce8" },
              { label: "รออนุมัติ",       value: pending,         color: "#d97706", bg: "#fef9ee" },
              { label: "อนุมัติแล้ว",     value: approved,        color: "#16a34a", bg: "#f0fdf4" },
            ].map(stat => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="bg-white rounded-[20px] border border-[#DADAD2] px-5 py-5"
              >
                <p style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 900, fontSize: 28, color: stat.color }}>
                  {loadingData ? "—" : stat.value}
                </p>
                <p style={{ fontFamily: "'Noto Sans Thai',sans-serif", fontSize: 13, color: "#6B6B6B" }}>{stat.label}</p>
              </motion.div>
            ))}
          </div>

          {/* Profile card */}
          <div className="bg-white rounded-[20px] border border-[#DADAD2] p-6 mb-6">
            <h2 style={{ fontFamily: "'Outfit','Noto Sans Thai',sans-serif", fontWeight: 900, fontSize: 18, color: "#1F1F1F" }} className="mb-4">
              โปรไฟล์
            </h2>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-[#EBEBE6] flex items-center justify-center shrink-0">
                <User className="w-7 h-7 text-[#6B6B6B]" />
              </div>
              <div className="flex-1 min-w-0">
                <p style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 16, color: "#1F1F1F" }}>{user?.username}</p>
                <p style={{ fontFamily: "'Noto Sans Thai',sans-serif", fontSize: 13, color: "#6B6B6B" }}>{user?.email}</p>
                <span className="inline-block mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#EBEBE6] text-[#6B6B6B]" style={{ fontFamily: "'Outfit',sans-serif" }}>
                  {user?.role}
                </span>
              </div>
              <button
                className="shrink-0 px-4 py-2 rounded-[12px] border border-[#DADAD2] text-[#1F1F1F] text-sm hover:bg-[#F5F5EF] transition flex items-center gap-1"
                style={{ fontFamily: "'Noto Sans Thai',sans-serif", fontWeight: 600 }}
              >
                แก้ไข <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Sheets list */}
          <div className="bg-white rounded-[20px] border border-[#DADAD2] p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 style={{ fontFamily: "'Outfit','Noto Sans Thai',sans-serif", fontWeight: 900, fontSize: 18, color: "#1F1F1F" }}>
                ชีทของฉัน
              </h2>
              <Link to="/dashboard/add" className="text-sm text-[#4f8a2e] hover:underline flex items-center gap-1" style={{ fontFamily: "'Noto Sans Thai',sans-serif", fontWeight: 600 }}>
                + เพิ่มชีท
              </Link>
            </div>
            {loadingData ? (
              <div className="flex justify-center py-10">
                <div className="w-6 h-6 rounded-full border-2 border-[#9FE870] border-t-transparent animate-spin" />
              </div>
            ) : sheets.length === 0 ? (
              <div className="text-center py-10">
                <FileText className="w-10 h-10 text-[#DADAD2] mx-auto mb-2" />
                <p style={{ fontFamily: "'Noto Sans Thai',sans-serif", fontSize: 14, color: "#6B6B6B" }}>ยังไม่มีชีทที่อัปโหลด</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {sheets.map(sheet => {
                  const badge = STATUS_BADGE[sheet.status];
                  const BadgeIcon = badge.icon;
                  return (
                    <motion.div
                      key={sheet.id}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center gap-4 p-4 rounded-[14px] border border-[#DADAD2] hover:border-[#9FE870] transition-all duration-200"
                    >
                      <div className="w-9 h-9 rounded-[10px] bg-[#F5F5EF] flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4 text-[#6B6B6B]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 14, color: "#1F1F1F" }} className="truncate">{sheet.title}</p>
                        <p style={{ fontFamily: "'Noto Sans Thai',sans-serif", fontSize: 12, color: "#6B6B6B" }}>{sheet.subject} · {sheet.createdAt} · {sheet.downloadCount} ดาวน์โหลด</p>
                      </div>
                      <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: badge.bg, color: badge.color, fontFamily: "'Noto Sans Thai',sans-serif" }}>
                        <BadgeIcon className="w-3 h-3" />{badge.label}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

import { useRef, useEffect, useState, useCallback } from "react";
import { BrowserRouter, Routes, Route } from "react-router";
import { motion, useInView, AnimatePresence } from "motion/react";
import { BookOpen, Search, Star, ArrowRight, ChevronRight, Mail, Phone, MessageCircle, Menu, X, Upload, FileText, FolderTree, ShieldCheck, Send, Check, FileUp, Sparkles } from "lucide-react";
import { AuthProvider } from "./components/auth/AuthContext";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import LoginPage from "./components/auth/LoginPage";
import RegisterPage from "./components/auth/RegisterPage";
import UserDashboard from "./components/user/UserDashboard";
import AdminDashboard from "./components/admin/AdminDashboard";
import docStack1 from "@/imports/812382FA-07AA-40BF-A4BD-ED63F3DC6E36.jpeg";
import docStack2 from "@/imports/0A95F81F-E109-4026-86E5-703C3B87CF7D.jpeg";
import iconSearch from "@/imports/A9A138D1-8F83-423C-8666-D40B20AC82A7.jpeg";
import iconPapers from "@/imports/53125DD1-9512-4396-AC03-58CEFBBF319B-1.jpeg";
import iconFolder from "@/imports/53125DD1-9512-4396-AC03-58CEFBBF319B.jpeg";
import { ImageWithFallback } from "./components/figma/ImageWithFallback";

const NAV_ITEMS = [
  { label: "ฟีเจอร์", section: "features" },
  { label: "เพิ่มชีทสรุป", section: "howto" },
  { label: "ติดต่อเรา", section: "contact" },
];

const STEPS = [
  { number: 1, title: "เพิ่มสรุปวิชา", desc: "อัปโหลดไฟล์ชีทสรุปของคุณเข้าสู่ระบบ" },
  { number: 2, title: "กรอกข้อมูลรายละเอียดวิชา", desc: "ระบุชื่อวิชา คณะ และข้อมูลที่เกี่ยวข้อง" },
  { number: 3, title: "ระบบจัดหมวดหมู่", desc: "AI ช่วยจัดหมวดหมู่ชีทให้อัตโนมัติ" },
  { number: 4, title: "รออนุมัติจากแอดมิน", desc: "แอดมินตรวจสอบและรับรองคุณภาพชีท" },
  { number: 5, title: "ส่งขึ้นระบบ", desc: "ชีทของคุณพร้อมให้เพื่อนๆ ดาวน์โหลด!" },
];

const FEATURES = [
  {
    img: iconSearch,
    title: "ค้นหาชีทได้ง่าย",
    body: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ระบบค้นหาอัจฉริยะช่วยให้คุณหาชีทที่ต้องการได้รวดเร็ว ครอบคลุมทุกวิชาและทุกคณะ",
  },
  {
    img: iconPapers,
    title: "ตามเก็บสรุปให้ครบทุกวิชา",
    body: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Ut enim ad minim veniam, quis nostrud exercitation ullamco. ชีททุกใบผ่านการตรวจสอบโดยแอดมิน มั่นใจได้ว่าเนื้อหาถูกต้องและครบถ้วน",
  },
  {
    img: iconFolder,
    title: "หมดปัญหาการหาสรุปและสไลด์",
    body: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Duis aute irure dolor in reprehenderit in voluptate. แชร์ชีทของคุณและรับแต้มสะสมเพื่อแลกรับสิทธิพิเศษมากมาย",
  },
];

function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth" });
}

function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? "bg-white/90 backdrop-blur-md border-b border-[#1F1F1F]/10" : "bg-transparent"
      }`}
    >
      <nav className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2 select-none">
          <div className="w-8 h-8 rounded-[12px] bg-[#1F1F1F] flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-[#9FE870]" />
          </div>
          <span className="text-xl text-[#1F1F1F] tracking-tight" style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 900 }}>
            CSIT SHEET
          </span>
        </div>

        {/* Desktop nav */}
        <ul className="hidden md:flex items-center gap-1">
          {NAV_ITEMS.map((item) => (
            <li key={item.section}>
              <button
                onClick={() => scrollToSection(item.section)}
                className="px-4 py-2 rounded-[24px] text-sm text-[#1F1F1F] hover:bg-[#EBEBE6] transition-all duration-200"
                style={{ fontFamily: "'Noto Sans Thai', sans-serif", fontWeight: 600 }}
              >
                {item.label}
              </button>
            </li>
          ))}
          <li className="ml-2">
            <a
              href="/login"
              className="block px-5 py-2.5 rounded-[24px] bg-[#9FE870] text-[#1F1F1F] text-sm hover:brightness-110 active:scale-95 transition-all duration-200"
              style={{ fontFamily: "'Noto Sans Thai', sans-serif", fontWeight: 600 }}
            >
              เข้าใช้งาน
            </a>
          </li>
        </ul>

        {/* Mobile hamburger */}
        <button className="md:hidden p-2 rounded-[12px] text-[#1F1F1F] hover:bg-[#EBEBE6] transition" onClick={() => setOpen(!open)}>
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </nav>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden bg-white border-t border-[#1F1F1F]/10 px-6 py-4 flex flex-col gap-2">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.section}
              onClick={() => { scrollToSection(item.section); setOpen(false); }}
              className="text-left px-4 py-3 rounded-[16px] text-sm text-[#1F1F1F] hover:bg-[#EBEBE6] transition"
              style={{ fontFamily: "'Noto Sans Thai', sans-serif", fontWeight: 600 }}
            >
              {item.label}
            </button>
          ))}
          <a
            href="/login"
            className="mt-1 block px-5 py-3 rounded-[24px] bg-[#9FE870] text-[#1F1F1F] text-sm hover:brightness-110 transition text-center"
            style={{ fontFamily: "'Noto Sans Thai', sans-serif", fontWeight: 600 }}
          >
            เข้าใช้งาน
          </a>
        </div>
      )}
    </header>
  );
}

const SPIN_WORDS = [
  "NARESUAN UNIVERSITY",
  "SUMMARY SHEET",
  "CSIT STUDENT",
  "COMPUTER SCIENCE",
  "INFORMATION TECHNOLOGY",
];

function WelcomeBadge() {
  const [index, setIndex] = useState(0);
  const [displayed, setDisplayed] = useState("");
  const [showCursor, setShowCursor] = useState(true);

  useEffect(() => {
    const word = SPIN_WORDS[index];
    const charDelay = 2000 / word.length; // finish typing in ~2.0s
    let charIndex = 0;
    setDisplayed("");

    const typeInterval = setInterval(() => {
      charIndex++;
      setDisplayed(word.slice(0, charIndex));
      if (charIndex >= word.length) {
        clearInterval(typeInterval);
        // hold for 2s then move to next word
        setTimeout(() => {
          setIndex((i) => (i + 1) % SPIN_WORDS.length);
        }, 2000);
      }
    }, charDelay);

    return () => clearInterval(typeInterval);
  }, [index]);

  // blinking cursor
  useEffect(() => {
    const blink = setInterval(() => setShowCursor((c) => !c), 500);
    return () => clearInterval(blink);
  }, []);

  return (
    <div className="flex items-center">
      <span
        className="text-[#1F1F1F] shrink-0"
        style={{ fontFamily: "'Press Start 2P', monospace", whiteSpace: "nowrap", fontSize: "9px" }}
      >
        WELCOME TO&nbsp;
      </span>
      <span
        className="shrink-0"
        style={{
          fontFamily: "'Press Start 2P', monospace",
          color: "#4f8a2e",
          width: "180px",
          display: "inline-block",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textAlign: "left",
          fontSize: "9px",
        }}
      >
        {displayed}
        <span style={{ opacity: showCursor ? 1 : 0 }}>|</span>
      </span>
    </div>
  );
}

function SketchyFolder() {
  return (
    <svg viewBox="0 0 110 90" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      {/* folder back */}
      <path d="M8 28 Q7 22 13 21 L38 21 Q42 21 44 25 L48 30 L98 30 Q104 30 104 36 L104 78 Q104 84 98 84 L13 84 Q7 84 7 78 Z"
        fill="#fef9ee" stroke="#1a1a1a" strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round"/>
      {/* folder tab */}
      <path d="M13 21 L38 21 Q41 21 43 24 L47 29 L13 29 Z"
        fill="#fde68a" stroke="#1a1a1a" strokeWidth="3" strokeLinejoin="round"/>
      {/* hatching inside */}
      <path d="M18 40 L30 52 M24 38 L40 54 M32 37 L50 55 M42 37 L60 55 M52 38 L68 54 M62 39 L76 53 M72 40 L84 52"
        stroke="#ccc" strokeWidth="1" strokeLinecap="round" opacity="0.6"/>
      {/* crumpled paper inside */}
      <path d="M20 55 Q28 48 38 52 Q46 45 56 50 Q64 44 74 49 Q80 55 76 64 Q68 70 58 66 Q48 72 38 67 Q26 70 20 62 Z"
        fill="white" stroke="#555" strokeWidth="2" strokeLinejoin="round"/>
      <path d="M28 55 Q35 51 42 54 M50 50 Q58 47 65 51 M36 62 Q44 65 52 62 Q60 65 68 62"
        stroke="#999" strokeWidth="1" strokeLinecap="round" opacity="0.7"/>
      {/* paperclip */}
      <path d="M88 58 Q100 52 102 62 Q104 72 94 76 Q84 80 80 70 Q76 58 88 52 Q96 48 100 56"
        stroke="#1a1a1a" strokeWidth="3.5" strokeLinecap="round" fill="none"/>
    </svg>
  );
}

function SketchyDocument() {
  return (
    <svg viewBox="0 0 70 90" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      {/* page with folded corner */}
      <path d="M8 6 L50 6 L62 18 L62 84 Q62 88 58 88 L12 88 Q8 88 8 84 Z"
        fill="#fff" stroke="#1a1a1a" strokeWidth="3" strokeLinejoin="round"/>
      {/* folded corner */}
      <path d="M50 6 L50 18 L62 18" stroke="#1a1a1a" strokeWidth="3" strokeLinejoin="round" fill="#f0f0f0"/>
      {/* lines */}
      <path d="M16 30 L54 30" stroke="#ccc" strokeWidth="2" strokeLinecap="round"/>
      <path d="M16 40 L54 40" stroke="#ccc" strokeWidth="2" strokeLinecap="round"/>
      <path d="M16 50 L46 50" stroke="#ccc" strokeWidth="2" strokeLinecap="round"/>
      <path d="M16 60 L54 60" stroke="#ccc" strokeWidth="2" strokeLinecap="round"/>
      <path d="M16 70 L40 70" stroke="#ccc" strokeWidth="2" strokeLinecap="round"/>
      {/* sketchy strokes */}
      <path d="M10 10 Q9 50 10 85" stroke="#e0e0e0" strokeWidth="1" strokeLinecap="round" opacity="0.5"/>
    </svg>
  );
}

function SketchyCrumpledPaper() {
  return (
    <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      {/* crumpled ball outline */}
      <path d="M40 8 Q58 6 68 18 Q78 30 74 46 Q70 62 56 70 Q42 78 26 72 Q10 66 6 50 Q2 34 14 20 Q24 8 40 8 Z"
        fill="white" stroke="#1a1a1a" strokeWidth="3" strokeLinejoin="round"/>
      {/* crumple lines */}
      <path d="M20 20 Q30 28 26 40" stroke="#555" strokeWidth="2" strokeLinecap="round"/>
      <path d="M40 10 Q44 22 38 30 Q32 38 36 50" stroke="#555" strokeWidth="2" strokeLinecap="round"/>
      <path d="M60 22 Q54 32 58 44" stroke="#555" strokeWidth="2" strokeLinecap="round"/>
      <path d="M18 48 Q28 44 36 50 Q46 56 56 50" stroke="#555" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M24 30 Q36 34 44 28 Q54 24 62 32" stroke="#888" strokeWidth="1.2" strokeLinecap="round"/>
      <path d="M14 36 Q22 40 28 36" stroke="#888" strokeWidth="1.2" strokeLinecap="round"/>
      <path d="M50 58 Q58 54 66 58" stroke="#888" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  );
}

function SketchyStar() {
  return (
    <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <path d="M60 10 L68 45 L100 30 L78 55 L108 68 L72 65 L75 100 L58 72 L38 102 L45 67 L12 72 L42 54 L20 28 L52 44 Z"
        fill="#c5edab" stroke="#9FE870" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"
        style={{ filter: "url(#sketch)" }} />
      {/* Sketchy cross-hatch fill lines */}
      <path d="M35 45 Q55 50 75 48 M32 52 Q52 56 78 53 M30 59 Q53 62 80 59 M33 66 Q54 68 77 65 M38 73 Q56 74 74 71" stroke="#9FE870" strokeWidth="1" strokeLinecap="round" opacity="0.5"/>
      <path d="M45 35 Q50 55 48 75 M52 32 Q56 52 54 78 M59 30 Q62 51 61 80 M66 33 Q68 53 67 77 M73 38 Q74 56 72 74" stroke="#9FE870" strokeWidth="1" strokeLinecap="round" opacity="0.5"/>
      <defs>
        <filter id="sketch" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="4" seed="3" result="noise"/>
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="2" xChannelSelector="R" yChannelSelector="G"/>
        </filter>
      </defs>
    </svg>
  );
}

function SketchyAsterisk() {
  return (
    <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      {[0,30,60,90,120,150,180,210,240,270,300,330].map((deg, i) => (
        <line
          key={i}
          x1="40" y1="40"
          x2={40 + 28 * Math.cos((deg * Math.PI) / 180)}
          y2={40 + 28 * Math.sin((deg * Math.PI) / 180)}
          stroke="#9FE870"
          strokeWidth="4.5"
          strokeLinecap="round"
          opacity={i % 2 === 0 ? 1 : 0.7}
        />
      ))}
    </svg>
  );
}

function HeroSection() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-6 pt-24 pb-16 overflow-hidden bg-[#EBEBE6]">
      {/* Background — subtle dot grid on sage canvas */}
      <div className="absolute inset-0 -z-10">
        <svg className="absolute inset-0 w-full h-full opacity-[0.05]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="dots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1.5" fill="#1F1F1F" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dots)" />
        </svg>
      </div>

      <div className="absolute top-24 left-6">
        <WelcomeBadge />
      </div>

      {/* Floating decorative elements — paypers.ai style */}

      {/* doc stack 1 — top right */}
      <motion.img
        src={docStack1}
        alt=""
        className="absolute top-28 right-6 w-32 opacity-45 pointer-events-none select-none"
        style={{ mixBlendMode: "multiply" }}
        animate={{ y: [0, -8, 0], rotate: [0, 3, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* doc stack 2 — bottom left */}
      <motion.img
        src={docStack2}
        alt=""
        className="absolute bottom-20 left-6 w-32 opacity-40 pointer-events-none select-none"
        style={{ mixBlendMode: "multiply" }}
        animate={{ y: [0, 8, 0], rotate: [0, -3, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
      />

      {/* pink star — bottom right */}
      <motion.div
        className="absolute bottom-28 right-10 w-12 h-12 pointer-events-none"
        animate={{ y: [0, -6, 0], rotate: [0, 8, 0] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
      >
        <SketchyStar />
      </motion.div>

      {/* blue asterisk — top left mid */}
      <motion.div
        className="absolute top-1/2 left-4 w-10 h-10 pointer-events-none opacity-70"
        animate={{ y: [0, 7, 0], rotate: [0, -10, 0] }}
        transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
      >
        <SketchyAsterisk />
      </motion.div>

      {/* small asterisk — top right mid */}
      <motion.div
        className="absolute top-1/3 right-5 w-7 h-7 pointer-events-none opacity-50"
        animate={{ y: [0, -5, 0], rotate: [0, 12, 0] }}
        transition={{ duration: 3.8, repeat: Infinity, ease: "easeInOut", delay: 1.8 }}
      >
        <SketchyAsterisk />
      </motion.div>

      {/* small pink star — left lower */}
      <motion.div
        className="absolute bottom-40 left-12 w-8 h-8 pointer-events-none opacity-60"
        animate={{ y: [0, 6, 0], rotate: [0, -6, 0] }}
        transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut", delay: 2.5 }}
      >
        <SketchyStar />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="max-w-3xl"
      >
        <h1
          className="text-[#1F1F1F] mb-5"
          style={{ fontFamily: "'Outfit', 'Noto Sans Thai', sans-serif", fontWeight: 900, fontSize: "clamp(2.5rem, 7vw, 4.5rem)", lineHeight: 1.02 }}
        >
          เรียนง่ายขึ้น<br />
          <span className="text-[#9FE870]">ด้วยชีทดีๆ</span>
        </h1>
        <p
          className="text-[#6B6B6B] mb-8 max-w-xl mx-auto leading-relaxed"
          style={{ fontFamily: "'Noto Sans Thai', sans-serif", fontSize: 20 }}
        >
          รวบรวมชีทสรุปคุณภาพจากเพื่อนนักศึกษา ค้นหา ดาวน์โหลด และแชร์ความรู้ ให้การเรียนของคุณง่ายกว่าเดิม
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => scrollToSection("features")}
            className="px-7 py-3.5 rounded-[24px] bg-[#9FE870] text-[#1F1F1F] text-base hover:brightness-110 active:scale-95 transition-all duration-200 flex items-center justify-center gap-2"
            style={{ fontFamily: "'Noto Sans Thai', sans-serif", fontWeight: 600 }}
          >
            ดูฟีเจอร์ <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => scrollToSection("howto")}
            className="px-7 py-3.5 rounded-[24px] bg-white text-[#1F1F1F] text-base border border-[#1F1F1F] hover:bg-[#1F1F1F] hover:text-white active:scale-95 transition-all duration-200"
            style={{ fontFamily: "'Noto Sans Thai', sans-serif", fontWeight: 600 }}
          >
            วิธีเพิ่มชีท
          </button>
        </div>
      </motion.div>

    </section>
  );
}

function FeatureCard({ img, title, body, delay }: { img: string; title: string; body: string; delay: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      className="bg-[#EBEBE6] rounded-[24px] p-8 hover:-translate-y-1.5 hover:shadow-[0_20px_40px_-16px_rgba(31,31,31,0.18)] transition-all duration-300 flex flex-col items-center gap-4 text-center"
    >
      <div className="flex items-center justify-center flex-shrink-0" style={{ width: 120, height: 120 }}>
        <img
          src={img}
          alt={title}
          style={{ width: "100%", height: "100%", objectFit: "contain", mixBlendMode: "multiply" }}
        />
      </div>
      <h3 className="text-[#1F1F1F]" style={{ fontFamily: "'Outfit', 'Noto Sans Thai', sans-serif", fontWeight: 800, fontSize: 20 }}>
        {title}
      </h3>
      <p className="text-[#6B6B6B] text-sm leading-relaxed" style={{ fontFamily: "'Noto Sans Thai', sans-serif" }}>
        {body}
      </p>
    </motion.div>
  );
}

function FeaturesSection() {
  return (
    <section id="features" className="py-28 px-6 bg-white">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <span
            className="inline-block mb-5 px-4 py-1.5 rounded-full bg-[#9FE870] text-[#1F1F1F]"
            style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600 }}
          >
            ฟีเจอร์
          </span>
          <h2
            className="text-[#1F1F1F] mb-4"
            style={{ fontFamily: "'Outfit', 'Noto Sans Thai', sans-serif", fontWeight: 900, fontSize: "clamp(2rem, 5vw, 3.25rem)", lineHeight: 1.05 }}
          >
            ทำอะไรได้บ้าง?
          </h2>
          <p className="text-[#6B6B6B]" style={{ fontFamily: "'Noto Sans Thai', sans-serif", fontSize: 18 }}>
            แพลตฟอร์มครบครันสำหรับนักศึกษาที่อยากเรียนได้ดีขึ้น
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {FEATURES.map((f, i) => (
            <FeatureCard key={i} img={f.img} title={f.title} body={f.body} delay={i * 0.12} />
          ))}
        </div>
      </div>
    </section>
  );
}

function DashedArrow({ delay, vertical = false, reverse = false, w }: { delay: number; vertical?: boolean; reverse?: boolean; w?: number }) {
  // Wise-styled connector: ink hairline dashes + green travelling particle.
  // `w` gives the arrow a fixed pixel width (used by the desktop zig-zag layout);
  // without it, the arrow flexes to fill the gap (used by the mobile column).
  const width = w ?? 90;
  const tail = width;      // full drawable length
  const headStart = width - 16;
  return (
    <div
      className={
        vertical
          ? "flex items-center justify-center my-1"
          : w
          ? "flex items-center justify-center shrink-0"
          : "flex items-center justify-center shrink-0 flex-1 min-w-[28px] px-1"
      }
      style={vertical ? { height: 40 } : w ? { width } : undefined}
    >
      <svg
        width={vertical ? "20" : w ? width : "100%"}
        height={vertical ? "40" : "24"}
        viewBox={vertical ? "0 0 20 40" : `0 0 ${width} 24`}
        fill="none"
        preserveAspectRatio="none"
        className="overflow-visible"
      >
        {vertical ? (
          <>
            <motion.line
              x1="10" y1="0" x2="10" y2="30"
              stroke="#1F1F1F" strokeOpacity="0.25" strokeWidth="2" strokeDasharray="3 5" strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              whileInView={{ pathLength: 1, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay }}
            />
            <motion.path d="M4 26 L10 34 L16 26" stroke="#1F1F1F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"
              initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.3, delay: delay + 0.4 }} />
            <motion.circle cx="10" cy="0" r="3" fill="#9FE870"
              animate={{ cy: [0, 30], opacity: [0, 1, 1, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut", delay }} />
          </>
        ) : reverse ? (
          <>
            {/* right-to-left arrow */}
            <motion.line
              x1={tail} y1="12" x2="6" y2="12"
              stroke="#1F1F1F" strokeOpacity="0.25" strokeWidth="2" strokeDasharray="3 5" strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              whileInView={{ pathLength: 1, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay }}
            />
            <motion.path d="M16 6 L6 12 L16 18" stroke="#1F1F1F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"
              initial={{ opacity: 0, x: 4 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.3, delay: delay + 0.4 }} />
            <motion.circle cx={tail} cy="12" r="3" fill="#9FE870"
              animate={{ cx: [tail, 6], opacity: [0, 1, 1, 0] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut", delay }} />
            <motion.circle cx={tail} cy="12" r="1.8" fill="#c5edab"
              animate={{ cx: [tail, 6], opacity: [0, 0.8, 0.8, 0] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut", delay: delay + 0.4 }} />
          </>
        ) : (
          <>
            <motion.line
              x1="0" y1="12" x2={headStart} y2="12"
              stroke="#1F1F1F" strokeOpacity="0.25" strokeWidth="2" strokeDasharray="3 5" strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              whileInView={{ pathLength: 1, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay }}
            />
            <motion.path d={`M${headStart - 6} 6 L${headStart + 4} 12 L${headStart - 6} 18`} stroke="#1F1F1F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"
              initial={{ opacity: 0, x: -4 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.3, delay: delay + 0.4 }} />
            {/* moving particle */}
            <motion.circle cx="0" cy="12" r="3" fill="#9FE870"
              animate={{ cx: [0, headStart], opacity: [0, 1, 1, 0] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut", delay }} />
            <motion.circle cx="0" cy="12" r="1.8" fill="#c5edab"
              animate={{ cx: [0, headStart], opacity: [0, 0.8, 0.8, 0] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut", delay: delay + 0.4 }} />
          </>
        )}
      </svg>
    </div>
  );
}

/* ---- Per-step animated illustrations ---- */

function UploadAnim() {
  return (
    <div className="relative w-16 h-16 flex items-center justify-center">
      <motion.div
        className="absolute w-11 h-14 rounded-md border-2 border-[#1F1F1F] flex items-center justify-center"
        animate={{ y: [4, -6, 4], boxShadow: ["0 2px 6px rgba(159,232,112,0.15)", "0 10px 18px rgba(159,232,112,0.28)", "0 2px 6px rgba(159,232,112,0.15)"] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      >
        <FileUp className="w-5 h-5 text-[#1F1F1F]" />
      </motion.div>
      {/* upward pulse arrow */}
      {[0, 0.6].map((d, i) => (
        <motion.div
          key={i}
          className="absolute bottom-0 w-1.5 h-1.5 rounded-full bg-[#9FE870]"
          animate={{ y: [6, -18], opacity: [0, 1, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut", delay: d }}
        />
      ))}
    </div>
  );
}

function TypingAnim() {
  return (
    <div className="relative w-16 h-16 flex items-center justify-center">
      <div className="w-12 h-14 rounded-md border-2 border-[#1F1F1F] p-2 flex flex-col justify-start gap-1.5 overflow-hidden">
        {[0, 1, 2].map((row) => (
          <motion.div
            key={row}
            className="h-1 rounded-full bg-[#9FE870] origin-left"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: [0, 1, 1, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: row * 0.5, times: [0, 0.3, 0.85, 1] }}
          />
        ))}
      </div>
      {/* blinking cursor */}
      <motion.div
        className="absolute right-3 top-4 w-0.5 h-3 bg-[#1F1F1F]"
        animate={{ opacity: [1, 0, 1] }}
        transition={{ duration: 0.8, repeat: Infinity }}
      />
    </div>
  );
}

function CategorizeAnim() {
  const tags = ["Math", "CS", "IT"];
  return (
    <div className="relative w-16 h-16 flex items-center justify-center">
      <motion.div
        animate={{ rotate: [0, 8, -8, 0], scale: [1, 1.08, 1] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      >
        <Sparkles className="w-7 h-7 text-[#1F1F1F]" />
      </motion.div>
      {tags.map((t, i) => {
        const angle = (i / tags.length) * Math.PI * 2 - Math.PI / 2;
        return (
          <motion.span
            key={t}
            className="absolute px-1.5 py-0.5 rounded-md bg-[#9FE870] text-[#1F1F1F] text-[8px] font-bold whitespace-nowrap"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            initial={{ opacity: 0, scale: 0 }}
            animate={{
              opacity: [0, 1, 1, 0],
              scale: [0, 1, 1, 0.6],
              x: [0, Math.cos(angle) * 26],
              y: [0, Math.sin(angle) * 20],
            }}
            transition={{ duration: 2.6, repeat: Infinity, ease: "easeOut", delay: i * 0.35 }}
          >
            {t}
          </motion.span>
        );
      })}
    </div>
  );
}

function VerifyAnim() {
  return (
    <div className="relative w-16 h-16 flex items-center justify-center overflow-hidden rounded-md">
      <div className="w-12 h-14 rounded-md border-2 border-[#1F1F1F] relative overflow-hidden flex items-center justify-center">
        {/* scanning line */}
        <motion.div
          className="absolute left-0 right-0 h-6 bg-gradient-to-b from-[#9FE870]/0 via-[#9FE870]/40 to-[#9FE870]/0"
          animate={{ y: [-24, 24] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        />
        {/* checkmark pops in */}
        <motion.div
          className="w-6 h-6 rounded-full bg-[#1F1F1F] flex items-center justify-center"
          animate={{ scale: [0, 0, 1, 1, 0], opacity: [0, 0, 1, 1, 0] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: "easeOut", times: [0, 0.4, 0.55, 0.85, 1] }}
        >
          <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
        </motion.div>
      </div>
    </div>
  );
}

function LaunchAnim() {
  return (
    <div className="relative w-16 h-16 flex items-center justify-center">
      <motion.div
        animate={{ x: [-8, 10, -8], y: [8, -10, 8], rotate: [0, 8, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      >
        <Send className="w-7 h-7 text-[#1F1F1F]" />
      </motion.div>
      {/* trailing particles */}
      {[0, 0.5, 1].map((d, i) => (
        <motion.div
          key={i}
          className="absolute bottom-4 left-4 w-1 h-1 rounded-full bg-[#9FE870]"
          animate={{ x: [0, -12], y: [0, 12], opacity: [0.8, 0] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut", delay: d }}
        />
      ))}
    </div>
  );
}

const STEP_ANIMS = [UploadAnim, TypingAnim, CategorizeAnim, VerifyAnim, LaunchAnim];

function WorkflowCard({ step, index }: { step: (typeof STEPS)[number]; index: number }) {
  const Anim = STEP_ANIMS[index];
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, delay: index * 0.12, ease: [0.22, 1, 0.36, 1] }}
      className="w-full lg:w-[220px] shrink-0 rounded-[24px] bg-white px-5 py-7 flex flex-col items-center text-center gap-4 lg:min-h-[300px] transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_20px_40px_-16px_rgba(31,31,31,0.18)]"
    >
      {/* Wise-style step badge — inside the card so every card is one equal-height box */}
      <span
        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1F1F1F] text-white"
        style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600 }}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-[#9FE870]" />
        STEP {step.number}
      </span>
      <div className="w-24 h-24 flex items-center justify-center">
        <Anim />
      </div>
      <p
        className="text-[#1F1F1F] leading-snug"
        style={{ fontFamily: "'Outfit', 'Noto Sans Thai', sans-serif", fontWeight: 800, fontSize: 16 }}
      >
        {step.title}
      </p>
      <p className="text-[#6B6B6B] text-sm leading-relaxed" style={{ fontFamily: "'Noto Sans Thai', sans-serif" }}>
        {step.desc}
      </p>
    </motion.div>
  );
}

function HowToSection() {
  return (
    <section id="howto" className="py-28 px-6 bg-[#EBEBE6]">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-20">
          <span
            className="inline-block mb-5 px-4 py-1.5 rounded-full bg-[#9FE870] text-[#1F1F1F]"
            style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600 }}
          >
            วิธีใช้งาน
          </span>
          <h2
            className="text-[#1F1F1F] mb-4"
            style={{ fontFamily: "'Outfit', 'Noto Sans Thai', sans-serif", fontWeight: 900, fontSize: "clamp(2rem, 5vw, 3.25rem)", lineHeight: 1.05 }}
          >
            เพิ่มชีทสรุปง่ายๆ ใน 5 ขั้นตอน
          </h2>
          <p className="text-[#6B6B6B]" style={{ fontFamily: "'Noto Sans Thai', sans-serif", fontSize: 18 }}>
            อัปโหลดครั้งเดียว แชร์ให้เพื่อนทั้งคณะได้ใช้งาน
          </p>
        </div>

        {/* Desktop: centered zig-zag workflow
            Row 1:  STEP 1 → STEP 2 → STEP 3
                                        ↓
            Row 2:            STEP 5 ← STEP 4                */}
        <div className="hidden lg:block w-[876px] mx-auto">
          {/* Row 1 — steps 1 → 2 → 3 (items-stretch keeps cards equal height; arrows self-center) */}
          <div className="flex items-stretch justify-center">
            <WorkflowCard step={STEPS[0]} index={0} />
            <div className="flex items-center"><DashedArrow delay={0.2} w={108} /></div>
            <WorkflowCard step={STEPS[1]} index={1} />
            <div className="flex items-center"><DashedArrow delay={0.32} w={108} /></div>
            <WorkflowCard step={STEPS[2]} index={2} />
          </div>

          {/* Vertical connector — centered under the right column, between STEP 3 and STEP 4 */}
          <div className="flex justify-end pr-[100px] my-10">
            <DashedArrow delay={0.5} vertical />
          </div>

          {/* Row 2 — STEP 5 ← STEP 4 (right-aligned so STEP 4 sits directly under STEP 3) */}
          <div className="flex items-stretch justify-end">
            <WorkflowCard step={STEPS[4]} index={4} />
            <div className="flex items-center"><DashedArrow delay={0.62} w={108} reverse /></div>
            <WorkflowCard step={STEPS[3]} index={3} />
          </div>
        </div>

        {/* Tablet & mobile: vertical workflow */}
        <div className="lg:hidden flex flex-col items-center max-w-xs mx-auto">
          {STEPS.map((step, i) => (
            <div key={i} className="flex flex-col items-center w-full">
              <WorkflowCard step={step} index={i} />
              {i < STEPS.length - 1 && <DashedArrow delay={0.1} vertical />}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const FOOTER_LINKS = [
  { label: "ฟีเจอร์", section: "features" },
  { label: "เพิ่มชีทสรุป", section: "howto" },
  { label: "วิธีใช้งาน", section: "howto" },
  { label: "คำถามที่พบบ่อย", section: "contact" },
  { label: "ติดต่อเรา", section: "contact" },
];

// Paypers-style light footer — reusable, responsive (desktop row → mobile column)
function FooterSection() {
  return (
    <footer id="contact" className="bg-[#F5F5EF] border-t border-[#DADAD2]">
      <div className="max-w-6xl mx-auto px-6 py-20 md:py-24">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 lg:gap-16">
          {/* Left — brand + description */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 select-none">
              <div className="w-8 h-8 rounded-[12px] bg-[#1F1F1F] flex items-center justify-center">
                <BookOpen className="w-4 h-4 text-[#9FE870]" />
              </div>
              <span className="text-xl text-[#1F1F1F] tracking-tight" style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 900 }}>
                CSIT SHEET
              </span>
            </div>
            <p className="text-[#6B6B6B] leading-relaxed max-w-xs" style={{ fontFamily: "'Noto Sans Thai', sans-serif", fontSize: 15 }}>
              แพลตฟอร์มรวมชีทสรุปคุณภาพจากนักศึกษา เพื่อช่วยให้การเรียนง่ายขึ้น ค้นหา ดาวน์โหลด และแบ่งปันความรู้ภายในคณะ
            </p>
          </div>

          {/* Center — navigation */}
          <div className="flex flex-col gap-4">
            <p className="text-[#1F1F1F]" style={{ fontFamily: "'Outfit', 'Noto Sans Thai', sans-serif", fontWeight: 800, fontSize: 15 }}>
              เมนู
            </p>
            <ul className="flex flex-col gap-3">
              {FOOTER_LINKS.map((item, i) => (
                <li key={i}>
                  <button
                    onClick={() => scrollToSection(item.section)}
                    className="text-[#6B6B6B] hover:text-[#1F1F1F] transition-colors duration-200"
                    style={{ fontFamily: "'Noto Sans Thai', sans-serif", fontSize: 15 }}
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Right — contact + LINE QR */}
          <div className="flex flex-col gap-4">
            <p className="text-[#1F1F1F]" style={{ fontFamily: "'Outfit', 'Noto Sans Thai', sans-serif", fontWeight: 800, fontSize: 15 }}>
              ติดต่อเรา
            </p>
            <a
              href="mailto:hello@csitsheet.app"
              className="inline-flex items-center gap-2.5 text-[#6B6B6B] hover:text-[#1F1F1F] transition-colors duration-200"
              style={{ fontFamily: "'Noto Sans Thai', sans-serif", fontSize: 15 }}
            >
              <span className="w-9 h-9 rounded-[12px] bg-[#9FE870] flex items-center justify-center text-[#1F1F1F] shrink-0">
                <Mail className="w-4 h-4" />
              </span>
              hello@csitsheet.app
            </a>
            <div className="inline-flex items-center gap-2.5 text-[#6B6B6B]" style={{ fontFamily: "'Noto Sans Thai', sans-serif", fontSize: 15 }}>
              <span className="w-9 h-9 rounded-[12px] bg-[#9FE870] flex items-center justify-center text-[#1F1F1F] shrink-0">
                <MessageCircle className="w-4 h-4" />
              </span>
              LINE: @csitsheet
            </div>
            {/* LINE QR */}
            <div className="mt-2 w-[112px] h-[112px] rounded-[16px] bg-white p-2 border border-[#DADAD2]">
              <ImageWithFallback
                src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=0&color=1F1F1F&bgcolor=FFFFFF&data=https%3A%2F%2Fline.me%2FR%2Fti%2Fp%2F%40csitsheet"
                alt="LINE QR Code สำหรับ @csitsheet"
                className="w-full h-full object-contain"
              />
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-16 pt-8 border-t border-[#DADAD2] flex flex-col sm:flex-row items-center justify-between gap-3 text-center">
          <p className="text-[#6B6B6B] text-xs" style={{ fontFamily: "'Noto Sans Thai', sans-serif" }}>
            © 2567 CSIT SHEET — แพลตฟอร์มชีทสรุปสำหรับนักศึกษาไทย
          </p>
        </div>
      </div>
    </footer>
  );
}

function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground" style={{ fontFamily: "'Noto Sans Thai', 'Plus Jakarta Sans', sans-serif" }}>
      <Navbar />
      <HeroSection />
      <FeaturesSection />
      <HowToSection />
      <FooterSection />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* User — role enforced in ProtectedRoute + on backend */}
          <Route path="/dashboard/*" element={
            <ProtectedRoute requiredRole="USER">
              <UserDashboard />
            </ProtectedRoute>
          } />

          {/* Admin — role enforced in ProtectedRoute + on backend */}
          <Route path="/admin/*" element={
            <ProtectedRoute requiredRole="ADMIN">
              <AdminDashboard />
            </ProtectedRoute>
          } />
        </Routes>
      </AuthProvider>
    </BrowserRouterRef, useEffect, useState, useCallback } from "react";
import { BrowserRouter, Routes, Route } from "react-router";
import { motion, useInView, AnimatePresence } from "motion/react";
import { BookOpen, Search, Star, ArrowRight, ChevronRight, Mail, Phone, MessageCircle, Menu, X, Upload, FileText, FolderTree, ShieldCheck, Send, Check, FileUp, Sparkles } from "lucide-react";
import { AuthProvider } from "./components/auth/AuthContext";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import LoginPage from "./components/auth/LoginPage";
import RegisterPage from "./components/auth/RegisterPage";
import UserDashboard from "./components/user/UserDashboard";
import AdminDashboard from "./components/admin/AdminDashboard";
import docStack1 from "@/imports/812382FA-07AA-40BF-A4BD-ED63F3DC6E36.jpeg";
import docStack2 from "@/imports/0A95F81F-E109-4026-86E5-703C3B87CF7D.jpeg";
import iconSearch from "@/imports/A9A138D1-8F83-423C-8666-D40B20AC82A7.jpeg";
import iconPapers from "@/imports/53125DD1-9512-4396-AC03-58CEFBBF319B-1.jpeg";
import iconFolder from "@/imports/53125DD1-9512-4396-AC03-58CEFBBF319B.jpeg";
import { ImageWithFallback } from "./components/figma/ImageWithFallback";

const NAV_ITEMS = [
  { label: "ฟีเจอร์", section: "features" },
  { label: "เพิ่มชีทสรุป", section: "howto" },
  { label: "ติดต่อเรา", section: "contact" },
];

const STEPS = [
  { number: 1, title: "เพิ่มสรุปวิชา", desc: "อัปโหลดไฟล์ชีทสรุปของคุณเข้าสู่ระบบ" },
  { number: 2, title: "กรอกข้อมูลรายละเอียดวิชา", desc: "ระบุชื่อวิชา คณะ และข้อมูลที่เกี่ยวข้อง" },
  { number: 3, title: "ระบบจัดหมวดหมู่", desc: "AI ช่วยจัดหมวดหมู่ชีทให้อัตโนมัติ" },
  { number: 4, title: "รออนุมัติจากแอดมิน", desc: "แอดมินตรวจสอบและรับรองคุณภาพชีท" },
  { number: 5, title: "ส่งขึ้นระบบ", desc: "ชีทของคุณพร้อมให้เพื่อนๆ ดาวน์โหลด!" },
];

const FEATURES = [
  {
    img: iconSearch,
    title: "ค้นหาชีทได้ง่าย",
    body: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ระบบค้นหาอัจฉริยะช่วยให้คุณหาชีทที่ต้องการได้รวดเร็ว ครอบคลุมทุกวิชาและทุกคณะ",
  },
  {
    img: iconPapers,
    title: "ตามเก็บสรุปให้ครบทุกวิชา",
    body: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Ut enim ad minim veniam, quis nostrud exercitation ullamco. ชีททุกใบผ่านการตรวจสอบโดยแอดมิน มั่นใจได้ว่าเนื้อหาถูกต้องและครบถ้วน",
  },
  {
    img: iconFolder,
    title: "หมดปัญหาการหาสรุปและสไลด์",
    body: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Duis aute irure dolor in reprehenderit in voluptate. แชร์ชีทของคุณและรับแต้มสะสมเพื่อแลกรับสิทธิพิเศษมากมาย",
  },
];

function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth" });
}

function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? "bg-white/90 backdrop-blur-md border-b border-[#1F1F1F]/10" : "bg-transparent"
      }`}
    >
      <nav className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2 select-none">
          <div className="w-8 h-8 rounded-[12px] bg-[#1F1F1F] flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-[#9FE870]" />
          </div>
          <span className="text-xl text-[#1F1F1F] tracking-tight" style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 900 }}>
            CSIT SHEET
          </span>
        </div>

        {/* Desktop nav */}
        <ul className="hidden md:flex items-center gap-1">
          {NAV_ITEMS.map((item) => (
            <li key={item.section}>
              <button
                onClick={() => scrollToSection(item.section)}
                className="px-4 py-2 rounded-[24px] text-sm text-[#1F1F1F] hover:bg-[#EBEBE6] transition-all duration-200"
                style={{ fontFamily: "'Noto Sans Thai', sans-serif", fontWeight: 600 }}
              >
                {item.label}
              </button>
            </li>
          ))}
          <li className="ml-2">
            <a
              href="/login"
              className="block px-5 py-2.5 rounded-[24px] bg-[#9FE870] text-[#1F1F1F] text-sm hover:brightness-110 active:scale-95 transition-all duration-200"
              style={{ fontFamily: "'Noto Sans Thai', sans-serif", fontWeight: 600 }}
            >
              เข้าใช้งาน
            </a>
          </li>
        </ul>

        {/* Mobile hamburger */}
        <button className="md:hidden p-2 rounded-[12px] text-[#1F1F1F] hover:bg-[#EBEBE6] transition" onClick={() => setOpen(!open)}>
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </nav>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden bg-white border-t border-[#1F1F1F]/10 px-6 py-4 flex flex-col gap-2">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.section}
              onClick={() => { scrollToSection(item.section); setOpen(false); }}
              className="text-left px-4 py-3 rounded-[16px] text-sm text-[#1F1F1F] hover:bg-[#EBEBE6] transition"
              style={{ fontFamily: "'Noto Sans Thai', sans-serif", fontWeight: 600 }}
            >
              {item.label}
            </button>
          ))}
          <a
            href="/login"
            className="mt-1 block px-5 py-3 rounded-[24px] bg-[#9FE870] text-[#1F1F1F] text-sm hover:brightness-110 transition text-center"
            style={{ fontFamily: "'Noto Sans Thai', sans-serif", fontWeight: 600 }}
          >
            เข้าใช้งาน
          </a>
        </div>
      )}
    </header>
  );
}

const SPIN_WORDS = [
  "NARESUAN UNIVERSITY",
  "SUMMARY SHEET",
  "CSIT STUDENT",
  "COMPUTER SCIENCE",
  "INFORMATION TECHNOLOGY",
];

function WelcomeBadge() {
  const [index, setIndex] = useState(0);
  const [displayed, setDisplayed] = useState("");
  const [showCursor, setShowCursor] = useState(true);

  useEffect(() => {
    const word = SPIN_WORDS[index];
    const charDelay = 2000 / word.length; // finish typing in ~2.0s
    let charIndex = 0;
    setDisplayed("");

    const typeInterval = setInterval(() => {
      charIndex++;
      setDisplayed(word.slice(0, charIndex));
      if (charIndex >= word.length) {
        clearInterval(typeInterval);
        // hold for 2s then move to next word
        setTimeout(() => {
          setIndex((i) => (i + 1) % SPIN_WORDS.length);
        }, 2000);
      }
    }, charDelay);

    return () => clearInterval(typeInterval);
  }, [index]);

  // blinking cursor
  useEffect(() => {
    const blink = setInterval(() => setShowCursor((c) => !c), 500);
    return () => clearInterval(blink);
  }, []);

  return (
    <div className="flex items-center">
      <span
        className="text-[#1F1F1F] shrink-0"
        style={{ fontFamily: "'Press Start 2P', monospace", whiteSpace: "nowrap", fontSize: "9px" }}
      >
        WELCOME TO&nbsp;
      </span>
      <span
        className="shrink-0"
        style={{
          fontFamily: "'Press Start 2P', monospace",
          color: "#4f8a2e",
          width: "180px",
          display: "inline-block",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textAlign: "left",
          fontSize: "9px",
        }}
      >
        {displayed}
        <span style={{ opacity: showCursor ? 1 : 0 }}>|</span>
      </span>
    </div>
  );
}

function SketchyFolder() {
  return (
    <svg viewBox="0 0 110 90" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      {/* folder back */}
      <path d="M8 28 Q7 22 13 21 L38 21 Q42 21 44 25 L48 30 L98 30 Q104 30 104 36 L104 78 Q104 84 98 84 L13 84 Q7 84 7 78 Z"
        fill="#fef9ee" stroke="#1a1a1a" strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round"/>
      {/* folder tab */}
      <path d="M13 21 L38 21 Q41 21 43 24 L47 29 L13 29 Z"
        fill="#fde68a" stroke="#1a1a1a" strokeWidth="3" strokeLinejoin="round"/>
      {/* hatching inside */}
      <path d="M18 40 L30 52 M24 38 L40 54 M32 37 L50 55 M42 37 L60 55 M52 38 L68 54 M62 39 L76 53 M72 40 L84 52"
        stroke="#ccc" strokeWidth="1" strokeLinecap="round" opacity="0.6"/>
      {/* crumpled paper inside */}
      <path d="M20 55 Q28 48 38 52 Q46 45 56 50 Q64 44 74 49 Q80 55 76 64 Q68 70 58 66 Q48 72 38 67 Q26 70 20 62 Z"
        fill="white" stroke="#555" strokeWidth="2" strokeLinejoin="round"/>
      <path d="M28 55 Q35 51 42 54 M50 50 Q58 47 65 51 M36 62 Q44 65 52 62 Q60 65 68 62"
        stroke="#999" strokeWidth="1" strokeLinecap="round" opacity="0.7"/>
      {/* paperclip */}
      <path d="M88 58 Q100 52 102 62 Q104 72 94 76 Q84 80 80 70 Q76 58 88 52 Q96 48 100 56"
        stroke="#1a1a1a" strokeWidth="3.5" strokeLinecap="round" fill="none"/>
    </svg>
  );
}

function SketchyDocument() {
  return (
    <svg viewBox="0 0 70 90" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      {/* page with folded corner */}
      <path d="M8 6 L50 6 L62 18 L62 84 Q62 88 58 88 L12 88 Q8 88 8 84 Z"
        fill="#fff" stroke="#1a1a1a" strokeWidth="3" strokeLinejoin="round"/>
      {/* folded corner */}
      <path d="M50 6 L50 18 L62 18" stroke="#1a1a1a" strokeWidth="3" strokeLinejoin="round" fill="#f0f0f0"/>
      {/* lines */}
      <path d="M16 30 L54 30" stroke="#ccc" strokeWidth="2" strokeLinecap="round"/>
      <path d="M16 40 L54 40" stroke="#ccc" strokeWidth="2" strokeLinecap="round"/>
      <path d="M16 50 L46 50" stroke="#ccc" strokeWidth="2" strokeLinecap="round"/>
      <path d="M16 60 L54 60" stroke="#ccc" strokeWidth="2" strokeLinecap="round"/>
      <path d="M16 70 L40 70" stroke="#ccc" strokeWidth="2" strokeLinecap="round"/>
      {/* sketchy strokes */}
      <path d="M10 10 Q9 50 10 85" stroke="#e0e0e0" strokeWidth="1" strokeLinecap="round" opacity="0.5"/>
    </svg>
  );
}

function SketchyCrumpledPaper() {
  return (
    <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      {/* crumpled ball outline */}
      <path d="M40 8 Q58 6 68 18 Q78 30 74 46 Q70 62 56 70 Q42 78 26 72 Q10 66 6 50 Q2 34 14 20 Q24 8 40 8 Z"
        fill="white" stroke="#1a1a1a" strokeWidth="3" strokeLinejoin="round"/>
      {/* crumple lines */}
      <path d="M20 20 Q30 28 26 40" stroke="#555" strokeWidth="2" strokeLinecap="round"/>
      <path d="M40 10 Q44 22 38 30 Q32 38 36 50" stroke="#555" strokeWidth="2" strokeLinecap="round"/>
      <path d="M60 22 Q54 32 58 44" stroke="#555" strokeWidth="2" strokeLinecap="round"/>
      <path d="M18 48 Q28 44 36 50 Q46 56 56 50" stroke="#555" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M24 30 Q36 34 44 28 Q54 24 62 32" stroke="#888" strokeWidth="1.2" strokeLinecap="round"/>
      <path d="M14 36 Q22 40 28 36" stroke="#888" strokeWidth="1.2" strokeLinecap="round"/>
      <path d="M50 58 Q58 54 66 58" stroke="#888" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  );
}

function SketchyStar() {
  return (
    <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <path d="M60 10 L68 45 L100 30 L78 55 L108 68 L72 65 L75 100 L58 72 L38 102 L45 67 L12 72 L42 54 L20 28 L52 44 Z"
        fill="#c5edab" stroke="#9FE870" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"
        style={{ filter: "url(#sketch)" }} />
      {/* Sketchy cross-hatch fill lines */}
      <path d="M35 45 Q55 50 75 48 M32 52 Q52 56 78 53 M30 59 Q53 62 80 59 M33 66 Q54 68 77 65 M38 73 Q56 74 74 71" stroke="#9FE870" strokeWidth="1" strokeLinecap="round" opacity="0.5"/>
      <path d="M45 35 Q50 55 48 75 M52 32 Q56 52 54 78 M59 30 Q62 51 61 80 M66 33 Q68 53 67 77 M73 38 Q74 56 72 74" stroke="#9FE870" strokeWidth="1" strokeLinecap="round" opacity="0.5"/>
      <defs>
        <filter id="sketch" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="4" seed="3" result="noise"/>
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="2" xChannelSelector="R" yChannelSelector="G"/>
        </filter>
      </defs>
    </svg>
  );
}

function SketchyAsterisk() {
  return (
    <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      {[0,30,60,90,120,150,180,210,240,270,300,330].map((deg, i) => (
        <line
          key={i}
          x1="40" y1="40"
          x2={40 + 28 * Math.cos((deg * Math.PI) / 180)}
          y2={40 + 28 * Math.sin((deg * Math.PI) / 180)}
          stroke="#9FE870"
          strokeWidth="4.5"
          strokeLinecap="round"
          opacity={i % 2 === 0 ? 1 : 0.7}
        />
      ))}
    </svg>
  );
}

function HeroSection() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-6 pt-24 pb-16 overflow-hidden bg-[#EBEBE6]">
      {/* Background — subtle dot grid on sage canvas */}
      <div className="absolute inset-0 -z-10">
        <svg className="absolute inset-0 w-full h-full opacity-[0.05]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="dots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1.5" fill="#1F1F1F" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dots)" />
        </svg>
      </div>

      <div className="absolute top-24 left-6">
        <WelcomeBadge />
      </div>

      {/* Floating decorative elements — paypers.ai style */}

      {/* doc stack 1 — top right */}
      <motion.img
        src={docStack1}
        alt=""
        className="absolute top-28 right-6 w-32 opacity-45 pointer-events-none select-none"
        style={{ mixBlendMode: "multiply" }}
        animate={{ y: [0, -8, 0], rotate: [0, 3, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* doc stack 2 — bottom left */}
      <motion.img
        src={docStack2}
        alt=""
        className="absolute bottom-20 left-6 w-32 opacity-40 pointer-events-none select-none"
        style={{ mixBlendMode: "multiply" }}
        animate={{ y: [0, 8, 0], rotate: [0, -3, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
      />

      {/* pink star — bottom right */}
      <motion.div
        className="absolute bottom-28 right-10 w-12 h-12 pointer-events-none"
        animate={{ y: [0, -6, 0], rotate: [0, 8, 0] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
      >
        <SketchyStar />
      </motion.div>

      {/* blue asterisk — top left mid */}
      <motion.div
        className="absolute top-1/2 left-4 w-10 h-10 pointer-events-none opacity-70"
        animate={{ y: [0, 7, 0], rotate: [0, -10, 0] }}
        transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
      >
        <SketchyAsterisk />
      </motion.div>

      {/* small asterisk — top right mid */}
      <motion.div
        className="absolute top-1/3 right-5 w-7 h-7 pointer-events-none opacity-50"
        animate={{ y: [0, -5, 0], rotate: [0, 12, 0] }}
        transition={{ duration: 3.8, repeat: Infinity, ease: "easeInOut", delay: 1.8 }}
      >
        <SketchyAsterisk />
      </motion.div>

      {/* small pink star — left lower */}
      <motion.div
        className="absolute bottom-40 left-12 w-8 h-8 pointer-events-none opacity-60"
        animate={{ y: [0, 6, 0], rotate: [0, -6, 0] }}
        transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut", delay: 2.5 }}
      >
        <SketchyStar />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="max-w-3xl"
      >
        <h1
          className="text-[#1F1F1F] mb-5"
          style={{ fontFamily: "'Outfit', 'Noto Sans Thai', sans-serif", fontWeight: 900, fontSize: "clamp(2.5rem, 7vw, 4.5rem)", lineHeight: 1.02 }}
        >
          เรียนง่ายขึ้น<br />
          <span className="text-[#9FE870]">ด้วยชีทดีๆ</span>
        </h1>
        <p
          className="text-[#6B6B6B] mb-8 max-w-xl mx-auto leading-relaxed"
          style={{ fontFamily: "'Noto Sans Thai', sans-serif", fontSize: 20 }}
        >
          รวบรวมชีทสรุปคุณภาพจากเพื่อนนักศึกษา ค้นหา ดาวน์โหลด และแชร์ความรู้ ให้การเรียนของคุณง่ายกว่าเดิม
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => scrollToSection("features")}
            className="px-7 py-3.5 rounded-[24px] bg-[#9FE870] text-[#1F1F1F] text-base hover:brightness-110 active:scale-95 transition-all duration-200 flex items-center justify-center gap-2"
            style={{ fontFamily: "'Noto Sans Thai', sans-serif", fontWeight: 600 }}
          >
            ดูฟีเจอร์ <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => scrollToSection("howto")}
            className="px-7 py-3.5 rounded-[24px] bg-white text-[#1F1F1F] text-base border border-[#1F1F1F] hover:bg-[#1F1F1F] hover:text-white active:scale-95 transition-all duration-200"
            style={{ fontFamily: "'Noto Sans Thai', sans-serif", fontWeight: 600 }}
          >
            วิธีเพิ่มชีท
          </button>
        </div>
      </motion.div>

    </section>
  );
}

function FeatureCard({ img, title, body, delay }: { img: string; title: string; body: string; delay: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      className="bg-[#EBEBE6] rounded-[24px] p-8 hover:-translate-y-1.5 hover:shadow-[0_20px_40px_-16px_rgba(31,31,31,0.18)] transition-all duration-300 flex flex-col items-center gap-4 text-center"
    >
      <div className="flex items-center justify-center flex-shrink-0" style={{ width: 120, height: 120 }}>
        <img
          src={img}
          alt={title}
          style={{ width: "100%", height: "100%", objectFit: "contain", mixBlendMode: "multiply" }}
        />
      </div>
      <h3 className="text-[#1F1F1F]" style={{ fontFamily: "'Outfit', 'Noto Sans Thai', sans-serif", fontWeight: 800, fontSize: 20 }}>
        {title}
      </h3>
      <p className="text-[#6B6B6B] text-sm leading-relaxed" style={{ fontFamily: "'Noto Sans Thai', sans-serif" }}>
        {body}
      </p>
    </motion.div>
  );
}

function FeaturesSection() {
  return (
    <section id="features" className="py-28 px-6 bg-white">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <span
            className="inline-block mb-5 px-4 py-1.5 rounded-full bg-[#9FE870] text-[#1F1F1F]"
            style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600 }}
          >
            ฟีเจอร์
          </span>
          <h2
            className="text-[#1F1F1F] mb-4"
            style={{ fontFamily: "'Outfit', 'Noto Sans Thai', sans-serif", fontWeight: 900, fontSize: "clamp(2rem, 5vw, 3.25rem)", lineHeight: 1.05 }}
          >
            ทำอะไรได้บ้าง?
          </h2>
          <p className="text-[#6B6B6B]" style={{ fontFamily: "'Noto Sans Thai', sans-serif", fontSize: 18 }}>
            แพลตฟอร์มครบครันสำหรับนักศึกษาที่อยากเรียนได้ดีขึ้น
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {FEATURES.map((f, i) => (
            <FeatureCard key={i} img={f.img} title={f.title} body={f.body} delay={i * 0.12} />
          ))}
        </div>
      </div>
    </section>
  );
}

function DashedArrow({ delay, vertical = false, reverse = false, w }: { delay: number; vertical?: boolean; reverse?: boolean; w?: number }) {
  // Wise-styled connector: ink hairline dashes + green travelling particle.
  // `w` gives the arrow a fixed pixel width (used by the desktop zig-zag layout);
  // without it, the arrow flexes to fill the gap (used by the mobile column).
  const width = w ?? 90;
  const tail = width;      // full drawable length
  const headStart = width - 16;
  return (
    <div
      className={
        vertical
          ? "flex items-center justify-center my-1"
          : w
          ? "flex items-center justify-center shrink-0"
          : "flex items-center justify-center shrink-0 flex-1 min-w-[28px] px-1"
      }
      style={vertical ? { height: 40 } : w ? { width } : undefined}
    >
      <svg
        width={vertical ? "20" : w ? width : "100%"}
        height={vertical ? "40" : "24"}
        viewBox={vertical ? "0 0 20 40" : `0 0 ${width} 24`}
        fill="none"
        preserveAspectRatio="none"
        className="overflow-visible"
      >
        {vertical ? (
          <>
            <motion.line
              x1="10" y1="0" x2="10" y2="30"
              stroke="#1F1F1F" strokeOpacity="0.25" strokeWidth="2" strokeDasharray="3 5" strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              whileInView={{ pathLength: 1, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay }}
            />
            <motion.path d="M4 26 L10 34 L16 26" stroke="#1F1F1F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"
              initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.3, delay: delay + 0.4 }} />
            <motion.circle cx="10" cy="0" r="3" fill="#9FE870"
              animate={{ cy: [0, 30], opacity: [0, 1, 1, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut", delay }} />
          </>
        ) : reverse ? (
          <>
            {/* right-to-left arrow */}
            <motion.line
              x1={tail} y1="12" x2="6" y2="12"
              stroke="#1F1F1F" strokeOpacity="0.25" strokeWidth="2" strokeDasharray="3 5" strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              whileInView={{ pathLength: 1, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay }}
            />
            <motion.path d="M16 6 L6 12 L16 18" stroke="#1F1F1F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"
              initial={{ opacity: 0, x: 4 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.3, delay: delay + 0.4 }} />
            <motion.circle cx={tail} cy="12" r="3" fill="#9FE870"
              animate={{ cx: [tail, 6], opacity: [0, 1, 1, 0] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut", delay }} />
            <motion.circle cx={tail} cy="12" r="1.8" fill="#c5edab"
              animate={{ cx: [tail, 6], opacity: [0, 0.8, 0.8, 0] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut", delay: delay + 0.4 }} />
          </>
        ) : (
          <>
            <motion.line
              x1="0" y1="12" x2={headStart} y2="12"
              stroke="#1F1F1F" strokeOpacity="0.25" strokeWidth="2" strokeDasharray="3 5" strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              whileInView={{ pathLength: 1, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay }}
            />
            <motion.path d={`M${headStart - 6} 6 L${headStart + 4} 12 L${headStart - 6} 18`} stroke="#1F1F1F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"
              initial={{ opacity: 0, x: -4 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.3, delay: delay + 0.4 }} />
            {/* moving particle */}
            <motion.circle cx="0" cy="12" r="3" fill="#9FE870"
              animate={{ cx: [0, headStart], opacity: [0, 1, 1, 0] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut", delay }} />
            <motion.circle cx="0" cy="12" r="1.8" fill="#c5edab"
              animate={{ cx: [0, headStart], opacity: [0, 0.8, 0.8, 0] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut", delay: delay + 0.4 }} />
          </>
        )}
      </svg>
    </div>
  );
}

/* ---- Per-step animated illustrations ---- */

function UploadAnim() {
  return (
    <div className="relative w-16 h-16 flex items-center justify-center">
      <motion.div
        className="absolute w-11 h-14 rounded-md border-2 border-[#1F1F1F] flex items-center justify-center"
        animate={{ y: [4, -6, 4], boxShadow: ["0 2px 6px rgba(159,232,112,0.15)", "0 10px 18px rgba(159,232,112,0.28)", "0 2px 6px rgba(159,232,112,0.15)"] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      >
        <FileUp className="w-5 h-5 text-[#1F1F1F]" />
      </motion.div>
      {/* upward pulse arrow */}
      {[0, 0.6].map((d, i) => (
        <motion.div
          key={i}
          className="absolute bottom-0 w-1.5 h-1.5 rounded-full bg-[#9FE870]"
          animate={{ y: [6, -18], opacity: [0, 1, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut", delay: d }}
        />
      ))}
    </div>
  );
}

function TypingAnim() {
  return (
    <div className="relative w-16 h-16 flex items-center justify-center">
      <div className="w-12 h-14 rounded-md border-2 border-[#1F1F1F] p-2 flex flex-col justify-start gap-1.5 overflow-hidden">
        {[0, 1, 2].map((row) => (
          <motion.div
            key={row}
            className="h-1 rounded-full bg-[#9FE870] origin-left"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: [0, 1, 1, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: row * 0.5, times: [0, 0.3, 0.85, 1] }}
          />
        ))}
      </div>
      {/* blinking cursor */}
      <motion.div
        className="absolute right-3 top-4 w-0.5 h-3 bg-[#1F1F1F]"
        animate={{ opacity: [1, 0, 1] }}
        transition={{ duration: 0.8, repeat: Infinity }}
      />
    </div>
  );
}

function CategorizeAnim() {
  const tags = ["Math", "CS", "IT"];
  return (
    <div className="relative w-16 h-16 flex items-center justify-center">
      <motion.div
        animate={{ rotate: [0, 8, -8, 0], scale: [1, 1.08, 1] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      >
        <Sparkles className="w-7 h-7 text-[#1F1F1F]" />
      </motion.div>
      {tags.map((t, i) => {
        const angle = (i / tags.length) * Math.PI * 2 - Math.PI / 2;
        return (
          <motion.span
            key={t}
            className="absolute px-1.5 py-0.5 rounded-md bg-[#9FE870] text-[#1F1F1F] text-[8px] font-bold whitespace-nowrap"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            initial={{ opacity: 0, scale: 0 }}
            animate={{
              opacity: [0, 1, 1, 0],
              scale: [0, 1, 1, 0.6],
              x: [0, Math.cos(angle) * 26],
              y: [0, Math.sin(angle) * 20],
            }}
            transition={{ duration: 2.6, repeat: Infinity, ease: "easeOut", delay: i * 0.35 }}
          >
            {t}
          </motion.span>
        );
      })}
    </div>
  );
}

function VerifyAnim() {
  return (
    <div className="relative w-16 h-16 flex items-center justify-center overflow-hidden rounded-md">
      <div className="w-12 h-14 rounded-md border-2 border-[#1F1F1F] relative overflow-hidden flex items-center justify-center">
        {/* scanning line */}
        <motion.div
          className="absolute left-0 right-0 h-6 bg-gradient-to-b from-[#9FE870]/0 via-[#9FE870]/40 to-[#9FE870]/0"
          animate={{ y: [-24, 24] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        />
        {/* checkmark pops in */}
        <motion.div
          className="w-6 h-6 rounded-full bg-[#1F1F1F] flex items-center justify-center"
          animate={{ scale: [0, 0, 1, 1, 0], opacity: [0, 0, 1, 1, 0] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: "easeOut", times: [0, 0.4, 0.55, 0.85, 1] }}
        >
          <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
        </motion.div>
      </div>
    </div>
  );
}

function LaunchAnim() {
  return (
    <div className="relative w-16 h-16 flex items-center justify-center">
      <motion.div
        animate={{ x: [-8, 10, -8], y: [8, -10, 8], rotate: [0, 8, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      >
        <Send className="w-7 h-7 text-[#1F1F1F]" />
      </motion.div>
      {/* trailing particles */}
      {[0, 0.5, 1].map((d, i) => (
        <motion.div
          key={i}
          className="absolute bottom-4 left-4 w-1 h-1 rounded-full bg-[#9FE870]"
          animate={{ x: [0, -12], y: [0, 12], opacity: [0.8, 0] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut", delay: d }}
        />
      ))}
    </div>
  );
}

const STEP_ANIMS = [UploadAnim, TypingAnim, CategorizeAnim, VerifyAnim, LaunchAnim];

function WorkflowCard({ step, index }: { step: (typeof STEPS)[number]; index: number }) {
  const Anim = STEP_ANIMS[index];
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, delay: index * 0.12, ease: [0.22, 1, 0.36, 1] }}
      className="w-full lg:w-[220px] shrink-0 rounded-[24px] bg-white px-5 py-7 flex flex-col items-center text-center gap-4 lg:min-h-[300px] transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_20px_40px_-16px_rgba(31,31,31,0.18)]"
    >
      {/* Wise-style step badge — inside the card so every card is one equal-height box */}
      <span
        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1F1F1F] text-white"
        style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600 }}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-[#9FE870]" />
        STEP {step.number}
      </span>
      <div className="w-24 h-24 flex items-center justify-center">
        <Anim />
      </div>
      <p
        className="text-[#1F1F1F] leading-snug"
        style={{ fontFamily: "'Outfit', 'Noto Sans Thai', sans-serif", fontWeight: 800, fontSize: 16 }}
      >
        {step.title}
      </p>
      <p className="text-[#6B6B6B] text-sm leading-relaxed" style={{ fontFamily: "'Noto Sans Thai', sans-serif" }}>
        {step.desc}
      </p>
    </motion.div>
  );
}

function HowToSection() {
  return (
    <section id="howto" className="py-28 px-6 bg-[#EBEBE6]">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-20">
          <span
            className="inline-block mb-5 px-4 py-1.5 rounded-full bg-[#9FE870] text-[#1F1F1F]"
            style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600 }}
          >
            วิธีใช้งาน
          </span>
          <h2
            className="text-[#1F1F1F] mb-4"
            style={{ fontFamily: "'Outfit', 'Noto Sans Thai', sans-serif", fontWeight: 900, fontSize: "clamp(2rem, 5vw, 3.25rem)", lineHeight: 1.05 }}
          >
            เพิ่มชีทสรุปง่ายๆ ใน 5 ขั้นตอน
          </h2>
          <p className="text-[#6B6B6B]" style={{ fontFamily: "'Noto Sans Thai', sans-serif", fontSize: 18 }}>
            อัปโหลดครั้งเดียว แชร์ให้เพื่อนทั้งคณะได้ใช้งาน
          </p>
        </div>

        {/* Desktop: centered zig-zag workflow
            Row 1:  STEP 1 → STEP 2 → STEP 3
                                        ↓
            Row 2:            STEP 5 ← STEP 4                */}
        <div className="hidden lg:block w-[876px] mx-auto">
          {/* Row 1 — steps 1 → 2 → 3 (items-stretch keeps cards equal height; arrows self-center) */}
          <div className="flex items-stretch justify-center">
            <WorkflowCard step={STEPS[0]} index={0} />
            <div className="flex items-center"><DashedArrow delay={0.2} w={108} /></div>
            <WorkflowCard step={STEPS[1]} index={1} />
            <div className="flex items-center"><DashedArrow delay={0.32} w={108} /></div>
            <WorkflowCard step={STEPS[2]} index={2} />
          </div>

          {/* Vertical connector — centered under the right column, between STEP 3 and STEP 4 */}
          <div className="flex justify-end pr-[100px] my-10">
            <DashedArrow delay={0.5} vertical />
          </div>

          {/* Row 2 — STEP 5 ← STEP 4 (right-aligned so STEP 4 sits directly under STEP 3) */}
          <div className="flex items-stretch justify-end">
            <WorkflowCard step={STEPS[4]} index={4} />
            <div className="flex items-center"><DashedArrow delay={0.62} w={108} reverse /></div>
            <WorkflowCard step={STEPS[3]} index={3} />
          </div>
        </div>

        {/* Tablet & mobile: vertical workflow */}
        <div className="lg:hidden flex flex-col items-center max-w-xs mx-auto">
          {STEPS.map((step, i) => (
            <div key={i} className="flex flex-col items-center w-full">
              <WorkflowCard step={step} index={i} />
              {i < STEPS.length - 1 && <DashedArrow delay={0.1} vertical />}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const FOOTER_LINKS = [
  { label: "ฟีเจอร์", section: "features" },
  { label: "เพิ่มชีทสรุป", section: "howto" },
  { label: "วิธีใช้งาน", section: "howto" },
  { label: "คำถามที่พบบ่อย", section: "contact" },
  { label: "ติดต่อเรา", section: "contact" },
];

// Paypers-style light footer — reusable, responsive (desktop row → mobile column)
function FooterSection() {
  return (
    <footer id="contact" className="bg-[#F5F5EF] border-t border-[#DADAD2]">
      <div className="max-w-6xl mx-auto px-6 py-20 md:py-24">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 lg:gap-16">
          {/* Left — brand + description */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 select-none">
              <div className="w-8 h-8 rounded-[12px] bg-[#1F1F1F] flex items-center justify-center">
                <BookOpen className="w-4 h-4 text-[#9FE870]" />
              </div>
              <span className="text-xl text-[#1F1F1F] tracking-tight" style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 900 }}>
                CSIT SHEET
              </span>
            </div>
            <p className="text-[#6B6B6B] leading-relaxed max-w-xs" style={{ fontFamily: "'Noto Sans Thai', sans-serif", fontSize: 15 }}>
              แพลตฟอร์มรวมชีทสรุปคุณภาพจากนักศึกษา เพื่อช่วยให้การเรียนง่ายขึ้น ค้นหา ดาวน์โหลด และแบ่งปันความรู้ภายในคณะ
            </p>
          </div>

          {/* Center — navigation */}
          <div className="flex flex-col gap-4">
            <p className="text-[#1F1F1F]" style={{ fontFamily: "'Outfit', 'Noto Sans Thai', sans-serif", fontWeight: 800, fontSize: 15 }}>
              เมนู
            </p>
            <ul className="flex flex-col gap-3">
              {FOOTER_LINKS.map((item, i) => (
                <li key={i}>
                  <button
                    onClick={() => scrollToSection(item.section)}
                    className="text-[#6B6B6B] hover:text-[#1F1F1F] transition-colors duration-200"
                    style={{ fontFamily: "'Noto Sans Thai', sans-serif", fontSize: 15 }}
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Right — contact + LINE QR */}
          <div className="flex flex-col gap-4">
            <p className="text-[#1F1F1F]" style={{ fontFamily: "'Outfit', 'Noto Sans Thai', sans-serif", fontWeight: 800, fontSize: 15 }}>
              ติดต่อเรา
            </p>
            <a
              href="mailto:hello@csitsheet.app"
              className="inline-flex items-center gap-2.5 text-[#6B6B6B] hover:text-[#1F1F1F] transition-colors duration-200"
              style={{ fontFamily: "'Noto Sans Thai', sans-serif", fontSize: 15 }}
            >
              <span className="w-9 h-9 rounded-[12px] bg-[#9FE870] flex items-center justify-center text-[#1F1F1F] shrink-0">
                <Mail className="w-4 h-4" />
              </span>
              hello@csitsheet.app
            </a>
            <div className="inline-flex items-center gap-2.5 text-[#6B6B6B]" style={{ fontFamily: "'Noto Sans Thai', sans-serif", fontSize: 15 }}>
              <span className="w-9 h-9 rounded-[12px] bg-[#9FE870] flex items-center justify-center text-[#1F1F1F] shrink-0">
                <MessageCircle className="w-4 h-4" />
              </span>
              LINE: @csitsheet
            </div>
            {/* LINE QR */}
            <div className="mt-2 w-[112px] h-[112px] rounded-[16px] bg-white p-2 border border-[#DADAD2]">
              <ImageWithFallback
                src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=0&color=1F1F1F&bgcolor=FFFFFF&data=https%3A%2F%2Fline.me%2FR%2Fti%2Fp%2F%40csitsheet"
                alt="LINE QR Code สำหรับ @csitsheet"
                className="w-full h-full object-contain"
              />
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-16 pt-8 border-t border-[#DADAD2] flex flex-col sm:flex-row items-center justify-between gap-3 text-center">
          <p className="text-[#6B6B6B] text-xs" style={{ fontFamily: "'Noto Sans Thai', sans-serif" }}>
            © 2567 CSIT SHEET — แพลตฟอร์มชีทสรุปสำหรับนักศึกษาไทย
          </p>
        </div>
      </div>
    </footer>
  );
}

function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground" style={{ fontFamily: "'Noto Sans Thai', 'Plus Jakarta Sans', sans-serif" }}>
      <Navbar />
      <HeroSection />
      <FeaturesSection />
      <HowToSection />
      <FooterSection />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* User — role enforced in ProtectedRoute + on backend */}
          <Route path="/dashboard/*" element={
            <ProtectedRoute requiredRole="USER">
              <UserDashboard />
            </ProtectedRoute>
          } />

          {/* Admin — role enforced in ProtectedRoute + on backend */}
          <Route path="/admin/*" element={
            <ProtectedRoute requiredRole="ADMIN">
              <AdminDashboard />
            </ProtectedRoute>
          } />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
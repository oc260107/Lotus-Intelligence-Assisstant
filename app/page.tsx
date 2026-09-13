"use client";

import { FormEvent, useEffect, useState } from "react";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useLanguage } from "@/lib/use-language";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  Mail,
  MessageCircle,
  Phone,
  Plane,
  Send,
  Sparkles,
  UserRound,
} from "lucide-react";

type AuthView = "signin" | "signup";
type IdentifierType = "email" | "phone";

async function authRequest(payload: Record<string, unknown>) {
  const response = await fetch("/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  const data = (await response.json()) as { error?: string };
  if (!response.ok) throw new Error(data.error || "Không thể đăng nhập.");
  return data;
}

export default function EntryPage() {
  const { tr } = useLanguage();
  const [view, setView] = useState<AuthView>("signin");
  const [identifierType, setIdentifierType] = useState<IdentifierType>("email");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [startText, setStartText] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const identifier = identifierType === "email" ? email : phone;

  useEffect(() => {
    const mode = new URLSearchParams(window.location.search).get("auth");
    if (mode === "signup") setView("signup");
    if (mode === "signin") setView("signin");
  }, []);

  function changeView(next: AuthView) {
    setView(next);
    setError("");
  }

  function changeIdentifierType(next: IdentifierType) {
    setIdentifierType(next);
    setError("");
  }

  async function startWithLia(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = startText.trim();
    if (!message) return;
    setError("");
    setLoading(true);
    try {
      sessionStorage.setItem("lia:first-message", message);
      await authRequest({ action: "guest" });
      window.location.assign("/workspace");
    } catch (err) {
      sessionStorage.removeItem("lia:first-message");
      setError(err instanceof Error ? err.message : tr("Could not open LIA.", "Không thể mở LIA."));
      setLoading(false);
    }
  }

  async function enterAsGuest() {
    setError("");
    setLoading(true);
    try {
      await authRequest({ action: "guest" });
      window.location.assign("/workspace");
    } catch (err) {
      setError(err instanceof Error ? err.message : tr("Could not open LIA.", "Không thể mở LIA."));
      setLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (view === "signup") {
      if (!name.trim()) {
        setError(tr("Please enter your full name.", "Vui lòng nhập họ tên."));
        return;
      }

      if (!email.trim() || !phone.trim() || !password.trim()) {
        setError(tr("Please enter your email, phone number and password.", "Vui lòng nhập đầy đủ email, số điện thoại và mật khẩu."));
        return;
      }

      if (!phone.trim().startsWith("+") && !phone.trim().startsWith("00")) {
        setError(tr("Include the country code, for example +84912345678.", "Hãy nhập số điện thoại kèm mã quốc gia, ví dụ +84912345678."));
        return;
      }

      if (password !== confirmPassword) {
        setError(tr("The passwords do not match.", "Mật khẩu xác nhận không khớp."));
        return;
      }

      setLoading(true);
      try {
        await authRequest({
          action: "register",
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          password,
        });
        window.location.assign("/workspace");
      } catch (err) {
        setError(err instanceof Error ? err.message : tr("Could not register.", "Không thể đăng ký."));
        setLoading(false);
      }
      return;
    }

    if (!identifier.trim() || !password.trim()) {
      setError(
        identifierType === "email"
          ? tr("Please enter your email and password.", "Vui lòng nhập email và mật khẩu.")
          : tr("Please enter your phone number and password.", "Vui lòng nhập số điện thoại và mật khẩu."),
      );
      return;
    }

    if (
      identifierType === "phone" &&
      !identifier.trim().startsWith("+") &&
      !identifier.trim().startsWith("00")
    ) {
      setError(tr("Include the country code, for example +84912345678.", "Hãy nhập số điện thoại kèm mã quốc gia, ví dụ +84912345678."));
      return;
    }

    setLoading(true);
    try {
      await authRequest({
        action: "login",
        identifierType,
        identifier: identifier.trim(),
        password,
      });
      window.location.assign("/workspace");
    } catch (err) {
      setError(err instanceof Error ? err.message : tr("Could not sign in.", "Không thể đăng nhập."));
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f4f8f8] text-slate-900">
      <div className="fixed right-4 top-4 z-50"><LanguageSwitcher /></div>
      <div className="grid min-h-screen lg:grid-cols-[1.08fr_0.92fr]">
        <section className="relative hidden overflow-hidden bg-[#005b63] p-12 text-white lg:flex lg:flex-col lg:justify-between">
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 20%, white 0, transparent 32%), radial-gradient(circle at 80% 75%, #d4af37 0, transparent 28%)",
            }}
          />

          <div className="relative z-10 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20">
              <Plane className="h-6 w-6" />
            </div>
            <div>
              <p className="text-lg font-semibold tracking-wide">LIA</p>
              <p className="text-xs text-white/70">Lotus Intelligent Assistant</p>
            </div>
          </div>

          <div className="relative z-10 max-w-xl">
            <p className="mb-4 text-sm font-medium uppercase tracking-[0.22em] text-[#f3cf65]">
              {tr("Your personal travel assistant", "Trợ lý du lịch cá nhân của bạn")}
            </p>
            <h1 className="text-5xl font-semibold leading-[1.08]">
              {tr("A little less searching.", "Tìm kiếm ít hơn.")}
              <br />
              {tr("A lot more going.", "Trải nghiệm nhiều hơn.")}
            </h1>
            <p className="mt-6 max-w-lg text-base leading-7 text-white/75">
              {tr("Plan a trip naturally, keep your travel intent in one place and let LIA help you compare the options that matter to you.", "Lên kế hoạch chuyến đi tự nhiên, lưu nhu cầu du lịch ở một nơi và để LIA giúp bạn so sánh những lựa chọn quan trọng.")}
            </p>
          </div>

          <div className="relative z-10 flex items-center gap-3 text-sm text-white/65">
            <LockKeyhole className="h-4 w-4" />
            <span>{tr("Prototype · OpenAI-powered LIA", "Prototype · LIA dùng OpenAI")}</span>
          </div>
        </section>

        <section className="flex items-center justify-center px-5 py-10 sm:px-8 lg:px-12">
          <div className="w-full max-w-md">
            <div className="mb-9 lg:hidden">
              <div className="mb-5 flex items-center gap-3 text-[#00666d]">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#00666d] text-white">
                  <Plane className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold">LIA</p>
                  <p className="text-xs text-slate-500">Lotus Intelligent Assistant</p>
                </div>
              </div>
            </div>

            <div className="mb-5 rounded-[28px] border border-[#00717a]/20 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.07)] sm:p-6">
              <div className="mb-4 flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#00666d] text-white">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#00717a]">{tr("Chat first · no search form", "Chat trước · không cần form tìm kiếm")}</p>
                  <h2 className="mt-1 text-2xl font-semibold tracking-tight">{tr("Tell LIA what you need.", "Nói với LIA điều bạn cần.")}</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-500">{tr("Start as a guest immediately. LIA will turn your message into a Travel Intent and only ask for missing essentials.", "Bắt đầu ngay với tư cách khách. LIA sẽ biến lời nhắn thành Travel Intent và chỉ hỏi những thông tin thiết yếu còn thiếu.")}</p>
                </div>
              </div>
              <form onSubmit={startWithLia} className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2 focus-within:border-[#008791] focus-within:ring-2 focus-within:ring-[#008791]/10">
                <MessageCircle className="ml-2 h-5 w-5 shrink-0 text-[#00717a]" />
                <input
                  autoFocus
                  value={startText}
                  onChange={(event) => setStartText(event.target.value)}
                  placeholder={tr("e.g. Sydney to Hanoi, 20 Dec–3 Jan, under AUD 1,200, 23 kg baggage…", "ví dụ: Sydney đi Hà Nội, 20/12–03/01, dưới 1.200 AUD, hành lý 23 kg…")}
                  maxLength={2000}
                  className="min-w-0 flex-1 bg-transparent px-2 py-2.5 text-sm outline-none"
                />
                <button type="submit" disabled={loading || !startText.trim()} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#00666d] text-white transition hover:bg-[#00565c] disabled:cursor-not-allowed disabled:opacity-50" aria-label={tr("Start with LIA", "Bắt đầu với LIA")}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </form>
              <p className="mt-3 text-xs leading-5 text-slate-400">{tr("No account required to start. Sign in later to keep trips and preferences across sessions and connect eligible Lotusmiles benefits when VNA integration is available.", "Không cần tài khoản để bắt đầu. Đăng nhập sau nếu muốn lưu chuyến đi và sở thích giữa các phiên, đồng thời kết nối quyền lợi Lotusmiles đủ điều kiện khi tích hợp VNA có sẵn.")}</p>
            </div>

            <div className="mb-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-200" />
              <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">{tr("or sign in to keep your travel space", "hoặc đăng nhập để lưu không gian du lịch")}</span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            <div className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] sm:p-8">
              <div className="mb-7">
                <p className="text-sm font-medium text-[#00717a]">{tr("Welcome to LIA", "Chào mừng đến với LIA")}</p>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight">
                  {view === "signin" ? tr("Sign in to continue", "Đăng nhập để tiếp tục") : tr("Create an account", "Tạo tài khoản")}
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {view === "signin"
                    ? tr("Sign in with your email or phone number to access your travel workspace.", "Đăng nhập bằng email hoặc số điện thoại để vào không gian du lịch của bạn.")
                    : tr("Create an account to keep your Travel Intents, Trip Threads and preferences. Passenger identity details are not required until you choose to continue to booking.", "Tạo tài khoản để lưu Travel Intent, Trip Thread và sở thích. Thông tin định danh hành khách chưa cần cho tới khi bạn chọn tiếp tục đặt vé.")}
                </p>
              </div>

              <div className="mb-5 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => changeView("signin")}
                  className={`rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                    view === "signin" ? "bg-white text-[#00666d] shadow-sm" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {tr("Sign in", "Đăng nhập")}
                </button>
                <button
                  type="button"
                  onClick={() => changeView("signup")}
                  className={`rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                    view === "signup" ? "bg-white text-[#00666d] shadow-sm" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {tr("Register", "Đăng ký")}
                </button>
              </div>

              {view === "signin" && (
              <div className="mb-6">
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-400">
                  {tr("Use", "Sử dụng")}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => changeIdentifierType("email")}
                    className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
                      identifierType === "email"
                        ? "border-[#008791] bg-[#f0fafa] text-[#00666d]"
                        : "border-slate-200 text-slate-500 hover:border-slate-300"
                    }`}
                  >
                    <Mail className="h-4 w-4" /> {tr("Email", "Email")}
                  </button>
                  <button
                    type="button"
                    onClick={() => changeIdentifierType("phone")}
                    className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
                      identifierType === "phone"
                        ? "border-[#008791] bg-[#f0fafa] text-[#00666d]"
                        : "border-slate-200 text-slate-500 hover:border-slate-300"
                    }`}
                  >
                    <Phone className="h-4 w-4" /> {tr("Phone", "Số điện thoại")}
                  </button>
                </div>
              </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {view === "signup" && (
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-slate-700">{tr("Full name", "Họ và tên")}</span>
                    <div className="flex items-center rounded-xl border border-slate-200 bg-white px-3 focus-within:border-[#008791] focus-within:ring-2 focus-within:ring-[#008791]/10">
                      <UserRound className="h-4 w-4 shrink-0 text-slate-400" />
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={tr("Your name", "Họ và tên của bạn")}
                        autoComplete="name"
                        className="w-full bg-transparent px-3 py-3 text-sm outline-none"
                      />
                    </div>
                  </label>
                )}

                {view === "signup" ? (
                  <>
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium text-slate-700">Email</span>
                      <div className="flex items-center rounded-xl border border-slate-200 bg-white px-3 focus-within:border-[#008791] focus-within:ring-2 focus-within:ring-[#008791]/10">
                        <Mail className="h-4 w-4 shrink-0 text-slate-400" />
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="name@example.com"
                          autoComplete="email"
                          className="w-full bg-transparent px-3 py-3 text-sm outline-none"
                        />
                      </div>
                    </label>

                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium text-slate-700">{tr("Phone number", "Số điện thoại")}</span>
                      <div className="flex items-center rounded-xl border border-slate-200 bg-white px-3 focus-within:border-[#008791] focus-within:ring-2 focus-within:ring-[#008791]/10">
                        <Phone className="h-4 w-4 shrink-0 text-slate-400" />
                        <input
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="+84 912 345 678"
                          autoComplete="tel"
                          className="w-full bg-transparent px-3 py-3 text-sm outline-none"
                        />
                      </div>
                      <span className="mt-1.5 block text-xs text-slate-400">
                        {tr("Include country code, for example +84 (Vietnam) or +61 (Australia).", "Bao gồm mã quốc gia, ví dụ +84 (Việt Nam) hoặc +61 (Úc).")}
                      </span>
                    </label>
                  </>
                ) : identifierType === "email" ? (
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-slate-700">Email</span>
                    <div className="flex items-center rounded-xl border border-slate-200 bg-white px-3 focus-within:border-[#008791] focus-within:ring-2 focus-within:ring-[#008791]/10">
                      <Mail className="h-4 w-4 shrink-0 text-slate-400" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@example.com"
                        autoComplete="email"
                        className="w-full bg-transparent px-3 py-3 text-sm outline-none"
                      />
                    </div>
                  </label>
                ) : (
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-slate-700">{tr("Phone number", "Số điện thoại")}</span>
                    <div className="flex items-center rounded-xl border border-slate-200 bg-white px-3 focus-within:border-[#008791] focus-within:ring-2 focus-within:ring-[#008791]/10">
                      <Phone className="h-4 w-4 shrink-0 text-slate-400" />
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+84 912 345 678"
                        autoComplete="tel"
                        className="w-full bg-transparent px-3 py-3 text-sm outline-none"
                      />
                    </div>
                    <span className="mt-1.5 block text-xs text-slate-400">
                      {tr("Include country code, for example +84 (Vietnam) or +61 (Australia).", "Bao gồm mã quốc gia, ví dụ +84 (Việt Nam) hoặc +61 (Úc).")}
                    </span>
                  </label>
                )}

                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-700">{tr("Password", "Mật khẩu")}</span>
                  <div className="flex items-center rounded-xl border border-slate-200 bg-white px-3 focus-within:border-[#008791] focus-within:ring-2 focus-within:ring-[#008791]/10">
                    <LockKeyhole className="h-4 w-4 shrink-0 text-slate-400" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete={view === "signin" ? "current-password" : "new-password"}
                      className="w-full bg-transparent px-3 py-3 text-sm outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="text-slate-400 transition hover:text-slate-700"
                      aria-label={showPassword ? tr("Hide password", "Ẩn mật khẩu") : tr("Show password", "Hiện mật khẩu")}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </label>

                {view === "signup" && (
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-slate-700">{tr("Confirm password", "Xác nhận mật khẩu")}</span>
                    <div className="flex items-center rounded-xl border border-slate-200 bg-white px-3 focus-within:border-[#008791] focus-within:ring-2 focus-within:ring-[#008791]/10">
                      <LockKeyhole className="h-4 w-4 shrink-0 text-slate-400" />
                      <input
                        type={showPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        autoComplete="new-password"
                        className="w-full bg-transparent px-3 py-3 text-sm outline-none"
                      />
                    </div>
                  </label>
                )}

                {error && <div className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</div>}

                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#00666d] px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-[#00565c] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      {view === "signin" ? tr("Sign in", "Đăng nhập") : tr("Create account", "Tạo tài khoản")}
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="my-6 flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-xs font-medium uppercase tracking-wider text-slate-400">{tr("or", "hoặc")}</span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>

              <button
                type="button"
                disabled={loading}
                onClick={enterAsGuest}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-semibold text-slate-700 transition hover:border-[#008791]/40 hover:bg-[#f4fbfb] hover:text-[#00666d] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <UserRound className="h-4 w-4" />
                {tr("Continue as guest", "Tiếp tục với tư cách khách")}
              </button>

              <p className="mt-3 text-center text-xs leading-5 text-slate-500">
                {tr("You can explore as a guest. Sign in or create an account to save trips and preferences for better AI recommendations, and to connect eligible Lotusmiles benefits when VNA member integration is available.", "Bạn có thể khám phá với tư cách khách. Đăng nhập hoặc tạo tài khoản để lưu chuyến đi và sở thích cho gợi ý AI tốt hơn, đồng thời kết nối các quyền lợi Lotusmiles đủ điều kiện khi tích hợp thành viên VNA được bật.")}
              </p>

              <p className="mt-5 text-center text-xs leading-5 text-slate-400">
                {tr("Local prototype account authentication. Production deployment should connect to Vietnam Airlines identity services.", "Xác thực tài khoản dành cho bản mẫu cục bộ. Bản production nên kết nối với hệ thống định danh của Vietnam Airlines.")}
              </p>
            </div>

            <p className="mt-6 text-center text-xs text-slate-400">LIA · Lotus Intelligent Assistant</p>
          </div>
        </section>
      </div>
    </main>
  );
}

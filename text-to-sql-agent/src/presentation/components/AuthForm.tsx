"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { login, register } from "../../data/authApi";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const isLogin = mode === "login";
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!isLogin && password !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }
    setIsSubmitting(true);
    try {
      if (isLogin) await login(email, password);
      else { await register(fullName, email, password); await login(email, password); }
      router.push("/");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Không thể kết nối tới máy chủ.");
    } finally { setIsSubmitting(false); }
  }

  return <main className="auth-page">
    <section className="auth-visual"><div className="auth-brand"><span className="auth-brand-mark">✦</span><span>queryly</span></div><div className="auth-visual-copy"><span className="auth-kicker">TEXT TO SQL WORKSPACE</span><h1>Biến câu hỏi thành<br /><em>insight.</em></h1><p>Truy vấn dữ liệu tự nhiên, nhanh chóng và rõ ràng hơn với Queryly.</p></div><div className="auth-stat"><strong>01</strong><span>Đặt câu hỏi cho dữ liệu<br />bằng ngôn ngữ tự nhiên</span></div></section>
    <section className="auth-panel"><div className="auth-form-wrap"><div className="auth-mobile-brand"><span className="auth-brand-mark">✦</span><span>queryly</span></div><span className="auth-kicker">{isLogin ? "WELCOME BACK" : "GET STARTED"}</span><h2>{isLogin ? "Chào mừng trở lại" : "Tạo tài khoản của bạn"}</h2><p className="auth-subtitle">{isLogin ? "Đăng nhập để tiếp tục tới workspace." : "Bắt đầu khám phá dữ liệu theo cách đơn giản hơn."}</p>
      <form onSubmit={handleSubmit} className="auth-form">
        {!isLogin && <label>Họ và tên<input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Nguyễn Văn A" autoComplete="name" required /></label>}
        <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" autoComplete="email" required /></label>
        <label>Mật khẩu<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder={isLogin ? "Nhập mật khẩu" : "Ít nhất 8 ký tự"} autoComplete={isLogin ? "current-password" : "new-password"} minLength={8} required /></label>
        {!isLogin && <label>Xác nhận mật khẩu<input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Nhập lại mật khẩu" autoComplete="new-password" minLength={8} required /></label>}
        {isLogin && <div className="auth-options"><label className="checkbox-label"><input type="checkbox" /> Ghi nhớ đăng nhập</label><button type="button" className="forgot-link">Quên mật khẩu?</button></div>}
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button className="auth-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? "Đang xử lý..." : isLogin ? "Đăng nhập" : "Tạo tài khoản"}<span>→</span></button>
      </form><p className="auth-switch">{isLogin ? "Chưa có tài khoản?" : "Đã có tài khoản?"} <Link href={isLogin ? "/register" : "/login"}>{isLogin ? "Đăng ký ngay" : "Đăng nhập"}</Link></p><p className="auth-terms">Bằng việc tiếp tục, bạn đồng ý với Điều khoản sử dụng và Chính sách bảo mật của Queryly.</p>
    </div></section>
  </main>;
}

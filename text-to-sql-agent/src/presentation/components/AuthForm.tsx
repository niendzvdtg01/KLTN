"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { login, register } from "../../data/authApi";
import { Icon } from "./Icon";

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
      router.push("/workspace");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Không thể kết nối tới máy chủ.");
    } finally { setIsSubmitting(false); }
  }

  return <main className="auth-page">
    <section className="auth-visual">
      <div className="auth-brand"><span className="brand-mark"><Icon name="sparkle" size={16} /></span><span>queryly</span></div>
      <div className="auth-visual-copy">
        <span className="auth-kicker">AI TEXT-TO-SQL</span>
        <h1>Hỏi dữ liệu bằng tiếng Việt,<br />nhận câu trả lời <em>tức thì.</em></h1>
        <p>Kết nối database, đặt câu hỏi tự nhiên. Agent viết SQL chỉ đọc, chạy truy vấn và trình bày kết quả bằng bảng, biểu đồ và phân tích.</p>
        <ul className="auth-features">
          <li><Icon name="database" size={16} /> MySQL, MariaDB, PostgreSQL, SQL Server, Oracle</li>
          <li><Icon name="shield" size={16} /> Chỉ chạy truy vấn đọc, chặn mọi lệnh ghi</li>
          <li><Icon name="chart" size={16} /> Tự động gợi ý biểu đồ và nhận xét dữ liệu</li>
        </ul>
      </div>
      <div className="auth-preview" aria-hidden="true">
        <div className="preview-q"><Icon name="user" size={13} /> Doanh thu theo tháng năm nay?</div>
        <code>SELECT MONTH(created_at) AS thang, SUM(total) AS doanh_thu FROM orders …</code>
        <div className="preview-bars">{[42, 58, 50, 72, 66, 88].map((height, index) => <span key={index} style={{ height: `${height}%` }} />)}</div>
      </div>
    </section>
    <section className="auth-panel"><div className="auth-form-wrap">
      <div className="auth-mobile-brand"><span className="brand-mark"><Icon name="sparkle" size={16} /></span><span>queryly</span></div>
      <h2>{isLogin ? "Chào mừng trở lại" : "Tạo tài khoản"}</h2>
      <p className="auth-subtitle">{isLogin ? "Đăng nhập để tiếp tục tới workspace của bạn." : "Bắt đầu khám phá dữ liệu theo cách đơn giản hơn."}</p>
      <form onSubmit={handleSubmit} className="auth-form">
        {!isLogin && <label>Họ và tên<input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Nguyễn Văn A" autoComplete="name" required /></label>}
        <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="ban@congty.com" autoComplete="email" required /></label>
        <label>Mật khẩu<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder={isLogin ? "Nhập mật khẩu" : "Ít nhất 8 ký tự"} autoComplete={isLogin ? "current-password" : "new-password"} minLength={8} required /></label>
        {!isLogin && <label>Xác nhận mật khẩu<input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Nhập lại mật khẩu" autoComplete="new-password" minLength={8} required /></label>}
        {error && <p className="auth-error" role="alert"><Icon name="alert" size={15} /> {error}</p>}
        <button className="primary-button large auth-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? <span className="spinner light" /> : null}{isSubmitting ? "Đang xử lý…" : isLogin ? "Đăng nhập" : "Tạo tài khoản"}</button>
      </form>
      <p className="auth-switch">{isLogin ? "Chưa có tài khoản?" : "Đã có tài khoản?"} <Link href={isLogin ? "/register" : "/login"}>{isLogin ? "Đăng ký ngay" : "Đăng nhập"}</Link></p>
    </div></section>
  </main>;
}

"use client";

import { Icon } from "@/src/presentation/components/Icon";

export function DataEvaluation({ evaluation, highlights }: { evaluation?: string | null; highlights?: string[] }) {
  if (!evaluation && !(highlights && highlights.length)) {
    return <div className="evaluation-empty">Chưa có đánh giá dữ liệu cho kết quả này.</div>;
  }
  return (
    <div className="evaluation-card">
      <div className="evaluation-head">
        <span className="evaluation-badge"><Icon name="sparkle" size={14} /></span>
        <strong>Đánh giá dữ liệu</strong>
      </div>
      {evaluation && <p className="evaluation-text">{evaluation}</p>}
      {highlights && highlights.length > 0 && (
        <ul className="evaluation-highlights">
          {highlights.map((item, index) => (
            <li key={index}><span className="highlight-dot" />{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

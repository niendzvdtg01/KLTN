"use client";

import { useState } from "react";
import { Icon } from "@/src/presentation/components/Icon";
import { sendMessageFeedback, type FeedbackRating } from "@/src/data/conversationApi";

export function FeedbackBar({ conversationId, messageId }: { conversationId: number; messageId: number }) {
  const [rating, setRating] = useState<FeedbackRating | null>(null);
  const [showCorrection, setShowCorrection] = useState(false);
  const [correction, setCorrection] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function submit(nextRating: FeedbackRating, note?: string) {
    setBusy(true);
    setError("");
    try {
      await sendMessageFeedback(conversationId, messageId, nextRating, note);
      setRating(nextRating);
      if (nextRating === "UP" || note) {
        setDone(true);
        setShowCorrection(false);
      }
    } catch {
      setError("Không thể gửi phản hồi.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="feedback-bar done">
        <Icon name="sparkle" size={13} />
        {rating === "UP" ? "Cảm ơn! Câu truy vấn này sẽ được dùng làm ví dụ cho lần sau." : "Đã ghi nhận phản hồi của bạn."}
      </div>
    );
  }

  return (
    <div className="feedback-bar">
      <span className="feedback-label">Kết quả này hữu ích?</span>
      <button
        className={rating === "UP" ? "feedback-btn active" : "feedback-btn"}
        onClick={() => submit("UP")}
        disabled={busy}
        aria-label="Hữu ích"
      >
        <Icon name="thumb-up" size={14} />
      </button>
      <button
        className={showCorrection ? "feedback-btn active" : "feedback-btn"}
        onClick={() => { setRating("DOWN"); setShowCorrection(true); }}
        disabled={busy}
        aria-label="Chưa đúng"
      >
        <Icon name="thumb-down" size={14} />
      </button>
      {showCorrection && (
        <div className="feedback-correction">
          <textarea
            value={correction}
            onChange={(event) => setCorrection(event.target.value)}
            placeholder="Mô tả kết quả đúng mà bạn mong đợi (tuỳ chọn)…"
            rows={2}
          />
          <button className="feedback-send" onClick={() => submit("DOWN", correction.trim() || undefined)} disabled={busy}>
            Gửi phản hồi
          </button>
        </div>
      )}
      {error && <span className="feedback-error">{error}</span>}
    </div>
  );
}

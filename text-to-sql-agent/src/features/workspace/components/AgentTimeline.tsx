"use client";

import { useState } from "react";
import { Icon } from "@/src/presentation/components/Icon";
import type { AgentProgress } from "@/src/core/domain/textToSql";

const TOOL_LABELS: Record<string, string> = {
  describe_table: "Xem cấu trúc bảng",
  sample_values: "Xem giá trị mẫu",
  run_sql: "Chạy thử truy vấn",
  final_answer: "Chạy truy vấn cuối",
};

export function AgentTimeline({ progress, isLoading }: { progress: AgentProgress; isLoading: boolean }) {
  const [expanded, setExpanded] = useState(true);
  const { steps, retry, failure } = progress;
  if (!isLoading && !steps.length && !failure) return null;
  const open = expanded || isLoading;

  return (
    <section className="agent-timeline">
      <button className="agent-timeline-head" onClick={() => setExpanded((value) => !value)} disabled={isLoading}>
        <span className={isLoading ? "agent-pulse" : "agent-done"}><Icon name="sparkle" size={14} /></span>
        <strong>{isLoading ? "Agent đang suy luận…" : failure ? "Agent không hoàn thành" : `Agent đã thực hiện ${steps.length} bước`}</strong>
        {!isLoading && <span className={open ? "agent-chevron open" : "agent-chevron"}><Icon name="chevron" size={14} /></span>}
      </button>

      {retry && (
        <div className="agent-alert warn" role="status">
          <Icon name="refresh" size={14} />
          <div>
            <strong>Đang gặp sự cố, đang thử lại ({retry.attempt}/{retry.maxAttempts})</strong>
            <p>{retry.message}</p>
            <small>{retry.action}</small>
          </div>
        </div>
      )}
      {failure && (
        <div className="agent-alert error" role="alert">
          <Icon name="help" size={14} />
          <div>
            <strong>Không thể trả lời câu hỏi</strong>
            <p>{failure}</p>
            <small>Hãy diễn đạt lại câu hỏi hoặc kiểm tra kết nối data source rồi thử lại.</small>
          </div>
        </div>
      )}

      {open && steps.length > 0 && (
        <ol className="agent-steps">
          {steps.map((item) => (
            <li key={item.step} className={`agent-step ${item.status}`}>
              <span className="agent-step-dot" />
              <div>
                <div className="agent-step-title">
                  {TOOL_LABELS[item.tool] ?? item.tool}
                  {item.status === "error" && <span className="agent-step-badge">lỗi → gửi lại agent</span>}
                </div>
                {item.thought && <p className="agent-step-thought">{item.thought}</p>}
                {item.detail && <code className="agent-step-detail">{item.detail}</code>}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

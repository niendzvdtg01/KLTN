"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Icon } from "@/src/presentation/components/Icon";
import type { WorkspaceModel } from "../hooks/useWorkspace";
import type { PropertyRow } from "../constants";
import { EngineBadge } from "./EngineBadge";

/** Engines that call the database part of the URL something else. */
const DATABASE_LABELS: Record<string, { label: string; placeholder: string }> = {
  ORACLE: { label: "Service name", placeholder: "ORCLPDB1" },
};

export function SourceModal({ model }: { model: WorkspaceModel }) {
  const { sourceForm: form, engines, sourceBusy: busy, draftTest, sourceModal } = model;
  const editing = Boolean(sourceModal?.editingId);
  const engine = model.engineOf(form.dbType);
  const [showAdvanced, setShowAdvanced] = useState(editing && (form.properties.length > 0 || form.sslEnabled));
  const databaseField = DATABASE_LABELS[form.dbType] ?? { label: "Database", placeholder: "sales_db" };
  const close = () => model.setSourceModal(null);

  const setSourceModal = model.setSourceModal;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setSourceModal(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setSourceModal]);

  function setProperty(id: number, patch: Partial<PropertyRow>) {
    model.updateSourceForm({ properties: form.properties.map((row) => row.id === id ? { ...row, ...patch } : row) });
  }

  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
    <form className="source-modal" onSubmit={model.submitSource} aria-labelledby="source-modal-title">
      <div className="modal-heading">
        <div><span className="eyebrow">Kết nối</span><h2 id="source-modal-title">{editing ? `Cấu hình “${form.name}”` : "Thêm kết nối database"}</h2></div>
        <button type="button" className="icon-action" onClick={close} aria-label="Đóng"><Icon name="x" size={18} /></button>
      </div>

      <div className="modal-body">
        <Section title="Loại database" hint="Danh sách lấy từ bảng db_engines, có thể bổ sung bằng SQL.">
          <div className="engine-grid" role="radiogroup">
            {engines.map((item) => <button type="button" key={item.code} role="radio" aria-checked={item.code === form.dbType}
              className={item.code === form.dbType ? "engine-option selected" : "engine-option"} onClick={() => model.changeEngine(item.code)}>
              <EngineBadge code={item.code} />
              <span><strong>{item.displayName}</strong><small>Cổng {item.defaultPort}</small></span>
            </button>)}
          </div>
        </Section>

        <Section title="Thông tin kết nối">
          <div className="form-grid">
            <Field label="Tên hiển thị" span={6}><input required maxLength={150} value={form.name} onChange={(event) => model.updateSourceForm({ name: event.target.value })} placeholder="VD: Kho dữ liệu bán hàng" /></Field>
            <Field label="Host" span={4}><input required value={form.host} onChange={(event) => model.updateSourceForm({ host: event.target.value })} placeholder="db.company.com" /></Field>
            <Field label="Cổng" span={2}><input required type="number" min={1} max={65535} value={form.port} onChange={(event) => model.updateSourceForm({ port: Number(event.target.value) })} /></Field>
            <Field label={databaseField.label}><input required value={form.databaseName} onChange={(event) => model.updateSourceForm({ databaseName: event.target.value })} placeholder={databaseField.placeholder} /></Field>
            {engine?.supportsSchema
              ? <Field label="Schema" hint={engine.defaultSchema ? `Mặc định: ${engine.defaultSchema}` : "Mặc định: schema của user"}><input value={form.schemaName ?? ""} onChange={(event) => model.updateSourceForm({ schemaName: event.target.value })} placeholder={engine.defaultSchema ?? "HR"} /></Field>
              : <div className="field" />}
            <Field label="Tên đăng nhập"><input required value={form.username} onChange={(event) => model.updateSourceForm({ username: event.target.value })} autoComplete="off" placeholder="readonly_user" /></Field>
            <Field label="Mật khẩu"><input type="password" value={form.password ?? ""} onChange={(event) => model.updateSourceForm({ password: event.target.value })} autoComplete="new-password" placeholder={editing ? "Để trống để giữ mật khẩu cũ" : "••••••••"} /></Field>
          </div>
          <p className="form-tip"><Icon name="shield" size={13} /> Nên dùng tài khoản chỉ có quyền đọc. Mật khẩu không bao giờ được trả về trình duyệt.</p>
        </Section>

        <button type="button" className="advanced-toggle" onClick={() => setShowAdvanced((value) => !value)} aria-expanded={showAdvanced}>
          <span className={showAdvanced ? "agent-chevron open" : "agent-chevron"}><Icon name="chevron" size={14} /></span>
          Cấu hình nâng cao <small>SSL, timeout, giới hạn dòng, thuộc tính JDBC</small>
        </button>

        {showAdvanced && <Section>
          <div className="form-grid">
            <Field label="Connect timeout (giây)" span={2}><input type="number" min={1} max={120} value={form.connectTimeoutSeconds} onChange={(event) => model.updateSourceForm({ connectTimeoutSeconds: Number(event.target.value) })} /></Field>
            <Field label="Query timeout (giây)" span={2}><input type="number" min={1} max={600} value={form.queryTimeoutSeconds} onChange={(event) => model.updateSourceForm({ queryTimeoutSeconds: Number(event.target.value) })} /></Field>
            <Field label="Số dòng tối đa" span={2}><input type="number" min={1} max={10000} value={form.maxRows} onChange={(event) => model.updateSourceForm({ maxRows: Number(event.target.value) })} /></Field>
          </div>
          <label className={engine?.supportsSsl ? "switch-row" : "switch-row disabled"}>
            <input type="checkbox" checked={form.sslEnabled} disabled={!engine?.supportsSsl} onChange={(event) => model.updateSourceForm({ sslEnabled: event.target.checked })} />
            <span className="switch" />
            <span><strong>Mã hoá SSL/TLS</strong><small>{engine?.supportsSsl ? "Áp dụng thuộc tính SSL mặc định của engine." : `${engine?.displayName ?? "Engine này"} chưa có cấu hình SSL trong db_engines.`}</small></span>
          </label>
          <div className="props-editor">
            <div className="props-head"><strong>Thuộc tính JDBC</strong><small>Ghi đè hoặc bổ sung tham số driver, VD: characterEncoding=utf8</small></div>
            {form.properties.map((row) => <div className="prop-row" key={row.id}>
              <input value={row.key} onChange={(event) => setProperty(row.id, { key: event.target.value })} placeholder="tên thuộc tính" aria-label="Tên thuộc tính" />
              <span>=</span>
              <input value={row.value} onChange={(event) => setProperty(row.id, { value: event.target.value })} placeholder="giá trị" aria-label="Giá trị" />
              <button type="button" className="icon-action" onClick={() => model.updateSourceForm({ properties: form.properties.filter((item) => item.id !== row.id) })} aria-label="Xoá thuộc tính"><Icon name="x" size={14} /></button>
            </div>)}
            <button type="button" className="link-button" onClick={() => model.updateSourceForm({ properties: [...form.properties, { id: Date.now(), key: "", value: "" }] })}><Icon name="plus" size={13} /> Thêm thuộc tính</button>
          </div>
        </Section>}

        {draftTest && <div className={draftTest.success ? "test-result success" : "test-result error"} role="status">
          <Icon name={draftTest.success ? "check" : "alert"} size={16} />
          <div>
            <strong>{draftTest.success ? "Kết nối thành công" : "Kết nối thất bại"}</strong>
            <p>{draftTest.success ? `${draftTest.databaseProduct ?? ""} ${draftTest.databaseVersion ?? ""} · ${draftTest.latencyMs} ms` : draftTest.message}</p>
          </div>
        </div>}
      </div>

      <div className="modal-actions">
        <button type="button" className="ghost-button" onClick={model.runDraftTest} disabled={busy || !form.host || !form.databaseName || !form.username}>
          <Icon name="shield" size={15} /> Kiểm tra kết nối
        </button>
        <span className="spacer" />
        <button type="button" className="ghost-button" onClick={close}>Huỷ</button>
        <button className="primary-button" disabled={busy}>{busy ? <span className="spinner light" /> : <Icon name="check" size={15} />} {editing ? "Lưu thay đổi" : "Lưu & đồng bộ"}</button>
      </div>
    </form>
  </div>;
}

function Section({ title, hint, children }: { title?: string; hint?: string; children: ReactNode }) {
  return <section className="form-section">
    {title && <div className="form-section-head"><strong>{title}</strong>{hint && <small>{hint}</small>}</div>}
    {children}
  </section>;
}

/** `span` is the width on the 6-column form grid (default half). */
function Field({ label, hint, span = 3, children }: { label: string; hint?: string; span?: number; children: ReactNode }) {
  return <label className="field" style={{ gridColumn: `span ${span}` }}>
    <span>{label}{hint && <small>{hint}</small>}</span>
    {children}
  </label>;
}

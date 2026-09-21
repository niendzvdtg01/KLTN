"use client";

import type { FormEvent } from "react";
import type { DataSourceInput } from "@/src/data/dataSourceApi";

type Props = { form: DataSourceInput; busy: boolean; onChange: <K extends keyof DataSourceInput>(field: K, value: DataSourceInput[K]) => void; onSubmit: (event: FormEvent) => void; onClose: () => void };

export function SourceModal({ form, busy, onChange, onSubmit, onClose }: Props) {
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><form className="source-modal" onSubmit={onSubmit}>
    <div className="modal-heading"><div><span className="eyebrow">CONNECTION</span><h2>Add data source</h2></div><button type="button" className="close-button" onClick={onClose}>×</button></div>
    <p className="modal-copy">Kết nối MySQL để lưu schema snapshot cho workspace.</p>
    <div className="form-grid"><SourceField label="Name" required value={form.name} onChange={(value) => onChange("name", value)} placeholder="Analytics database" /><SourceField label="Database" required value={form.databaseName} onChange={(value) => onChange("databaseName", value)} placeholder="ai_agent" /><SourceField label="Host" required value={form.host} onChange={(value) => onChange("host", value)} /><SourceField label="Port" required type="number" value={form.port} onChange={(value) => onChange("port", Number(value))} /><SourceField label="Username" required value={form.username} onChange={(value) => onChange("username", value)} /><SourceField label="Password" required type="password" value={form.password} onChange={(value) => onChange("password", value)} /></div>
    <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="run-button" disabled={busy}>{busy ? "Saving..." : "Add connection"}</button></div>
  </form></div>;
}

function SourceField({ label, value, onChange, ...props }: { label: string; value: string | number | undefined; onChange: (value: string) => void; required?: boolean; type?: string; placeholder?: string }) {
  return <label>{label}<input {...props} value={value ?? ""} onChange={(event) => onChange(event.target.value)} /></label>;
}

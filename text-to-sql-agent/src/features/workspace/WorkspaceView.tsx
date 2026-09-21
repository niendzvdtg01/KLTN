"use client";

import { Icon } from "@/src/presentation/components/Icon";
import { useWorkspace } from "./hooks/useWorkspace";
import { WorkspaceSidebar } from "./components/WorkspaceSidebar";
import { QueryPanel } from "./components/QueryPanel";
import { InsightSidebar } from "./components/InsightSidebar";
import { SourceModal } from "./components/SourceModal";

export default function WorkspaceView() {
  const model = useWorkspace();
  return <main className="app-shell"><WorkspaceSidebar model={model} /><section className="workspace" id="workspace">
    <header className="topbar"><div><span className="eyebrow">QUERY WORKSPACE</span><h1>Ask your data</h1></div><div className="top-actions"><button className="icon-button" title="Help"><Icon name="help" size={18} /></button><button className="upgrade-button" onClick={() => model.setShowSourceForm(true)}>Add data source <Icon name="plus" size={15} /></button></div></header>
    {model.notice && <div className="notice" role="status">{model.notice}<button onClick={() => model.setNotice("")}>×</button></div>}
    <div className="content-grid"><QueryPanel model={model} /><InsightSidebar model={model} /></div>
  </section>{model.showSourceForm && <SourceModal form={model.sourceForm} busy={model.sourceBusy} onChange={model.updateSourceField} onSubmit={model.submitSource} onClose={() => model.setShowSourceForm(false)} />}</main>;
}

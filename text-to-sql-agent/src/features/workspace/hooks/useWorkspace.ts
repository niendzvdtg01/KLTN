"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { getCurrentUser, logout, type AuthUser } from "@/src/data/authApi";
import {
  archiveConversation,
  createConversation,
  listConversationMessages,
  listConversations,
  updateConversation,
  type Conversation,
  type ConversationMessage,
} from "@/src/data/conversationApi";
import {
  archiveDataSource,
  createDataSource,
  listDataSources,
  listDbEngines,
  parseSchema,
  syncDataSource,
  testDataSource,
  testDataSourceDraft,
  updateDataSource,
  type ConnectionTestResult,
  type DataSource,
  type DbEngine,
} from "@/src/data/dataSourceApi";
import { useTextToSql } from "@/src/presentation/hooks/useTextToSql";
import { emptySourceForm, formFromSource, inputFromForm, type ResultTab, type SourceForm } from "../constants";

export type Notice = { tone: "info" | "success" | "error"; text: string };

export function useWorkspace() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [engines, setEngines] = useState<DbEngine[]>([]);
  const [sources, setSources] = useState<DataSource[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState<number | null>(null);
  const [sourceModal, setSourceModal] = useState<{ editingId: number | null } | null>(null);
  const [sourceForm, setSourceForm] = useState<SourceForm>(emptySourceForm);
  const [draftTest, setDraftTest] = useState<ConnectionTestResult | null>(null);
  const [notice, setNoticeState] = useState<Notice | null>(null);
  const [sourceBusy, setSourceBusy] = useState(false);
  const [activeTab, setActiveTab] = useState<ResultTab>("chart");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null);
  const [conversationMessages, setConversationMessages] = useState<ConversationMessage[]>([]);
  const [conversationBusy, setConversationBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const { state, runQuery: runAgentQuery, setQuestion, reset: resetQuery } = useTextToSql();

  const activeSources = sources.filter(({ status }) => status !== "ARCHIVED");
  const selectedSource = sources.find(({ id }) => id === selectedSourceId) ?? activeSources[0];
  const selectedConversation = conversations.find(({ id }) => id === selectedConversationId) ?? null;
  const schema = useMemo(() => parseSchema(selectedSource?.schemaJson), [selectedSource]);
  const engineOf = (code?: string) => engines.find((engine) => engine.code === code);

  useEffect(() => {
    Promise.all([getCurrentUser(), listDataSources(), listConversations(), listDbEngines()])
      .then(async ([currentUser, data, conversationData, engineData]) => {
        setUser(currentUser);
        setSources(data);
        setEngines(engineData);
        setConversations(conversationData);
        const first = conversationData.find(({ status }) => status === "ACTIVE");
        setSelectedSourceId(first?.dataSourceId ?? data.find(({ status }) => status !== "ARCHIVED")?.id ?? null);
        setSelectedConversationId(first?.id ?? null);
        if (first) setConversationMessages(await listConversationMessages(first.id).catch(() => []));
        setLoaded(true);
      })
      .catch(() => router.replace("/login"));
  }, [router]);

  const setNotice = (text: string, tone: Notice["tone"] = "info") => setNoticeState(text ? { tone, text } : null);
  const showError = (error: unknown, fallback: string) =>
    setNotice(error instanceof Error ? error.message : fallback, "error");
  const replaceSource = (updated: DataSource) =>
    setSources((current) => current.map((source) => source.id === updated.id ? updated : source));

  async function createNewConversation() {
    if (!selectedSource || selectedSource.status !== "ACTIVE") {
      setNotice("Hãy chọn một kết nối đang hoạt động trước khi tạo hội thoại.", "error");
      return;
    }
    setConversationBusy(true);
    try {
      const created = await createConversation("Hội thoại mới", selectedSource.id);
      setConversations((current) => [created, ...current]);
      setSelectedConversationId(created.id);
      setConversationMessages([]);
      resetQuery();
    } catch (error) {
      showError(error, "Không thể tạo hội thoại.");
    } finally {
      setConversationBusy(false);
    }
  }

  async function selectConversation(conversation: Conversation) {
    if (state.isLoading) return;
    setSelectedConversationId(conversation.id);
    setSelectedSourceId(conversation.dataSourceId);
    resetQuery();
    setConversationBusy(true);
    try {
      setConversationMessages(await listConversationMessages(conversation.id));
    } catch (error) {
      showError(error, "Không thể tải lịch sử hội thoại.");
    } finally {
      setConversationBusy(false);
    }
  }

  async function renameConversation(conversation: Conversation, title: string) {
    setConversationBusy(true);
    try {
      const updated = await updateConversation(conversation.id, title);
      setConversations((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (error) {
      showError(error, "Không thể đổi tên hội thoại.");
    } finally {
      setConversationBusy(false);
    }
  }

  async function archiveSelectedConversation(conversation: Conversation) {
    setConversationBusy(true);
    try {
      await archiveConversation(conversation.id);
      setConversations((current) => current.map((item) => item.id === conversation.id ? { ...item, status: "ARCHIVED" } : item));
      if (selectedConversationId === conversation.id) {
        setSelectedConversationId(null);
        setConversationMessages([]);
        resetQuery();
      }
      setNotice("Đã lưu trữ hội thoại. Lịch sử vẫn được giữ lại.", "success");
    } catch (error) {
      showError(error, "Không thể lưu trữ hội thoại.");
    } finally {
      setConversationBusy(false);
    }
  }

  function selectSource(id: number) {
    setSelectedSourceId(id);
    // A conversation is bound to one data source; keep the open one only if it uses this source.
    if (selectedConversation && selectedConversation.dataSourceId !== id) {
      setSelectedConversationId(null);
      setConversationMessages([]);
      resetQuery();
    }
  }

  function openCreateSource() {
    const engine = engines[0];
    setSourceForm({ ...emptySourceForm, dbType: engine?.code ?? "MYSQL", port: engine?.defaultPort ?? 3306 });
    setDraftTest(null);
    setSourceModal({ editingId: null });
  }

  function openEditSource(source: DataSource) {
    setSourceForm(formFromSource(source));
    setDraftTest(null);
    setSourceModal({ editingId: source.id });
  }

  function updateSourceForm(patch: Partial<SourceForm>) {
    setSourceForm((current) => ({ ...current, ...patch }));
    setDraftTest(null);
  }

  /** Switching engine moves the port to the new engine's default unless the user typed a custom one. */
  function changeEngine(code: string) {
    const next = engineOf(code);
    setSourceForm((current) => {
      const previousDefault = engineOf(current.dbType)?.defaultPort;
      const port = !current.port || current.port === previousDefault ? next?.defaultPort ?? current.port : current.port;
      return { ...current, dbType: code, port, sslEnabled: next?.supportsSsl ? current.sslEnabled : false, schemaName: next?.supportsSchema ? current.schemaName : "" };
    });
    setDraftTest(null);
  }

  async function runDraftTest() {
    setSourceBusy(true);
    try {
      setDraftTest(await testDataSourceDraft(inputFromForm(sourceForm), sourceModal?.editingId));
    } catch (error) {
      setDraftTest({ success: false, message: error instanceof Error ? error.message : "Không thể kiểm tra kết nối.", databaseProduct: null, databaseVersion: null, latencyMs: 0 });
    } finally {
      setSourceBusy(false);
    }
  }

  async function submitSource(event: FormEvent) {
    event.preventDefault();
    if (!sourceModal) return;
    setSourceBusy(true);
    try {
      const input = inputFromForm(sourceForm);
      if (sourceModal.editingId) {
        replaceSource(await updateDataSource(sourceModal.editingId, input));
        setNotice("Đã cập nhật kết nối. Hãy đồng bộ lại schema nếu cấu trúc database đã thay đổi.", "success");
      } else {
        const created = await createDataSource(input);
        setSources((current) => [created, ...current]);
        setSelectedSourceId(created.id);
        // A fresh source is only useful once its schema is known, so sync right away.
        try {
          replaceSource(await syncDataSource(created.id));
          setNotice(`Đã thêm “${created.name}” và đồng bộ schema.`, "success");
        } catch (error) {
          showError(error, "Đã thêm kết nối nhưng chưa đồng bộ được schema.");
        }
      }
      setSourceModal(null);
    } catch (error) {
      showError(error, "Không thể lưu kết nối.");
    } finally {
      setSourceBusy(false);
    }
  }

  async function runSourceAction(action: "test" | "sync") {
    if (!selectedSource) return;
    setSourceBusy(true);
    try {
      replaceSource(action === "test" ? await testDataSource(selectedSource.id) : await syncDataSource(selectedSource.id));
      setNotice(action === "test" ? "Kết nối hoạt động bình thường." : "Đã đồng bộ schema.", "success");
    } catch (error) {
      showError(error, "Thao tác thất bại.");
      // The backend records the failure on the source; reload so the status badge reflects it.
      listDataSources().then(setSources).catch(() => undefined);
    } finally {
      setSourceBusy(false);
    }
  }

  async function archiveSelectedSource() {
    if (!selectedSource || !window.confirm(`Lưu trữ kết nối “${selectedSource.name}”? Lịch sử hội thoại vẫn được giữ.`)) return;
    setSourceBusy(true);
    try {
      await archiveDataSource(selectedSource.id);
      const remaining = sources.map((source) => source.id === selectedSource.id ? { ...source, status: "ARCHIVED" } : source);
      setSources(remaining);
      setSelectedSourceId(remaining.find(({ status }) => status !== "ARCHIVED")?.id ?? null);
      setNotice("Đã lưu trữ kết nối.", "success");
    } catch (error) {
      showError(error, "Không thể lưu trữ kết nối.");
    } finally {
      setSourceBusy(false);
    }
  }

  async function signOut() {
    await logout().catch(() => undefined);
    router.replace("/login");
  }

  async function runQuery() {
    if (!selectedConversationId) {
      if (!selectedSource || selectedSource.status !== "ACTIVE") {
        setNotice("Hãy thêm hoặc chọn một kết nối đang hoạt động trước.", "error");
        return;
      }
      // Asking without an open conversation starts one, titled by the question.
      try {
        const title = state.question.trim().slice(0, 80) || "Hội thoại mới";
        const created = await createConversation(title, selectedSource.id);
        setConversations((current) => [created, ...current]);
        setSelectedConversationId(created.id);
        setConversationMessages([]);
        await ask(created.id);
      } catch (error) {
        showError(error, "Không thể tạo hội thoại.");
      }
      return;
    }
    await ask(selectedConversationId);
  }

  async function ask(conversationId: number) {
    try {
      const response = await runAgentQuery(conversationId);
      if (response) {
        setActiveTab("chart");
        setConversationMessages(await listConversationMessages(conversationId));
        setConversations((current) => current.map((item) => item.id === conversationId ? { ...item, updatedAt: new Date().toISOString() } : item));
      }
    } catch {
      // The failure is shown inside the agent timeline.
    }
  }

  return {
    user, engines, engineOf, sources, activeSources, selectedSource, selectedConversation, schema, loaded,
    notice, setNotice, sourceBusy, sourceForm, sourceModal, setSourceModal, draftTest, activeTab, setActiveTab,
    conversations, selectedConversationId, conversationMessages, conversationBusy, state, setQuestion,
    runQuery, createNewConversation, selectConversation, renameConversation, archiveSelectedConversation,
    selectSource, openCreateSource, openEditSource, updateSourceForm, changeEngine, runDraftTest, submitSource,
    runSourceAction, archiveSelectedSource, signOut,
  };
}

export type WorkspaceModel = ReturnType<typeof useWorkspace>;

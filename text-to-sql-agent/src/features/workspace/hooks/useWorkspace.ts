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
  parseSchema,
  syncDataSource,
  testDataSource,
  type DataSource,
  type DataSourceInput,
} from "@/src/data/dataSourceApi";
import { useTextToSql } from "@/src/presentation/hooks/useTextToSql";
import { emptyDataSourceForm, type ResultTab } from "../constants";

export function useWorkspace() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [sources, setSources] = useState<DataSource[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState<number | null>(null);
  const [showSourceForm, setShowSourceForm] = useState(false);
  const [sourceForm, setSourceForm] = useState<DataSourceInput>(emptyDataSourceForm);
  const [notice, setNotice] = useState("");
  const [sourceBusy, setSourceBusy] = useState(false);
  const [activeTab, setActiveTab] = useState<ResultTab>("table");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null);
  const [conversationMessages, setConversationMessages] = useState<ConversationMessage[]>([]);
  const [conversationBusy, setConversationBusy] = useState(false);
  const { state, runQuery, setQuestion } = useTextToSql();

  const selectedSource = sources.find(({ id }) => id === selectedSourceId) ?? sources[0];
  const schema = useMemo(() => parseSchema(selectedSource?.schemaJson), [selectedSource]);

  useEffect(() => {
    Promise.all([getCurrentUser(), listDataSources(), listConversations()])
      .then(([currentUser, data, conversationData]) => {
        setUser(currentUser);
        setSources(data);
        setSelectedSourceId(data[0]?.id ?? null);
        setConversations(conversationData);
        setSelectedConversationId(
          conversationData.find(({ status }) => status === "ACTIVE")?.id ?? null,
        );
      })
      .catch(() => router.replace("/login"));
  }, [router]);

  const showError = (error: unknown, fallback: string) =>
    setNotice(error instanceof Error ? error.message : fallback);

  async function createNewConversation() {
    if (!selectedSource || selectedSource.status !== "ACTIVE") {
      setNotice("Hãy chọn một data source đang ACTIVE trước.");
      return;
    }
    setConversationBusy(true);
    try {
      const created = await createConversation("New conversation", selectedSource.id);
      setConversations((current) => [created, ...current]);
      setSelectedConversationId(created.id);
      setConversationMessages([]);
      setQuestion("");
      setNotice("Đã tạo conversation mới.");
    } catch (error) {
      showError(error, "Không thể tạo conversation.");
    } finally {
      setConversationBusy(false);
    }
  }

  async function selectConversation(conversation: Conversation) {
    setSelectedConversationId(conversation.id);
    setConversationBusy(true);
    try {
      setConversationMessages(await listConversationMessages(conversation.id));
    } catch (error) {
      showError(error, "Không thể tải lịch sử conversation.");
    } finally {
      setConversationBusy(false);
    }
  }

  async function renameConversation(conversation: Conversation, title: string) {
    setConversationBusy(true);
    try {
      const updated = await updateConversation(conversation.id, title);
      setConversations((current) => current.map((item) => item.id === updated.id ? updated : item));
      setNotice("Đã đổi tên conversation.");
    } catch (error) {
      showError(error, "Không thể đổi tên conversation.");
    } finally {
      setConversationBusy(false);
    }
  }

  async function archiveSelectedConversation(conversation: Conversation) {
    setConversationBusy(true);
    try {
      await archiveConversation(conversation.id);
      setConversations((current) => current.map((item) => item.id === conversation.id ? { ...item, status: "ARCHIVED" } : item));
      if (selectedConversationId === conversation.id) setSelectedConversationId(null);
      setNotice("Đã archive conversation. Lịch sử vẫn được giữ lại.");
    } catch (error) {
      showError(error, "Không thể archive conversation.");
    } finally {
      setConversationBusy(false);
    }
  }

  function updateSourceField<K extends keyof DataSourceInput>(field: K, value: DataSourceInput[K]) {
    setSourceForm((current) => ({ ...current, [field]: value }));
  }

  async function submitSource(event: FormEvent) {
    event.preventDefault();
    setSourceBusy(true);
    setNotice("");
    try {
      const created = await createDataSource({ ...sourceForm, port: Number(sourceForm.port) });
      setSources((current) => [created, ...current]);
      setSelectedSourceId(created.id);
      setShowSourceForm(false);
      setSourceForm(emptyDataSourceForm);
      setNotice("Đã thêm data source. Hãy test connection hoặc đồng bộ schema.");
    } catch (error) {
      showError(error, "Không thể thêm data source.");
    } finally {
      setSourceBusy(false);
    }
  }

  async function runSourceAction(action: "test" | "sync") {
    if (!selectedSource) return;
    setSourceBusy(true);
    setNotice("");
    try {
      const updated = action === "test"
        ? await testDataSource(selectedSource.id)
        : await syncDataSource(selectedSource.id);
      setSources((current) => current.map((source) => source.id === updated.id ? updated : source));
      setNotice(action === "test" ? "Kết nối thành công." : "Đã đồng bộ schema.");
    } catch (error) {
      showError(error, "Thao tác thất bại.");
    } finally {
      setSourceBusy(false);
    }
  }

  async function archiveSelectedSource() {
    if (!selectedSource || !window.confirm(`Archive data source “${selectedSource.name}”?`)) return;
    setSourceBusy(true);
    try {
      await archiveDataSource(selectedSource.id);
      const remaining = sources.filter(({ id }) => id !== selectedSource.id);
      setSources(remaining);
      setSelectedSourceId(remaining[0]?.id ?? null);
      setNotice("Đã archive data source.");
    } catch (error) {
      showError(error, "Không thể archive data source.");
    } finally {
      setSourceBusy(false);
    }
  }

  async function signOut() {
    await logout().catch(() => undefined);
    router.replace("/login");
  }

  return {
    user, sources, selectedSource, schema, notice, setNotice, sourceBusy, sourceForm,
    showSourceForm, setShowSourceForm, activeTab, setActiveTab, conversations,
    selectedConversationId, conversationMessages, conversationBusy, state, setQuestion,
    runQuery, createNewConversation, selectConversation, renameConversation,
    archiveSelectedConversation, updateSourceField, submitSource, runSourceAction,
    archiveSelectedSource, signOut,
  };
}

export type WorkspaceModel = ReturnType<typeof useWorkspace>;

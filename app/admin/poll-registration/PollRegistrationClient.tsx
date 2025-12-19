//app/admin/poll-registration/PollRegistrationClient.tsx

"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type PollPayload = {
  id?: string;
  title?: string | null;
  description?: string | null;
  status?: string | null;

  allow_multiple?: boolean | null;
  max_votes_per_user?: number | null;

  vote_cooldown_seconds?: number | null;

  voting_type?: "single" | "ranking" | "multiple" | null;
  max_options_per_vote?: number | null;

  created_at?: string | null;
  closes_at?: string | null;
  start_date?: string | null;
  end_date?: string | null;

  show_partial_results?: boolean | null;
  icon_name?: string | null;
  icon_url?: string | null;
};

type PollOption = {
  id: string;
  poll_id: string;
  option_text: string;
};

// datetime-local helpers (evita warning do "2025-...Z")
function toDatetimeLocal(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function nowDatetimeLocal() {
  return toDatetimeLocal(new Date().toISOString());
}

function formatPtBrDateTime(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("pt-BR");
}

/**
 * Converte o valor do input `datetime-local` (YYYY-MM-DDTHH:mm) para ISO UTC.
 * - "" -> null
 * - inválido -> null
 */
function datetimeLocalToISOOrNull(value: string): string | null {
  const s = (value ?? "").trim();
  if (!s) return null;

  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;

  return d.toISOString();
}

function isValidDatetimeLocal(value: string) {
  const s = (value ?? "").trim();
  if (!s) return false;
  const d = new Date(s);
  return !Number.isNaN(d.getTime());
}

export default function PollRegistrationClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const tokenFromUrl = searchParams.get("token") ?? "";
  const pollIdFromUrl = searchParams.get("poll_id") ?? "";
  const isEditMode = Boolean(pollIdFromUrl);

  const adminTokenQuery = `token=${encodeURIComponent(tokenFromUrl)}`;

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    status: "open" as "draft" | "open" | "paused" | "closed",

    // allow_multiple agora é controlado por Select Sim/Não
    allow_multiple: false,
    // sempre number (sem ""), conforme regra nova
    max_votes_per_user: 1,

    created_at: nowDatetimeLocal(),
    closes_at: "",

    // default deve ser 10
    vote_cooldown_seconds: 10,

    // Tipo de voto: single | ranking | multiple
    voting_type: "single" as "single" | "ranking" | "multiple",
    // só usado quando voting_type === "multiple"
    max_options_per_vote: 2 as number,

    start_date: nowDatetimeLocal(),
    end_date: "",

    show_partial_results: true,
    icon_name: "",
    icon_url: "",
  });

  // Mantém o último valor válido para reverter quando o usuário sai do campo com valor inválido
  const [lastValidDates, setLastValidDates] = useState({
    start_date: nowDatetimeLocal(),
    end_date: "",
    closes_at: "",
  });

  const [loading, setLoading] = useState(false);
  const [loadingPoll, setLoadingPoll] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [isEditing, setIsEditing] = useState(true);

  // ===== Opções =====
  const [options, setOptions] = useState<PollOption[]>([]);
  const [optionText, setOptionText] = useState("");
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [optionsError, setOptionsError] = useState("");
  const [optionsSuccess, setOptionsSuccess] = useState(false);

  const [editingOptionId, setEditingOptionId] = useState<string | null>(null);
  const [editingOptionText, setEditingOptionText] = useState("");
  const [optionSaving, setOptionSaving] = useState(false);

  useEffect(() => {
    if (isEditMode) return;

    const currentDate = nowDatetimeLocal();
    setFormData((prevData) => ({
      ...prevData,
      created_at: currentDate,
      start_date: currentDate,
      vote_cooldown_seconds: 10,
      allow_multiple: false,
      max_votes_per_user: 1,
      voting_type: "single",
      max_options_per_vote: 2,
    }));

    setLastValidDates((prev) => ({
      ...prev,
      start_date: currentDate,
    }));
  }, [isEditMode]);

  useEffect(() => {
    const loadPoll = async () => {
      if (!pollIdFromUrl) return;

      setLoadingPoll(true);
      setError("");
      setSuccess(false);

      try {
        const res = await fetch(
          `/api/admin/polls/${encodeURIComponent(pollIdFromUrl)}?${adminTokenQuery}`,
          { method: "GET" }
        );

        let json: any = null;
        try {
          json = await res.json();
        } catch {
          json = null;
        }

        if (!res.ok) {
          throw new Error(
            json?.details
              ? `Falha ao carregar pesquisa: ${json.error} — ${json.details}`
              : json?.error
                ? `Falha ao carregar pesquisa: ${json.error}`
                : "Falha ao carregar pesquisa."
          );
        }

        const poll: PollPayload | undefined = json?.poll;
        if (!poll) throw new Error("Resposta inválida do servidor (poll ausente).");

        const vt: "single" | "ranking" | "multiple" =
          poll.voting_type === "ranking"
            ? "ranking"
            : poll.voting_type === "multiple"
              ? "multiple"
              : "single";

        const nextForm = {
          title: poll.title ?? "",
          description: poll.description ?? "",
          status: (poll.status ?? "open") as any,

          allow_multiple: Boolean(poll.allow_multiple ?? false),
          max_votes_per_user:
            typeof poll.max_votes_per_user === "number" ? poll.max_votes_per_user : 1,

          created_at: toDatetimeLocal(poll.created_at) || nowDatetimeLocal(),
          closes_at: toDatetimeLocal(poll.closes_at),

          vote_cooldown_seconds:
            typeof poll.vote_cooldown_seconds === "number" ? poll.vote_cooldown_seconds : 10,

          voting_type: vt,
          max_options_per_vote:
            vt === "multiple"
              ? typeof poll.max_options_per_vote === "number"
                ? poll.max_options_per_vote
                : 2
              : 2,

          start_date: toDatetimeLocal(poll.start_date) || nowDatetimeLocal(),
          end_date: toDatetimeLocal(poll.end_date),

          show_partial_results:
            typeof poll.show_partial_results === "boolean" ? poll.show_partial_results : true,

          icon_name: poll.icon_name ?? "",
          icon_url: poll.icon_url ?? "",
        };

        // Regra: se allow_multiple for false, forçar max_votes_per_user=1
        if (!nextForm.allow_multiple) {
          nextForm.max_votes_per_user = 1;
        } else if (nextForm.max_votes_per_user < 2) {
          nextForm.max_votes_per_user = 2;
        }

        setFormData((prev) => ({ ...prev, ...nextForm }));

        // atualiza lastValidDates com o que veio do backend
        setLastValidDates({
          start_date: nextForm.start_date,
          end_date: nextForm.end_date,
          closes_at: nextForm.closes_at,
        });

        setIsEditing(true);
      } catch (err: any) {
        setError(err.message || "Erro desconhecido.");
      } finally {
        setLoadingPoll(false);
      }
    };

    loadPoll();
  }, [pollIdFromUrl, adminTokenQuery]);

  useEffect(() => {
    const loadOptions = async () => {
      if (!pollIdFromUrl) return;

      setOptionsLoading(true);
      setOptionsError("");
      setOptionsSuccess(false);

      try {
        const res = await fetch(
          `/api/admin/polls/${encodeURIComponent(pollIdFromUrl)}/options?${adminTokenQuery}`,
          { method: "GET" }
        );

        let json: any = null;
        try {
          json = await res.json();
        } catch {
          json = null;
        }

        if (!res.ok) {
          throw new Error(
            json?.error
              ? `Falha ao carregar opções: ${json.error}`
              : "Falha ao carregar opções."
          );
        }

        setOptions(Array.isArray(json?.options) ? json.options : []);
      } catch (err: any) {
        setOptionsError(err.message || "Erro desconhecido.");
      } finally {
        setOptionsLoading(false);
      }
    };

    loadOptions();
  }, [pollIdFromUrl, adminTokenQuery]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    const isCheckbox = type === "checkbox";

    setFormData((prev) => ({
      ...prev,
      [name]: isCheckbox ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  // NOVO: allow_multiple via select Sim/Não
  const handleAllowMultipleSelect = (value: "no" | "yes") => {
    if (value === "no") {
      setFormData((prev) => ({
        ...prev,
        allow_multiple: false,
        max_votes_per_user: 1,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        allow_multiple: true,
        max_votes_per_user: 2,
      }));
    }
  };

  const validateVotesConfigOrThrow = (data: typeof formData) => {
    if (!data.allow_multiple) {
      return { ...data, max_votes_per_user: 1 as const };
    }

    const n = Number(data.max_votes_per_user);
    if (!Number.isFinite(n) || n < 2) {
      throw new Error(
        "O máximo permitido deve ser 2 ou mais quando múltiplos votos estiverem habilitados."
      );
    }

    return { ...data, max_votes_per_user: n };
  };

  const validateMaxOptionsOrThrow = (data: typeof formData) => {
    if (data.voting_type !== "multiple") {
      return { ...data, max_options_per_vote: 2 as const };
    }

    const n = Number(data.max_options_per_vote);
    if (!Number.isFinite(n) || n < 1) {
      throw new Error("O máximo de opções por voto deve ser 1 ou mais.");
    }

    return { ...data, max_options_per_vote: n };
  };

  // ===== Datas: onChange só atualiza (permite digitação parcial).
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // ===== Datas: valida no onBlur e reverte para último válido se necessário.
  const validateAndCommitDatesOrRevert = (field: "start_date" | "end_date" | "closes_at") => {
    const value = (formData as any)[field] as string;

    // end_date/closes_at são opcionais (permitir limpar)
    if ((field === "end_date" || field === "closes_at") && !value) {
      setError("");
      setLastValidDates((prev) => ({ ...prev, [field]: "" }));
      return;
    }

    // start_date é obrigatório (não permitir vazio)
    if (field === "start_date" && !value) {
      setError("Preencha a data de início (start_date).");
      setFormData((prev) => ({ ...prev, start_date: lastValidDates.start_date }));
      return;
    }

    // formato válido?
    if (!isValidDatetimeLocal(value)) {
      setError(
        field === "start_date"
          ? "Data de início inválida."
          : field === "end_date"
            ? "Data de término inválida."
            : "Data de encerramento inválida."
      );
      setFormData((prev) => ({ ...prev, [field]: (lastValidDates as any)[field] }));
      return;
    }

    const createdAt = new Date(formData.created_at);
    const startDate = formData.start_date ? new Date(formData.start_date) : null;
    const endDate = formData.end_date ? new Date(formData.end_date) : null;
    const closesAt = formData.closes_at ? new Date(formData.closes_at) : null;

    // Regras auditáveis
    if (
      !Number.isNaN(createdAt.getTime()) &&
      ((startDate && startDate < createdAt) ||
        (endDate && endDate < createdAt) ||
        (closesAt && closesAt < createdAt))
    ) {
      setError("Datas não podem ser anteriores à data de criação.");
      setFormData((prev) => ({ ...prev, [field]: (lastValidDates as any)[field] }));
      return;
    }

    // coerência entre datas
    if (startDate && endDate && endDate < startDate) {
      setError("A data de término não pode ser anterior à data de início.");
      setFormData((prev) => ({ ...prev, [field]: (lastValidDates as any)[field] }));
      return;
    }

    if (startDate && closesAt && closesAt < startDate) {
      setError("A data de encerramento não pode ser anterior à data de início.");
      setFormData((prev) => ({ ...prev, [field]: (lastValidDates as any)[field] }));
      return;
    }

    if (endDate && closesAt && closesAt < endDate) {
      setError("A data de encerramento não pode ser anterior à data de término.");
      setFormData((prev) => ({ ...prev, [field]: (lastValidDates as any)[field] }));
      return;
    }

    // ok -> grava como último válido
    setError("");
    setLastValidDates((prev) => ({ ...prev, [field]: value }));
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);

    try {
      // Valida start_date no submit também
      const startRaw = formData.start_date?.trim();
      if (!startRaw) throw new Error("Preencha a data de início (start_date).");

      const start = new Date(startRaw);
      if (Number.isNaN(start.getTime())) {
        throw new Error("Data de início inválida.");
      }

      // tolerância 60s (mesma regra do backend)
      const toleranceMs = 60 * 1000;
      if (start.getTime() < Date.now() - toleranceMs) {
        throw new Error("A data de início não pode ser menor que agora. Ajuste e confirme.");
      }

      const ok = window.confirm(
        `Confirmar início da votação em:\n\n${formatPtBrDateTime(startRaw)} ?`
      );
      if (!ok) {
        setLoading(false);
        return;
      }

      const payload1 = validateVotesConfigOrThrow(formData);
      const payload2 = validateMaxOptionsOrThrow(payload1);

      const startISO = datetimeLocalToISOOrNull(payload2.start_date);
      if (!startISO) throw new Error("Data de início inválida.");

      const endISO = datetimeLocalToISOOrNull(payload2.end_date);
      const closesISO = datetimeLocalToISOOrNull(payload2.closes_at);

      const { created_at: _createdAt, ...payloadWithoutCreatedAt } = payload2;

      const bodyToSend: any = {
        ...payloadWithoutCreatedAt,
        start_date: startISO,
        end_date: endISO,
        closes_at: closesISO,
        vote_cooldown_seconds: payload2.vote_cooldown_seconds ?? 10,
      };

      // max_options_per_vote só faz sentido no multiple
      if (payload2.voting_type === "multiple") {
        bodyToSend.max_options_per_vote = payload2.max_options_per_vote;
      } else {
        bodyToSend.max_options_per_vote = null;
      }

      const response = await fetch(`/api/admin/create-poll?${adminTokenQuery}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyToSend),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.message || data?.error || "Falha ao criar pesquisa.");
      }

      setSuccess(true);

      const resetNow = nowDatetimeLocal();
      setFormData({
        title: "",
        description: "",
        status: "open",

        allow_multiple: false,
        max_votes_per_user: 1,

        created_at: resetNow,
        closes_at: "",

        vote_cooldown_seconds: 10,

        voting_type: "single",
        max_options_per_vote: 2,

        start_date: resetNow,
        end_date: "",

        show_partial_results: true,
        icon_name: "",
        icon_url: "",
      });

      setLastValidDates({
        start_date: resetNow,
        end_date: "",
        closes_at: "",
      });
    } catch (err: any) {
      setError(err.message || "Erro desconhecido.");
    } finally {
      setLoading(false);
    }
  };

  const handleMaxVotesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!formData.allow_multiple) {
      setFormData((prevData) => ({
        ...prevData,
        max_votes_per_user: 1,
      }));
      return;
    }

    const raw = e.target.value;
    const value = parseInt(raw, 10);
    if (!Number.isFinite(value)) return;

    setFormData((prevData) => ({
      ...prevData,
      max_votes_per_user: Math.max(2, value),
    }));
  };

  const handleMaxOptionsPerVoteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const value = parseInt(raw, 10);
    if (!Number.isFinite(value)) return;

    setFormData((prevData) => ({
      ...prevData,
      max_options_per_vote: Math.max(1, value),
    }));
  };

  const handleCooldownChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Math.max(0, parseInt(e.target.value, 10) || 0);
    setFormData((prevData) => ({
      ...prevData,
      vote_cooldown_seconds: value,
    }));
  };

  const handleClearForm = () => {
    const resetNow = nowDatetimeLocal();

    setFormData({
      title: "",
      description: "",
      status: "open",

      allow_multiple: false,
      max_votes_per_user: 1,

      created_at: resetNow,
      closes_at: "",

      vote_cooldown_seconds: 10,

      voting_type: "single",
      max_options_per_vote: 2,

      start_date: resetNow,
      end_date: "",

      show_partial_results: true,
      icon_name: "",
      icon_url: "",
    });

    setLastValidDates({
      start_date: resetNow,
      end_date: "",
      closes_at: "",
    });

    setError("");
    setSuccess(false);
    setIsEditing(true);
  };

  const handleSave = async () => {
    try {
      if (!pollIdFromUrl) {
        throw new Error("Abra uma pesquisa existente para salvar.");
      }

      setLoading(true);
      setError("");
      setSuccess(false);

      const payload1 = validateVotesConfigOrThrow(formData);
      const payload2 = validateMaxOptionsOrThrow(payload1);

      const startISO = datetimeLocalToISOOrNull(payload2.start_date);
      if (!startISO) throw new Error("Data de início inválida.");

      const endISO = datetimeLocalToISOOrNull(payload2.end_date);
      const closesISO = datetimeLocalToISOOrNull(payload2.closes_at);

      const { created_at: _createdAt, ...payloadWithoutCreatedAt } = payload2;

      const bodyToSend: any = {
        ...payloadWithoutCreatedAt,
        start_date: startISO,
        end_date: endISO,
        closes_at: closesISO,
        vote_cooldown_seconds: payload2.vote_cooldown_seconds ?? 10,
      };

      if (payload2.voting_type === "multiple") {
        bodyToSend.max_options_per_vote = payload2.max_options_per_vote;
      } else {
        bodyToSend.max_options_per_vote = null;
      }

      const res = await fetch(
        `/api/admin/polls/${encodeURIComponent(pollIdFromUrl)}?${adminTokenQuery}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bodyToSend),
        }
      );

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(
          json?.details
            ? `Falha ao salvar: ${json.error} — ${json.details}`
            : json?.message
              ? `Falha ao salvar: ${json.message}`
              : json?.error
                ? `Falha ao salvar: ${json.error}`
                : "Falha ao salvar."
        );
      }

      setSuccess(true);
      setIsEditing(false);

      // após salvar com sucesso, atualiza lastValidDates para os valores atuais
      setLastValidDates({
        start_date: formData.start_date,
        end_date: formData.end_date,
        closes_at: formData.closes_at,
      });
    } catch (err: any) {
      setError(err.message || "Erro desconhecido.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOption = async () => {
    setOptionsError("");
    setOptionsSuccess(false);

    try {
      if (!pollIdFromUrl) {
        throw new Error("Abra uma pesquisa existente para cadastrar opções.");
      }

      const text = optionText.trim();
      if (!text) {
        throw new Error("Digite o texto da opção.");
      }

      setOptionsLoading(true);

      const res = await fetch(
        `/api/admin/polls/${encodeURIComponent(pollIdFromUrl)}/options?${adminTokenQuery}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ option_text: text }),
        }
      );

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(
          json?.error ? `Falha ao criar opção: ${json.error}` : "Falha ao criar opção."
        );
      }

      const created: PollOption | undefined = json?.option;
      if (!created) throw new Error("Resposta inválida do servidor (option ausente).");

      setOptions((prev) => [...prev, created]);
      setOptionText("");
      setOptionsSuccess(true);
    } catch (err: any) {
      setOptionsError(err.message || "Erro desconhecido.");
    } finally {
      setOptionsLoading(false);
    }
  };

  const startEditOption = (opt: PollOption) => {
    setOptionsError("");
    setOptionsSuccess(false);
    setEditingOptionId(opt.id);
    setEditingOptionText(opt.option_text);
  };

  const handleSaveOption = async () => {
    try {
      setOptionsError("");
      setOptionsSuccess(false);

      if (!pollIdFromUrl) throw new Error("Abra uma pesquisa existente para editar opções.");
      if (!editingOptionId) throw new Error("Nenhuma opção em edição.");

      const text = editingOptionText.trim();
      if (!text) throw new Error("Digite o texto da opção.");

      setOptionSaving(true);

      const res = await fetch(
        `/api/admin/polls/${encodeURIComponent(pollIdFromUrl)}/options/${encodeURIComponent(
          editingOptionId
        )}?${adminTokenQuery}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ option_text: text }),
        }
      );

      let json: any = null;
      try {
        json = await res.json();
      } catch {
        json = null;
      }

      if (!res.ok) {
        throw new Error(
          json?.details
            ? `Falha ao salvar opção: ${json.error} — ${json.details}`
            : json?.error
              ? `Falha ao salvar opção: ${json.error}`
              : "Falha ao salvar opção."
        );
      }

      const updated: PollOption | undefined = json?.option;
      if (!updated) throw new Error("Resposta inválida do servidor (option ausente).");

      setOptions((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));

      setOptionsSuccess(true);
      setEditingOptionId(null);
      setEditingOptionText("");
    } catch (err: any) {
      setOptionsError(err.message || "Erro desconhecido.");
    } finally {
      setOptionSaving(false);
    }
  };

  const handleDeleteOption = async (opt: PollOption) => {
    try {
      setOptionsError("");
      setOptionsSuccess(false);

      if (!pollIdFromUrl) throw new Error("Abra uma pesquisa existente para remover opções.");

      const ok = window.confirm(`Remover a opção:\n\n"${opt.option_text}"\n\nTem certeza?`);
      if (!ok) return;

      setOptionsLoading(true);

      const res = await fetch(
        `/api/admin/polls/${encodeURIComponent(pollIdFromUrl)}/options/${encodeURIComponent(
          opt.id
        )}?${adminTokenQuery}`,
        { method: "DELETE" }
      );

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(
          json?.details
            ? `Falha ao remover opção: ${json.error} — ${json.details}`
            : json?.error
              ? `Falha ao remover opção: ${json.error}`
              : "Falha ao remover opção."
        );
      }

      setOptions((prev) => prev.filter((o) => o.id !== opt.id));

      if (editingOptionId === opt.id) {
        setEditingOptionId(null);
        setEditingOptionText("");
      }

      setOptionsSuccess(true);
    } catch (err: any) {
      setOptionsError(err.message || "Erro desconhecido.");
    } finally {
      setOptionsLoading(false);
    }
  };

  const isBusy = loading || loadingPoll;

  const minStartDatetimeLocal = !isEditMode ? nowDatetimeLocal() : undefined;

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>{isEditMode ? "Editar Pesquisa" : "Cadastro de Pesquisas"}</h1>

      {isEditMode && (
        <p style={styles.modeInfo}>
          ID da pesquisa: <strong>{pollIdFromUrl}</strong>
        </p>
      )}

      {loadingPoll && <p style={styles.info}>Carregando dados da pesquisa...</p>}

      <form onSubmit={handleFormSubmit} style={styles.form}>
        {/* Título com campo maior */}
        <div style={styles.fieldGroup}>
          <label style={styles.label}>Título:</label>
          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleInputChange}
            style={styles.titleInput}
            placeholder="Digite o título da pesquisa"
            required
            disabled={!isEditing || isBusy}
          />
        </div>

        <div style={styles.fieldGroup}>
          <label style={styles.label}>Descrição:</label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            style={styles.textarea}
            placeholder="Digite uma descrição opcional"
            required
            disabled={!isEditing || isBusy}
          />
        </div>

        {/* Status + allow_multiple + max_votes_per_user (todos na mesma linha) */}
        <div style={styles.inlineFieldGroup}>
          <div style={{ ...styles.fieldGroup, flex: 1, minWidth: 60 }}>
            <label style={styles.label}>Status:</label>
            <select
              name="status"
              value={formData.status}
              onChange={handleInputChange}
              style={styles.select}
              disabled={!isEditing || isBusy}
            >
              <option value="draft">Rascunho</option>
              <option value="open">Aberta</option>
              <option value="paused">Pausada</option>
              <option value="closed">Encerrada</option>
            </select>
          </div>

          <div style={{ ...styles.fieldGroup, flex: 1, minWidth: 170 }}>
            <label style={styles.label}>Permitir múltiplos votos?</label>
            <select
              value={formData.allow_multiple ? "yes" : "no"}
              onChange={(e) => handleAllowMultipleSelect(e.target.value as "no" | "yes")}
              style={styles.select}
              disabled={!isEditing || isBusy}
            >
              <option value="no">Não</option>
              <option value="yes">Sim</option>
            </select>
          </div>

          <div style={{ ...styles.fieldGroup, width: 170, minWidth: 70 }}>
            <label style={styles.label}>Máximo Permitido:</label>
            <input
              type="number"
              name="max_votes_per_user"
              value={formData.max_votes_per_user}
              onChange={handleMaxVotesChange}
              style={styles.input}
              min={formData.allow_multiple ? 2 : 1}
              disabled={!isEditing || isBusy}
              readOnly={!formData.allow_multiple}
            />
          </div>
        </div>

        {/* Criado em + Encerramento */}
        <div style={styles.inlineFieldGroup}>
          <div style={{ ...styles.fieldGroup, flex: 1, minWidth: 220 }}>
            <label style={styles.label}>Criado em:</label>
            <input
              type="datetime-local"
              name="created_at"
              value={formData.created_at}
              onChange={handleInputChange}
              style={styles.input}
              readOnly
            />
          </div>

          <div style={{ ...styles.fieldGroup, flex: 1, minWidth: 220 }}>
            <label style={styles.label}>Data de Encerramento:</label>
            <input
              type="datetime-local"
              name="closes_at"
              value={formData.closes_at}
              onChange={handleDateChange}
              onBlur={() => validateAndCommitDatesOrRevert("closes_at")}
              style={styles.input}
              disabled={!isEditing || isBusy}
            />
          </div>
        </div>

        {/* Tempo de espera + Tipo de Voto (na mesma linha) */}
        <div style={styles.inlineFieldGroup}>
          <div style={{ ...styles.fieldGroup, width: 240, minWidth: 220 }}>
            <label style={styles.label}>Tempo de espera (segundos):</label>
            <input
              type="number"
              name="vote_cooldown_seconds"
              value={formData.vote_cooldown_seconds}
              onChange={handleCooldownChange}
              style={styles.input}
              min="0"
              disabled={!isEditing || isBusy}
            />
          </div>

          <div style={{ ...styles.fieldGroup, flex: 1, minWidth: 220 }}>
            <label style={styles.label}>Tipo de Voto:</label>
            <select
              name="voting_type"
              value={formData.voting_type}
              onChange={(e) => {
                const v = e.target.value as "single" | "ranking" | "multiple";
                setFormData((prev) => ({
                  ...prev,
                  voting_type: v,
                  max_options_per_vote:
                    v === "multiple"
                      ? Math.max(1, prev.max_options_per_vote)
                      : prev.max_options_per_vote,
                }));
              }}
              style={styles.select}
              disabled={!isEditing || isBusy}
            >
              <option value="single">Simples</option>
              <option value="ranking">Ranking</option>
              <option value="multiple">Múltipla</option>
            </select>
          </div>
        </div>

        {/* max_options_per_vote condicional (mantido) */}
        {formData.voting_type === "multiple" && (
          <div style={styles.inlineFieldGroup}>
            <div style={{ ...styles.fieldGroup, width: 240, minWidth: 220 }}>
              <label style={styles.label}>Máx. opções por voto:</label>
              <input
                type="number"
                name="max_options_per_vote"
                value={formData.max_options_per_vote}
                onChange={handleMaxOptionsPerVoteChange}
                style={styles.input}
                min={1}
                disabled={!isEditing || isBusy}
              />
            </div>
          </div>
        )}

        {/* Início + Término */}
        <div style={styles.inlineFieldGroup}>
          <div style={{ ...styles.fieldGroup, flex: 1, minWidth: 220 }}>
            <label style={styles.label}>Data de Início:</label>
            <input
              type="datetime-local"
              name="start_date"
              value={formData.start_date}
              onChange={handleDateChange}
              onBlur={() => validateAndCommitDatesOrRevert("start_date")}
              style={styles.input}
              min={minStartDatetimeLocal}
              required
              disabled={!isEditing || isBusy}
            />
          </div>

          <div style={{ ...styles.fieldGroup, flex: 1, minWidth: 220 }}>
            <label style={styles.label}>Data de Término:</label>
            <input
              type="datetime-local"
              name="end_date"
              value={formData.end_date}
              onChange={handleDateChange}
              onBlur={() => validateAndCommitDatesOrRevert("end_date")}
              style={styles.input}
              disabled={!isEditing || isBusy}
            />
          </div>
        </div>

        <div style={styles.fieldGroup}>
          <label style={styles.label}>
            Mostrar Resultados Parciais:
            <input
              type="checkbox"
              name="show_partial_results"
              checked={formData.show_partial_results}
              onChange={handleInputChange}
              style={styles.checkbox}
              disabled={!isEditing || isBusy}
            />
          </label>
        </div>

        <div style={styles.fieldGroup}>
          <label style={styles.label}>Nome do Ícone:</label>
          <input
            type="text"
            name="icon_name"
            value={formData.icon_name}
            onChange={handleInputChange}
            style={styles.input}
            placeholder="Digite o nome do ícone"
            disabled={!isEditing || isBusy}
          />
        </div>

        <div style={styles.fieldGroup}>
          <label style={styles.label}>URL do Ícone:</label>
          <input
            type="url"
            name="icon_url"
            value={formData.icon_url}
            onChange={handleInputChange}
            style={styles.input}
            placeholder="Digite a URL do ícone"
            disabled={!isEditing || isBusy}
          />
        </div>

        {/* Linha de ações: Limpar/Cadastrar/Salvar à esquerda e Admin à direita */}
        <div style={styles.actionsRow}>
          <div style={styles.buttonGroup}>
            {isEditMode && (
              <button
                type="button"
                onClick={handleSave}
                style={styles.button}
                disabled={!isEditing || isBusy}
              >
                {loading ? "Salvando..." : "Salvar"}
              </button>
            )}

            <button
              type="button"
              onClick={handleClearForm}
              style={styles.clearButton}
              disabled={isBusy}
            >
              Limpar
            </button>

            {!isEditMode && (
              <button type="submit" style={styles.primaryButton} disabled={isBusy}>
                {loading ? "Cadastrando..." : "Cadastrar"}
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() =>
              router.push(tokenFromUrl ? `/admin?token=${encodeURIComponent(tokenFromUrl)}` : "/admin")
            }
            style={styles.backButton}
            disabled={isBusy}
          >
            Admin
          </button>
        </div>

        {success && <p style={styles.success}>Operação realizada com sucesso!</p>}
        {error && <p style={styles.error}>{error}</p>}
      </form>

      <div style={styles.divider} />

      <h2 style={styles.sectionTitle}>Opções da Pesquisa</h2>

      {!isEditMode ? (
        <p style={styles.sectionHint}>
          Para cadastrar opções, abra uma pesquisa existente (modo edição).
        </p>
      ) : (
        <>
          <div style={styles.inlineOptionForm}>
            <div style={{ ...styles.fieldGroup, flex: 1 }}>
              <label style={styles.label}>Texto da opção:</label>
              <input
                type="text"
                value={optionText}
                onChange={(e) => setOptionText(e.target.value)}
                style={styles.input}
                placeholder="Ex.: Sim, Não, Talvez..."
                disabled={optionsLoading}
              />
            </div>

            <button
              type="button"
              onClick={handleCreateOption}
              style={styles.primaryButton}
              disabled={optionsLoading || !optionText.trim()}
            >
              {optionsLoading ? "Adicionando..." : "Adicionar Opção"}
            </button>
          </div>

          {optionsSuccess && <p style={styles.success}>Opção atualizada com sucesso!</p>}
          {optionsError && <p style={styles.error}>{optionsError}</p>}

          <div style={styles.optionsTableWrapper}>
            <h3 style={styles.subTitle}>Opções cadastradas</h3>

            {optionsLoading ? (
              <p style={styles.info}>Carregando opções...</p>
            ) : options.length === 0 ? (
              <p style={styles.info}>Nenhuma opção cadastrada.</p>
            ) : (
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Opção</th>
                    <th style={{ ...styles.th, width: 160 }}>Ações</th>
                  </tr>
                </thead>

                <tbody>
                  {options.map((opt) => {
                    const isEditingRow = editingOptionId === opt.id;

                    return (
                      <tr key={opt.id}>
                        <td style={styles.td}>
                          {isEditingRow ? (
                            <input
                              type="text"
                              value={editingOptionText}
                              onChange={(e) => setEditingOptionText(e.target.value)}
                              style={styles.input}
                              disabled={optionSaving || optionsLoading}
                            />
                          ) : (
                            opt.option_text
                          )}
                        </td>

                        <td style={styles.td}>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const }}>
                            {!isEditingRow ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => startEditOption(opt)}
                                  style={styles.iconButton}
                                  title="Editar"
                                  disabled={optionsLoading}
                                >
                                  ✏️
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleDeleteOption(opt)}
                                  style={styles.iconDangerButton}
                                  title="Excluir"
                                  disabled={optionsLoading}
                                >
                                  🗑️
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={handleSaveOption}
                                style={styles.iconSuccessButton}
                                title="Salvar"
                                disabled={optionSaving || !editingOptionText.trim()}
                              >
                                💾
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}

const styles = {
  container: {
    maxWidth: "600px",
    margin: "0 auto",
    padding: "20px",
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    backgroundColor: "#f9fafb",
    border: "1px solid #e5e7eb",
    borderRadius: "10px",
    boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
  },
  title: {
    fontSize: "24px",
    fontWeight: "bold",
    marginBottom: "10px",
    textAlign: "center" as const,
    color: "#1f2937",
  },
  modeInfo: {
    fontSize: "13px",
    color: "#374151",
    marginBottom: "8px",
    textAlign: "center" as const,
  },
  info: {
    fontSize: "14px",
    color: "#374151",
    textAlign: "center" as const,
    marginBottom: "10px",
  },
  form: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "15px",
  },
  fieldGroup: {
    display: "flex",
    flexDirection: "column" as const,
    minWidth: 0,
  },
  inlineFieldGroup: {
    display: "flex",
    justifyContent: "space-between",
    gap: "14px",
    alignItems: "flex-end",
    flexWrap: "wrap" as const,
  },
  label: {
    fontSize: "14px",
    fontWeight: "bold",
    color: "#374151",
    marginBottom: "5px",
  },
  input: {
    padding: "10px",
    fontSize: "14px",
    border: "1px solid #d1d5db",
    borderRadius: "5px",
    backgroundColor: "#fff",
  },
  // Campo título um pouco maior
  titleInput: {
    padding: "12px",
    fontSize: "16px",
    border: "1px solid #d1d5db",
    borderRadius: "6px",
    backgroundColor: "#fff",
  },
  textarea: {
    padding: "10px",
    fontSize: "14px",
    border: "1px solid #d1d5db",
    borderRadius: "5px",
    backgroundColor: "#fff",
    minHeight: "80px",
    resize: "none" as const,
  },
  select: {
    padding: "10px",
    fontSize: "14px",
    border: "1px solid #d1d5db",
    borderRadius: "5px",
    backgroundColor: "#fff",
  },
  checkbox: { marginLeft: "10px" },
  buttonGroup: { display: "flex", gap: "10px", flexWrap: "wrap" as const },
  button: {
    padding: "10px",
    fontSize: "14px",
    color: "#fff",
    backgroundColor: "#3b82f6",
    border: "none",
    borderRadius: "5px",
    fontWeight: "bold",
    cursor: "pointer",
  },
  primaryButton: {
    padding: "10px",
    fontSize: "14px",
    color: "#fff",
    backgroundColor: "#16a34a",
    border: "none",
    borderRadius: "5px",
    fontWeight: "bold",
    cursor: "pointer",
  },
  clearButton: {
    padding: "10px",
    fontSize: "14px",
    color: "#fff",
    backgroundColor: "#f43f5e",
    border: "none",
    borderRadius: "5px",
    fontWeight: "bold",
    cursor: "pointer",
  },
  backButton: {
    padding: "10px",
    fontSize: "14px",
    color: "#fff",
    backgroundColor: "#6b7280",
    border: "none",
    borderRadius: "5px",
    fontWeight: "bold",
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
  },

  // Ações: esquerda (Salvar/Limpar/Cadastrar) e direita (Admin)
  actionsRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    flexWrap: "wrap" as const,
    marginTop: "4px",
  },

  iconButton: {
    width: "38px",
    height: "38px",
    borderRadius: "8px",
    border: "1px solid #d1d5db",
    backgroundColor: "#fff",
    cursor: "pointer",
    fontSize: "18px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  iconSuccessButton: {
    width: "38px",
    height: "38px",
    borderRadius: "8px",
    border: "1px solid #16a34a",
    backgroundColor: "#dcfce7",
    cursor: "pointer",
    fontSize: "18px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  iconDangerButton: {
    width: "38px",
    height: "38px",
    borderRadius: "8px",
    border: "1px solid #f43f5e",
    backgroundColor: "#ffe4e6",
    cursor: "pointer",
    fontSize: "18px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },

  success: { color: "green", fontSize: "14px", textAlign: "center" as const },
  error: { color: "red", fontSize: "14px", textAlign: "center" as const },

  divider: { height: 1, backgroundColor: "#e5e7eb", margin: "24px 0" },
  sectionTitle: { fontSize: "18px", fontWeight: "bold", color: "#111827" },
  sectionHint: { fontSize: "14px", color: "#4b5563", marginBottom: "14px" },
  inlineOptionForm: {
    display: "flex",
    gap: "10px",
    alignItems: "flex-end",
    flexWrap: "wrap" as const,
    marginBottom: "10px",
  },
  optionsTableWrapper: {
    marginTop: "10px",
    backgroundColor: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    padding: "12px",
  },
  subTitle: {
    margin: "0 0 10px 0",
    fontSize: "14px",
    fontWeight: "bold",
    color: "#374151",
  },
  table: { width: "100%", borderCollapse: "collapse" as const },
  th: {
    textAlign: "left" as const,
    fontSize: "13px",
    padding: "8px",
    borderBottom: "1px solid #e5e7eb",
    color: "#374151",
  },
  td: {
    fontSize: "13px",
    padding: "8px",
    borderBottom: "1px solid #f3f4f6",
    color: "#111827",
    wordBreak: "break-word" as const,
  },
} as const;

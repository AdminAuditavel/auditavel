//app/admin/poll-registration/PollRegistrationClient.tsx

"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type PollPayload = {
  id?: string;
  title?: string | null;
  description?: string | null;
  type?: string | null;
  status?: string | null;
  allow_multiple?: boolean | null;
  max_votes_per_user?: number | null;
  allow_custom_option?: boolean | null;
  created_at?: string | null;
  closes_at?: string | null;
  vote_cooldown_seconds?: number | null;
  voting_type?: string | null;
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
    type: "binary",
    status: "open",
    allow_multiple: false,
    max_votes_per_user: 1 as number | "",
    allow_custom_option: false,
    created_at: nowDatetimeLocal(),
    closes_at: "",
    vote_cooldown_seconds: 10,
    voting_type: "single",
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

        // ✅ CORREÇÃO APLICADA AQUI (tipagem + remoção de campos obsoletos)
        const nextForm: typeof formData = {
          title: poll.title ?? "",
          description: poll.description ?? "",
          status: poll.status ?? "open",
          allow_multiple: Boolean(poll.allow_multiple ?? false),
          max_votes_per_user:
            typeof poll.max_votes_per_user === "number"
              ? poll.max_votes_per_user
              : 1,
          created_at: toDatetimeLocal(poll.created_at) || nowDatetimeLocal(),
          closes_at: toDatetimeLocal(poll.closes_at),
          vote_cooldown_seconds:
            typeof poll.vote_cooldown_seconds === "number"
              ? poll.vote_cooldown_seconds
              : 10,
          voting_type: poll.voting_type ?? "single",
          start_date: toDatetimeLocal(poll.start_date) || nowDatetimeLocal(),
          end_date: toDatetimeLocal(poll.end_date),
          show_partial_results:
            typeof poll.show_partial_results === "boolean"
              ? poll.show_partial_results
              : true,
          icon_name: poll.icon_name ?? "",
          icon_url: poll.icon_url ?? "",
        };

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
        
        /* =======================
           allow_multiple (SELECT)
        ======================= */
        const handleAllowMultipleSelectChange = (
        e: React.ChangeEvent<HTMLSelectElement>
        ) => {
        const allow = e.target.value === "yes";
        
        setFormData((prev) => {
          if (!allow) {
            return {
              ...prev,
              allow_multiple: false,
              max_votes_per_user: 1,
            };
          }
        
          const current = prev.max_votes_per_user;
          const next =
            typeof current === "number" && current >= 2 ? current : 2;
        
          return {
            ...prev,
            allow_multiple: true,
            max_votes_per_user: next,
          };
        });
        };
        
        const validateVotesConfigOrThrow = (data: typeof formData) => {
        if (!data.allow_multiple) {
          return { ...data, max_votes_per_user: 1 as const };
        }
        
        if (data.max_votes_per_user === "") {
          throw new Error("Digite o máximo de votos por usuário (mínimo 2).");
        }
        
        const n = Number(data.max_votes_per_user);
        if (!Number.isFinite(n) || n < 2) {
          throw new Error("O máximo de votos por usuário deve ser 2 ou mais.");
        }
        
        return { ...data, max_votes_per_user: n };
        };
        
        // ===== Datas: onChange só atualiza (permite digitação parcial).
        const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        
        setFormData((prev) => ({
          ...prev,
          [name]: value,
        }));
        };

    // ===== Datas: valida no onBlur e reverte para último válido se necessário.
  const validateAndCommitDatesOrRevert = (
    field: "start_date" | "end_date" | "closes_at"
  ) => {
    const value = formData[field];
  
    // end_date/closes_at são opcionais (permitir limpar)
    if ((field === "end_date" || field === "closes_at") && !value) {
      setError("");
      setLastValidDates((prev) => ({ ...prev, [field]: "" }));
      return;
    }
  
    // start_date é obrigatório (não permitir vazio)
    if (field === "start_date" && !value) {
      setError("Preencha a data de início (start_date).");
      setFormData((prev) => ({
        ...prev,
        start_date: lastValidDates.start_date,
      }));
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
      setFormData((prev) => ({ ...prev, [field]: lastValidDates[field] }));
      return;
    }
  
    const createdAt = new Date(formData.created_at);
    const startDate = formData.start_date
      ? new Date(formData.start_date)
      : null;
    const endDate = formData.end_date ? new Date(formData.end_date) : null;
    const closesAt = formData.closes_at
      ? new Date(formData.closes_at)
      : null;
  
    // Regras auditáveis
    if (
      !Number.isNaN(createdAt.getTime()) &&
      ((startDate && startDate < createdAt) ||
        (endDate && endDate < createdAt) ||
        (closesAt && closesAt < createdAt))
    ) {
      setError("Datas não podem ser anteriores à data de criação.");
      setFormData((prev) => ({ ...prev, [field]: lastValidDates[field] }));
      return;
    }
  
    // coerência entre datas
    if (startDate && endDate && endDate < startDate) {
      setError("A data de término não pode ser anterior à data de início.");
      setFormData((prev) => ({ ...prev, [field]: lastValidDates[field] }));
      return;
    }
  
    if (startDate && closesAt && closesAt < startDate) {
      setError("A data de encerramento não pode ser anterior à data de início.");
      setFormData((prev) => ({ ...prev, [field]: lastValidDates[field] }));
      return;
    }
  
    if (endDate && closesAt && closesAt < endDate) {
      setError("A data de encerramento não pode ser anterior à data de término.");
      setFormData((prev) => ({ ...prev, [field]: lastValidDates[field] }));
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
        throw new Error(
          "A data de início não pode ser menor que agora. Ajuste e confirme."
        );
      }
  
      const ok = window.confirm(
        `Confirmar início da votação em:\n\n${formatPtBrDateTime(startRaw)} ?`
      );
      if (!ok) {
        setLoading(false);
        return;
      }
  
      const payload = validateVotesConfigOrThrow(formData);
  
      const startISO = datetimeLocalToISOOrNull(payload.start_date);
      if (!startISO) throw new Error("Data de início inválida.");
  
      const endISO = datetimeLocalToISOOrNull(payload.end_date);
      const closesISO = datetimeLocalToISOOrNull(payload.closes_at);
  
      const { created_at: _createdAt, ...payloadWithoutCreatedAt } = payload;
  
      const response = await fetch(`/api/admin/create-poll?${adminTokenQuery}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payloadWithoutCreatedAt,
          start_date: startISO,
          end_date: endISO,
          closes_at: closesISO,
        }),
      });
  
      const data = await response.json().catch(() => null);
  
      if (!response.ok) {
        throw new Error(
          data?.message || data?.error || "Falha ao criar pesquisa."
        );
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
  
    if (raw === "") {
      setFormData((prevData) => ({
        ...prevData,
        max_votes_per_user: "",
      }));
      return;
    }
  
    const value = parseInt(raw, 10);
    if (!Number.isFinite(value)) return;
  
    setFormData((prevData) => ({
      ...prevData,
      max_votes_per_user: Math.max(2, value),
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
  
      const payload = validateVotesConfigOrThrow(formData);
  
      const startISO = datetimeLocalToISOOrNull(payload.start_date);
      if (!startISO) throw new Error("Data de início inválida.");
  
      const endISO = datetimeLocalToISOOrNull(payload.end_date);
      const closesISO = datetimeLocalToISOOrNull(payload.closes_at);
  
      const { created_at: _createdAt, ...payloadWithoutCreatedAt } = payload;
  
      const res = await fetch(
        `/api/admin/polls/${encodeURIComponent(
          pollIdFromUrl
        )}?${adminTokenQuery}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...payloadWithoutCreatedAt,
            start_date: startISO,
            end_date: endISO,
            closes_at: closesISO,
          }),
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
        `/api/admin/polls/${encodeURIComponent(
          pollIdFromUrl
        )}/options?${adminTokenQuery}`,
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
        `/api/admin/polls/${encodeURIComponent(
          pollIdFromUrl
        )}/options/${encodeURIComponent(editingOptionId)}?${adminTokenQuery}`,
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
        `/api/admin/polls/${encodeURIComponent(
          pollIdFromUrl
        )}/options/${encodeURIComponent(opt.id)}?${adminTokenQuery}`,
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
    <h1 style={styles.title}>
      {isEditMode ? "Editar Pesquisa" : "Cadastro de Pesquisas"}
    </h1>

    {isEditMode && (
      <p style={styles.modeInfo}>
        ID da pesquisa: <strong>{pollIdFromUrl}</strong>
      </p>
    )}

    <div style={styles.topActions}>
      <button
        type="button"
        onClick={() =>
          router.push(
            tokenFromUrl ? `/admin?token=${encodeURIComponent(tokenFromUrl)}` : "/admin"
          )
        }
        style={styles.backButton}
        disabled={isBusy}
      >
        Admin
      </button>
    </div>

    {loadingPoll && <p style={styles.info}>Carregando dados da pesquisa...</p>}

    <form onSubmit={handleFormSubmit} style={styles.form}>
      <div style={styles.fieldGroup}>
        <label style={styles.label}>Título:</label>
        <input
          type="text"
          name="title"
          value={formData.title}
          onChange={handleInputChange}
          style={styles.input}
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
          required
          disabled={!isEditing || isBusy}
        />
      </div>

      <div style={styles.inlineFieldGroup}>
        <div style={styles.fieldGroup}>
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

        <div style={styles.fieldGroup}>
          <label style={styles.label}>Permitir mais de um voto?</label>
          <select
            name="allow_multiple"
            value={formData.allow_multiple ? "yes" : "no"}
            onChange={(e) =>
              handleAllowMultipleChange({
                ...e,
                target: {
                  ...e.target,
                  checked: e.target.value === "yes",
                },
              } as any)
            }
            style={styles.select}
            disabled={!isEditing || isBusy}
          >
            <option value="no">Não</option>
            <option value="yes">Sim</option>
          </select>
        </div>

        <div style={styles.fieldGroup}>
          <label style={styles.label}>Máximo de Votos por Usuário:</label>
          <input
            type="number"
            name="max_votes_per_user"
            value={formData.max_votes_per_user as any}
            onChange={handleMaxVotesChange}
            style={styles.input}
            min={formData.allow_multiple ? 2 : 1}
            disabled={!isEditing || isBusy || !formData.allow_multiple}
          />
        </div>
      </div>

      <div style={styles.fieldGroup}>
        <label style={styles.label}>Tempo de Cooldown (segundos):</label>
        <input
          type="number"
          name="vote_cooldown_seconds"
          value={formData.vote_cooldown_seconds}
          onChange={handleCooldownChange}
          style={styles.input}
          min={0}
          disabled={!isEditing || isBusy}
        />
      </div>

      <div style={styles.inlineFieldGroup}>
        <div style={styles.fieldGroup}>
          <label style={styles.label}>Tipo de Votação:</label>
          <select
            name="voting_type"
            value={formData.voting_type}
            onChange={handleInputChange}
            style={styles.select}
            disabled={!isEditing || isBusy}
          >
            <option value="single">Simples</option>
            <option value="ranking">Ranking</option>
            <option value="multiple">Múltipla</option>
          </select>
        </div>

        {formData.voting_type === "multiple" && (
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Máx. opções por voto:</label>
            <input
              type="number"
              name="max_options_per_vote"
              value={(formData as any).max_options_per_vote ?? ""}
              onChange={handleInputChange}
              style={styles.input}
              min={1}
              disabled={!isEditing || isBusy}
            />
          </div>
        )}
      </div>

      <div style={styles.inlineFieldGroup}>
        <div style={styles.fieldGroup}>
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

        <div style={styles.fieldGroup}>
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

      <div style={styles.buttonGroup}>
        {isEditMode && (
          <button
            type="button"
            onClick={handleSave}
            style={styles.button}
            disabled={!isEditing || isBusy}
          >
            Salvar
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
            Cadastrar
          </button>
        )}
      </div>

      {success && <p style={styles.success}>Operação realizada com sucesso!</p>}
      {error && <p style={styles.error}>{error}</p>}
    </form>
  </div>
);

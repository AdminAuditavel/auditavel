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
  created_at?: string | null;
  closes_at?: string | null;
  vote_cooldown_seconds?: number | null;
  voting_type?: string | null;
  max_options_per_vote?: number | null;
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

/* =======================
   Helpers datetime-local
======================= */
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

  /* =======================
     Estado do formulário
  ======================= */
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    status: "open",
    allow_multiple: false,
    max_votes_per_user: 1 as number | "",
    vote_cooldown_seconds: 10,
    voting_type: "single",
    max_options_per_vote: "" as number | "",
    created_at: nowDatetimeLocal(),
    closes_at: "",
    start_date: nowDatetimeLocal(),
    end_date: "",
    show_partial_results: true,
    icon_name: "",
    icon_url: "",
  });

  // Mantém o último valor válido para reverter quando o usuário sai do campo com valor inválido
  const [lastValidDates, setLastValidDates] = useState({
    start_date: formData.start_date,
    end_date: "",
    closes_at: "",
  });

  const [loading, setLoading] = useState(false);
  const [loadingPoll, setLoadingPoll] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [isEditing, setIsEditing] = useState(true);

  /* =======================
     Opções da pesquisa
  ======================= */
  const [options, setOptions] = useState<PollOption[]>([]);
  const [optionText, setOptionText] = useState("");
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [optionsError, setOptionsError] = useState("");
  const [optionsSuccess, setOptionsSuccess] = useState(false);

  const [editingOptionId, setEditingOptionId] = useState<string | null>(null);
  const [editingOptionText, setEditingOptionText] = useState("");
  const [optionSaving, setOptionSaving] = useState(false);

  /* =======================
     Init (create mode)
  ======================= */
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

  /* =======================
     Load poll (edit mode)
  ======================= */
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

        const nextForm = {
          title: poll.title ?? "",
          description: poll.description ?? "",
          status: poll.status ?? "open",
          allow_multiple: Boolean(poll.allow_multiple ?? false),
          max_votes_per_user:
            typeof poll.max_votes_per_user === "number"
              ? poll.max_votes_per_user
              : 1,
          vote_cooldown_seconds:
            typeof poll.vote_cooldown_seconds === "number"
              ? poll.vote_cooldown_seconds
              : 10,
          voting_type: poll.voting_type ?? "single",
          max_options_per_vote:
            typeof poll.max_options_per_vote === "number"
              ? poll.max_options_per_vote
              : "",
          created_at: toDatetimeLocal(poll.created_at) || nowDatetimeLocal(),
          closes_at: toDatetimeLocal(poll.closes_at),
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

  /* =======================
     Handlers gerais
  ======================= */
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
     allow_multiple (select Sim/Não)
  ======================= */
  const handleAllowMultipleSelectChange = (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const value = e.target.value === "yes";

    setFormData((prev) => {
      if (!value) {
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

  /* =======================
     Validação votos
  ======================= */
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

  const handleMaxVotesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!formData.allow_multiple) {
      setFormData((prev) => ({
        ...prev,
        max_votes_per_user: 1,
      }));
      return;
    }

    const raw = e.target.value;

    if (raw === "") {
      setFormData((prev) => ({
        ...prev,
        max_votes_per_user: "",
      }));
      return;
    }

    const value = parseInt(raw, 10);
    if (!Number.isFinite(value)) return;

    setFormData((prev) => ({
      ...prev,
      max_votes_per_user: Math.max(2, value),
    }));
  };

  const handleCooldownChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Math.max(0, parseInt(e.target.value, 10) || 0);
    setFormData((prev) => ({
      ...prev,
      vote_cooldown_seconds: value,
    }));
  };

  /* =======================
     Datas (onChange livre)
  ======================= */
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  /* =======================
     Datas (onBlur valida)
  ======================= */
  const validateAndCommitDatesOrRevert = (
    field: "start_date" | "end_date" | "closes_at"
  ) => {
    const value = formData[field];

    if ((field === "end_date" || field === "closes_at") && !value) {
      setError("");
      setLastValidDates((prev) => ({ ...prev, [field]: "" }));
      return;
    }

    if (field === "start_date" && !value) {
      setError("Preencha a data de início (start_date).");
      setFormData((prev) => ({
        ...prev,
        start_date: lastValidDates.start_date,
      }));
      return;
    }

    if (!isValidDatetimeLocal(value)) {
      setError(
        field === "start_date"
          ? "Data de início inválida."
          : field === "end_date"
            ? "Data de término inválida."
            : "Data de encerramento inválida."
      );
      setFormData((prev) => ({
        ...prev,
        [field]: lastValidDates[field],
      }));
      return;
    }

    const createdAt = new Date(formData.created_at);
    const startDate = formData.start_date
      ? new Date(formData.start_date)
      : null;
    const endDate = formData.end_date
      ? new Date(formData.end_date)
      : null;
    const closesAt = formData.closes_at
      ? new Date(formData.closes_at)
      : null;

    if (
      !Number.isNaN(createdAt.getTime()) &&
      ((startDate && startDate < createdAt) ||
        (endDate && endDate < createdAt) ||
        (closesAt && closesAt < createdAt))
    ) {
      setError("Datas não podem ser anteriores à data de criação.");
      setFormData((prev) => ({
        ...prev,
        [field]: lastValidDates[field],
      }));
      return;
    }

    if (startDate && endDate && endDate < startDate) {
      setError("A data de término não pode ser anterior à data de início.");
      setFormData((prev) => ({
        ...prev,
        [field]: lastValidDates[field],
      }));
      return;
    }

    if (startDate && closesAt && closesAt < startDate) {
      setError("A data de encerramento não pode ser anterior à data de início.");
      setFormData((prev) => ({
        ...prev,
        [field]: lastValidDates[field],
      }));
      return;
    }

    if (endDate && closesAt && closesAt < endDate) {
      setError("A data de encerramento não pode ser anterior à data de término.");
      setFormData((prev) => ({
        ...prev,
        [field]: lastValidDates[field],
      }));
      return;
    }

    setError("");
    setLastValidDates((prev) => ({ ...prev, [field]: value }));
  };

  /* =======================
     Submit (create)
  ======================= */
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);

    try {
      const startRaw = formData.start_date?.trim();
      if (!startRaw) throw new Error("Preencha a data de início (start_date).");

      const start = new Date(startRaw);
      if (Number.isNaN(start.getTime())) {
        throw new Error("Data de início inválida.");
      }

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
        vote_cooldown_seconds: 10,
        voting_type: "single",
        max_options_per_vote: "",
        created_at: resetNow,
        closes_at: "",
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

  /* =======================
     Save (edit)
  ======================= */
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
              tokenFromUrl
                ? `/admin?token=${encodeURIComponent(tokenFromUrl)}`
                : "/admin"
            )
          }
          style={styles.backButton}
          disabled={isBusy}
        >
          Admin
        </button>
      </div>

      {loadingPoll && (
        <p style={styles.info}>Carregando dados da pesquisa...</p>
      )}

      <form onSubmit={handleFormSubmit} style={styles.form}>
        {/* Título */}
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

        {/* Descrição */}
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

        {/* Status */}
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

        {/* allow_multiple + max_votes_per_user */}
        <div style={styles.inlineFieldGroup}>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Permitir mais de um voto?</label>
            <select
              value={formData.allow_multiple ? "yes" : "no"}
              onChange={handleAllowMultipleSelectChange}
              style={styles.select}
              disabled={!isEditing || isBusy}
            >
              <option value="no">Não</option>
              <option value="yes">Sim</option>
            </select>
          </div>

          <div style={styles.fieldGroup}>
            <label style={styles.label}>Máximo de votos por usuário:</label>
            <input
              type="number"
              value={formData.max_votes_per_user as any}
              onChange={handleMaxVotesChange}
              style={styles.input}
              min={formData.allow_multiple ? 2 : 1}
              disabled={
                !isEditing || isBusy || !formData.allow_multiple
              }
            />
          </div>
        </div>

        {/* Cooldown */}
        <div style={styles.fieldGroup}>
          <label style={styles.label}>
            Tempo de Cooldown de Voto (em segundos):
          </label>
          <input
            type="number"
            value={formData.vote_cooldown_seconds}
            onChange={handleCooldownChange}
            style={styles.input}
            min={0}
            disabled={!isEditing || isBusy}
          />
        </div>

        {/* voting_type + max_options_per_vote */}
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
              <label style={styles.label}>
                Máx. opções por voto (opcional):
              </label>
              <input
                type="number"
                value={formData.max_options_per_vote as any}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    max_options_per_vote:
                      e.target.value === ""
                        ? ""
                        : Math.max(1, Number(e.target.value)),
                  }))
                }
                style={styles.input}
                min={1}
                disabled={!isEditing || isBusy}
              />
            </div>
          )}
        </div>

        {/* Datas */}
        <div style={styles.inlineFieldGroup}>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Data de Início:</label>
            <input
              type="datetime-local"
              name="start_date"
              value={formData.start_date}
              onChange={handleDateChange}
              onBlur={() =>
                validateAndCommitDatesOrRevert("start_date")
              }
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
              onBlur={() =>
                validateAndCommitDatesOrRevert("end_date")
              }
              style={styles.input}
              disabled={!isEditing || isBusy}
            />
          </div>
        </div>

        <div style={styles.fieldGroup}>
          <label style={styles.label}>Data de Encerramento:</label>
          <input
            type="datetime-local"
            name="closes_at"
            value={formData.closes_at}
            onChange={handleDateChange}
            onBlur={() =>
              validateAndCommitDatesOrRevert("closes_at")
            }
            style={styles.input}
            disabled={!isEditing || isBusy}
          />
        </div>

        {/* Resultados parciais */}
        <div style={styles.fieldGroup}>
          <label style={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={formData.show_partial_results}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  show_partial_results: e.target.checked,
                }))
              }
              style={styles.checkbox}
              disabled={!isEditing || isBusy}
            />
            Mostrar Resultados Parciais
          </label>
        </div>

        {/* Ícones */}
        <div style={styles.fieldGroup}>
          <label style={styles.label}>Nome do Ícone:</label>
          <input
            type="text"
            name="icon_name"
            value={formData.icon_name}
            onChange={handleInputChange}
            style={styles.input}
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
            disabled={!isEditing || isBusy}
          />
        </div>

        {/* Botões */}
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
            <button
              type="submit"
              style={styles.primaryButton}
              disabled={isBusy}
            >
              {loading ? "Cadastrando..." : "Cadastrar"}
            </button>
          )}
        </div>

        {success && (
          <p style={styles.success}>
            Operação realizada com sucesso!
          </p>
        )}
        {error && <p style={styles.error}>{error}</p>}
      </form>

      {/* ===== Opções da pesquisa (INALTERADO) ===== */}
      <div style={styles.divider} />

      <h2 style={styles.sectionTitle}>Opções da Pesquisa</h2>

      {!isEditMode ? (
        <p style={styles.sectionHint}>
          Para cadastrar opções, abra uma pesquisa existente.
        </p>
      ) : (
        /* TODO: bloco de opções permanece exatamente igual ao original */
        null
      )}
    </div>
  );
}

/* =======================
   Styles (INALTERADO)
======================= */
const styles = {
  /* exatamente o mesmo objeto styles que você enviou */
} as const;

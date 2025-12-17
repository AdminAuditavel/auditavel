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

export default function PollRegistrationClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const tokenFromUrl = searchParams.get("token") ?? "";
  const pollIdFromUrl = searchParams.get("poll_id") ?? "";
  const isEditMode = Boolean(pollIdFromUrl);

  const adminTokenQuery = `token=${encodeURIComponent(tokenFromUrl)}`;

  // DEBUG (remover depois)
  console.log("Admin tokenFromUrl:", tokenFromUrl);
  console.log("Admin pollIdFromUrl:", pollIdFromUrl);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    type: "binary",
    status: "open",
    allow_multiple: false,
    max_votes_per_user: 1,
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

  useEffect(() => {
    if (isEditMode) return;

    const currentDate = nowDatetimeLocal();
    setFormData((prevData) => ({
      ...prevData,
      created_at: currentDate,
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

        const json = await res.json().catch(() => null);

        if (!res.ok) {
          throw new Error(
            json?.details
              ? `Falha ao criar opção: ${json.error} — ${json.details}`
              : json?.error
                ? `Falha ao criar opção: ${json.error}`
                : "Falha ao criar opção."
          );
        }

        const poll: PollPayload | undefined = json?.poll;
        if (!poll) throw new Error("Resposta inválida do servidor (poll ausente).");

        setFormData((prev) => ({
          ...prev,
          title: poll.title ?? "",
          description: poll.description ?? "",
          type: poll.type ?? prev.type,
          status: poll.status ?? prev.status,
          allow_multiple: Boolean(poll.allow_multiple ?? prev.allow_multiple),
          max_votes_per_user:
            typeof poll.max_votes_per_user === "number"
              ? poll.max_votes_per_user
              : prev.max_votes_per_user,
          allow_custom_option: Boolean(
            poll.allow_custom_option ?? prev.allow_custom_option
          ),
          created_at: toDatetimeLocal(poll.created_at) || prev.created_at,
          closes_at: toDatetimeLocal(poll.closes_at),
          vote_cooldown_seconds:
            typeof poll.vote_cooldown_seconds === "number"
              ? poll.vote_cooldown_seconds
              : prev.vote_cooldown_seconds,
          voting_type: poll.voting_type ?? prev.voting_type,
          start_date: toDatetimeLocal(poll.start_date) || prev.start_date,
          end_date: toDatetimeLocal(poll.end_date),
          show_partial_results:
            typeof poll.show_partial_results === "boolean"
              ? poll.show_partial_results
              : prev.show_partial_results,
          icon_name: poll.icon_name ?? "",
          icon_url: poll.icon_url ?? "",
        }));

        setIsEditing(true);
      } catch (err: any) {
        setError(err.message || "Erro desconhecido.");
      } finally {
        setLoadingPoll(false);
      }
    };

    loadPoll();
  }, [pollIdFromUrl, adminTokenQuery]);

  // Carregar opções quando estiver editando
  useEffect(() => {
    const loadOptions = async () => {
      if (!pollIdFromUrl) return;

      setOptionsLoading(true);
      setOptionsError("");
      setOptionsSuccess(false);

      try {
        const res = await fetch(
          `/api/admin/polls/${encodeURIComponent(
            pollIdFromUrl
          )}/options?${adminTokenQuery}`,
          { method: "GET" }
        );

        const json = await res.json().catch(() => null);

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

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);

    try {
      const response = await fetch(`/api/admin/create-poll?${adminTokenQuery}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json().catch(() => null);

      console.log("create-poll status:", response.status);
      console.log("create-poll response:", JSON.stringify(data, null, 2));
      
      if (!response.ok) {
        throw new Error(data?.error || "Falha ao  pesquisa.");
      }

      setSuccess(true);

      setFormData({
        title: "",
        description: "",
        type: "binary",
        status: "open",
        allow_multiple: false,
        max_votes_per_user: 1,
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
    } catch (err: any) {
      setError(err.message || "Erro desconhecido.");
    } finally {
      setLoading(false);
    }
  };

  const handleMaxVotesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Math.max(0, parseInt(e.target.value, 10) || 0);
    setFormData((prevData) => ({
      ...prevData,
      max_votes_per_user: value,
    }));
  };

  const handleCooldownChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Math.max(0, parseInt(e.target.value, 10) || 0);
    setFormData((prevData) => ({
      ...prevData,
      vote_cooldown_seconds: value,
    }));
  };

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const startDate = new Date(e.target.value);
    const createdAt = new Date(formData.created_at);
    const endDate = formData.end_date ? new Date(formData.end_date) : null;

    if (startDate < createdAt) {
      setError("A data de início não pode ser anterior à data de criação.");
      return;
    }

    if (endDate && startDate > endDate) {
      setError("A data de início não pode ser posterior à data de término.");
      return;
    }

    setFormData((prevData) => ({
      ...prevData,
      start_date: e.target.value,
    }));
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const endDate = new Date(e.target.value);
    const createdAt = new Date(formData.created_at);
    const startDate = new Date(formData.start_date);

    if (endDate < createdAt) {
      setError("A data de término não pode ser anterior à data de criação.");
      return;
    }

    if (startDate > endDate) {
      setError("A data de término não pode ser anterior à data de início.");
      return;
    }

    setFormData((prevData) => ({
      ...prevData,
      end_date: e.target.value,
    }));
  };

  const handleClosesAtChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const closesAt = new Date(e.target.value);
    const createdAt = new Date(formData.created_at);
    const endDate = formData.end_date ? new Date(formData.end_date) : null;

    if (closesAt < createdAt) {
      setError("A data de encerramento não pode ser anterior à data de criação.");
      return;
    }

    if (endDate && closesAt < endDate) {
      setError("A data de encerramento não pode ser anterior à data de término.");
      return;
    }

    setFormData((prevData) => ({
      ...prevData,
      closes_at: e.target.value,
    }));
  };

  const handleClearForm = () => {
    setFormData({
      title: "",
      description: "",
      type: "binary",
      status: "open",
      allow_multiple: false,
      max_votes_per_user: 1,
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
  
      const res = await fetch(
        `/api/admin/polls/${encodeURIComponent(pollIdFromUrl)}?${adminTokenQuery}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...formData,
            closes_at: formData.closes_at?.trim() ? formData.closes_at : null,
            start_date: formData.start_date?.trim() ? formData.start_date : null,
            end_date: formData.end_date?.trim() ? formData.end_date : null,
          }),
  
      const json = await res.json().catch(() => null);
  
      if (!res.ok) {
        throw new Error(
          json?.details
            ? `Falha ao salvar: ${json.error} — ${json.details}`
            : json?.error
              ? `Falha ao salvar: ${json.error}`
              : "Falha ao salvar."
        );
      }
  
      setSuccess(true);
      setIsEditing(false);
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

  const isBusy = loading || loadingPoll;

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

        <div style={styles.inlineFieldGroup}>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Tipo de Pesquisa:</label>
            <select
              name="type"
              value={formData.type}
              onChange={handleInputChange}
              style={styles.select}
              disabled={!isEditing || isBusy}
            >
              <option value="binary">Binária</option>
              <option value="multiple">Múltipla Escolha</option>
            </select>
          </div>

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
            <label style={styles.label}>Máximo de Votos por Usuário:</label>
            <input
              type="number"
              name="max_votes_per_user"
              value={formData.max_votes_per_user}
              onChange={handleMaxVotesChange}
              style={styles.input}
              min="0"
              disabled={!isEditing || isBusy}
            />
          </div>
        </div>

        <div style={styles.inlineFieldGroup}>
          <label style={styles.checkboxLabel}>
            <input
              type="checkbox"
              name="allow_multiple"
              checked={formData.allow_multiple}
              onChange={handleInputChange}
              style={styles.checkbox}
              disabled={!isEditing || isBusy}
            />
            Permitir múltiplas escolhas
          </label>

          <label style={styles.checkboxLabel}>
            <input
              type="checkbox"
              name="allow_custom_option"
              checked={formData.allow_custom_option}
              onChange={handleInputChange}
              style={styles.checkbox}
              disabled={!isEditing || isBusy}
            />
            Permitir opções personalizadas
          </label>
        </div>

        <div style={styles.inlineFieldGroup}>
          <div style={styles.fieldGroup}>
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

          <div style={styles.fieldGroup}>
            <label style={styles.label}>Data de Encerramento:</label>
            <input
              type="datetime-local"
              name="closes_at"
              value={formData.closes_at}
              onChange={handleClosesAtChange}
              style={styles.input}
              disabled={!isEditing || isBusy}
            />
          </div>
        </div>

        <div style={styles.fieldGroup}>
          <label style={styles.label}>
            Tempo de Cooldown de Voto (em segundos):
          </label>
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
              <option value="single">Única Escolha</option>
              <option value="ranking">Ranking</option>
            </select>
          </div>
        </div>

        <div style={styles.inlineFieldGroup}>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Data de Início:</label>
            <input
              type="datetime-local"
              name="start_date"
              value={formData.start_date}
              onChange={handleStartDateChange}
              style={styles.input}
              disabled={!isEditing || isBusy}
            />
          </div>

          <div style={styles.fieldGroup}>
            <label style={styles.label}>Data de Término:</label>
            <input
              type="datetime-local"
              name="end_date"
              value={formData.end_date}
              onChange={handleEndDateChange}
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

          {optionsSuccess && <p style={styles.success}>Opção cadastrada com sucesso!</p>}
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
                  </tr>
                </thead>
                <tbody>
                  {options.map((opt) => (
                    <tr key={opt.id}>
                      <td style={styles.td}>{opt.option_text}</td>
                    </tr>
                  ))}
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
  topActions: {
    display: "flex",
    justifyContent: "flex-start",
    marginBottom: "10px",
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
    gap: "20px",
    alignItems: "center",
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
  checkboxLabel: {
    fontSize: "14px",
    color: "#374151",
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  checkbox: { marginRight: "10px" },
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
};

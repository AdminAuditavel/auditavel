"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type PollFormData = {
  title: string;
  description: string;
  type: string;
  status: string;
  allow_multiple: boolean;
  max_votes_per_user: number;
  allow_custom_option: boolean;
  created_at: string;
  closes_at: string;
  vote_cooldown_seconds: number;
  voting_type: string;
  start_date: string;
  end_date: string;
  show_partial_results: boolean;
  icon_name: string;
  icon_url: string;
};

type PollOptionRow = {
  id?: string; // pode vir da API; localmente pode ficar vazio
  poll_id: string;
  option_text: string;
  votes_count: number;
};

export default function PollRegistration() {
  const router = useRouter();

  const emptyPollForm: PollFormData = useMemo(
    () => ({
      title: "",
      description: "",
      type: "binary",
      status: "open",
      allow_multiple: false,
      max_votes_per_user: 1,
      allow_custom_option: false,
      created_at: new Date().toISOString(),
      closes_at: "",
      vote_cooldown_seconds: 10,
      voting_type: "single",
      start_date: new Date().toISOString(),
      end_date: "",
      show_partial_results: true,
      icon_name: "",
      icon_url: "",
    }),
    []
  );

  const [formData, setFormData] = useState<PollFormData>(emptyPollForm);

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [isEditing, setIsEditing] = useState(true);

  // ID da poll criada (necessário para cadastrar opções)
  const [createdPollId, setCreatedPollId] = useState<string>("");

  // Form de opção
  const [optionText, setOptionText] = useState("");
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [optionsError, setOptionsError] = useState("");
  const [optionsSuccess, setOptionsSuccess] = useState(false);

  // Lista local (para exibir embaixo)
  const [createdOptions, setCreatedOptions] = useState<PollOptionRow[]>([]);

  // Dados simulados para carregamento
  const sampleData: PollFormData = {
    title: "Pesquisa Exemplo",
    description: "Descrição da pesquisa exemplo",
    type: "binary",
    status: "open",
    allow_multiple: true,
    max_votes_per_user: 3,
    allow_custom_option: true,
    created_at: "2025-12-14T10:00:00Z",
    closes_at: "2025-12-20T10:00:00Z",
    vote_cooldown_seconds: 15,
    voting_type: "single",
    start_date: "2025-12-15T10:00:00Z",
    end_date: "2025-12-19T10:00:00Z",
    show_partial_results: true,
    icon_name: "icone_exemplo",
    icon_url: "http://exemplo.com/icon.png",
  };

  // Atualiza created_at e start_date com a data atual
  useEffect(() => {
    const currentDate = new Date().toISOString();
    setFormData((prevData) => ({
      ...prevData,
      created_at: currentDate,
      start_date: currentDate,
    }));
  }, []);

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

  // Criar poll
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);
    setCreatedPollId("");
    setCreatedOptions([]);
    setOptionsError("");
    setOptionsSuccess(false);

    try {
      const response = await fetch("/api/admin/create-poll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      // Se sua API retorna JSON com id, vamos ler.
      // Se não retornar, me diga o formato e eu ajusto.
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const msg = data?.message || "Falha ao salvar pesquisa.";
        throw new Error(msg);
      }

      // Esperado: data.id ou data.poll?.id (ajuste se necessário)
      const pollId: string =
        data?.id || data?.poll?.id || data?.data?.id || "";

      if (!pollId) {
        // a poll foi criada mas não recebemos o id
        // (ainda dá para cadastrar opções se você digitar o poll_id manualmente,
        // mas aqui vamos pedir para ajustar API)
        throw new Error(
          "Pesquisa salva, mas não recebi o ID da pesquisa. Ajuste a API para retornar { id }."
        );
      }

      setCreatedPollId(pollId);
      setSuccess(true);
      setIsEditing(false);
    } catch (err: any) {
      setError(err.message || "Erro desconhecido.");
    } finally {
      setLoading(false);
    }
  };

  // Form de opção: cadastrar opção para createdPollId
  const handleCreateOption = async () => {
    setOptionsLoading(true);
    setOptionsError("");
    setOptionsSuccess(false);

    try {
      if (!createdPollId) {
        throw new Error("Crie a pesquisa primeiro para obter o poll_id.");
      }
      const trimmed = optionText.trim();
      if (!trimmed) {
        throw new Error("Digite o texto da opção.");
      }

      const payload = {
        poll_id: createdPollId,
        option_text: trimmed,
        votes_count: 0,
      };

      // Você precisa criar esse endpoint (ou ajustar para o que você já tem):
      // POST /api/admin/create-poll-option
      const response = await fetch("/api/admin/create-poll-option", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const msg = data?.message || "Falha ao salvar opção.";
        throw new Error(msg);
      }

      // Se a API retornar a opção criada, ótimo; se não, a gente usa o payload.
      const created: PollOptionRow = {
        id: data?.id || data?.option?.id,
        poll_id: createdPollId,
        option_text: data?.option_text || data?.option?.option_text || trimmed,
        votes_count: data?.votes_count ?? data?.option?.votes_count ?? 0,
      };

      setCreatedOptions((prev) => [created, ...prev]);
      setOptionText("");
      setOptionsSuccess(true);
    } catch (err: any) {
      setOptionsError(err.message || "Erro desconhecido.");
    } finally {
      setOptionsLoading(false);
    }
  };

  // Validações para os campos
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

    setError("");
    setFormData((prevData) => ({
      ...prevData,
      start_date: e.target.value,
    }));
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const endDate = new Date(e.target.value);
    const createdAt = new Date(formData.created_at);
    const startDate = formData.start_date ? new Date(formData.start_date) : null;

    if (endDate < createdAt) {
      setError("A data de término não pode ser anterior à data de criação.");
      return;
    }

    if (startDate && startDate > endDate) {
      setError("A data de término não pode ser anterior à data de início.");
      return;
    }

    setError("");
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

    setError("");
    setFormData((prevData) => ({
      ...prevData,
      closes_at: e.target.value,
    }));
  };

  const handleClearForm = () => {
    setFormData({
      ...emptyPollForm,
      created_at: new Date().toISOString(),
      start_date: new Date().toISOString(),
    });
    setError("");
    setSuccess(false);
    setIsEditing(true);

    setCreatedPollId("");
    setCreatedOptions([]);
    setOptionText("");
    setOptionsError("");
    setOptionsSuccess(false);
  };

  const handleOpen = () => {
    setFormData(sampleData);
    setIsEditing(true);

    setCreatedPollId("");
    setCreatedOptions([]);
    setOptionText("");
    setOptionsError("");
    setOptionsSuccess(false);
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  // (simulado)
  const handleSave = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setIsEditing(false);
      setSuccess(true);
    }, 1000);
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Cadastro de Pesquisas</h1>

      <div style={styles.topActions}>
        <button
          type="button"
          onClick={() => router.push("/admin/dashboard")}
          style={styles.backButton}
        >
          Voltar ao Dashboard
        </button>
      </div>

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
            disabled={!isEditing || loading}
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
            disabled={!isEditing || loading}
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
              disabled={!isEditing || loading}
            >
              <option value="binary">Binária</option>
              <option value="ranking">Ranking</option>
              <option value="single">Única Escolha</option>
            </select>
          </div>

          <div style={styles.fieldGroup}>
            <label style={styles.label}>Status:</label>
            <select
              name="status"
              value={formData.status}
              onChange={handleInputChange}
              style={styles.select}
              disabled={!isEditing || loading}
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
              disabled={!isEditing || loading}
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
              disabled={!isEditing || loading}
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
              disabled={!isEditing || loading}
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
              disabled={!isEditing || loading}
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
            disabled={!isEditing || loading}
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
              disabled={!isEditing || loading}
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
              disabled={!isEditing || loading}
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
              disabled={!isEditing || loading}
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
              disabled={!isEditing || loading}
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
            disabled={!isEditing || loading}
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
            disabled={!isEditing || loading}
          />
        </div>

        <div style={styles.buttonGroup}>
          <button type="button" onClick={handleOpen} style={styles.button} disabled={loading}>
            Abrir
          </button>

          <button type="button" onClick={handleEdit} style={styles.button} disabled={loading}>
            Alterar
          </button>

          <button type="button" onClick={handleSave} style={styles.button} disabled={!isEditing || loading}>
            {loading ? "Salvando..." : "Salvar (simulado)"}
          </button>

          <button type="submit" style={styles.primaryButton} disabled={!isEditing || loading}>
            {loading ? "Criando..." : "Criar Pesquisa (API)"}
          </button>

          <button type="button" onClick={handleClearForm} style={styles.clearButton} disabled={loading}>
            Limpar Formulário
          </button>
        </div>

        {success && createdPollId && (
          <p style={styles.success}>
            Pesquisa criada com sucesso! <br />
            <strong>poll_id:</strong> {createdPollId}
          </p>
        )}
        {error && <p style={styles.error}>{error}</p>}
      </form>

      {/* Seção de opções */}
      <div style={styles.divider} />

      <h2 style={styles.sectionTitle}>Opções da Pesquisa</h2>
      <p style={styles.sectionHint}>
        Primeiro crie a pesquisa para obter o <strong>poll_id</strong>. Depois cadastre as opções abaixo.
      </p>

      <div style={styles.fieldGroup}>
        <label style={styles.label}>poll_id (automático):</label>
        <input type="text" value={createdPollId || ""} style={styles.input} readOnly />
      </div>

      <div style={styles.inlineOptionForm}>
        <div style={{ ...styles.fieldGroup, flex: 1 }}>
          <label style={styles.label}>Texto da opção:</label>
          <input
            type="text"
            value={optionText}
            onChange={(e) => setOptionText(e.target.value)}
            style={styles.input}
            placeholder="Ex.: Sim, Não, Talvez..."
            disabled={!createdPollId || optionsLoading}
          />
        </div>

        <button
          type="button"
          onClick={handleCreateOption}
          style={styles.primaryButton}
          disabled={!createdPollId || optionsLoading}
        >
          {optionsLoading ? "Adicionando..." : "Adicionar Opção"}
        </button>
      </div>

      {optionsSuccess && <p style={styles.success}>Opção cadastrada com sucesso!</p>}
      {optionsError && <p style={styles.error}>{optionsError}</p>}

      {createdOptions.length > 0 && (
        <div style={styles.optionsTableWrapper}>
          <h3 style={styles.subTitle}>Opções cadastradas nesta sessão</h3>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>poll_id</th>
                <th style={styles.th}>option_text</th>
                <th style={styles.th}>votes_count</th>
              </tr>
            </thead>
            <tbody>
              {createdOptions.map((opt, idx) => (
                <tr key={opt.id || `${opt.poll_id}-${idx}`}>
                  <td style={styles.td}>{opt.poll_id}</td>
                  <td style={styles.td}>{opt.option_text}</td>
                  <td style={styles.td}>{opt.votes_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    maxWidth: "800px",
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
  checkbox: {
    marginRight: "10px",
  },
  buttonGroup: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap" as const,
  },
  button: {
    padding: "10px",
    fontSize: "14px",
    color: "#fff",
    backgroundColor: "#3b82f6",
    border: "none",
    borderRadius: "5px",
    fontWeight: "bold",
    cursor: "pointer",
    transition: "background-color 0.2s",
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
    transition: "background-color 0.2s",
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
    transition: "background-color 0.2s",
  },
  success: {
    color: "green",
    fontSize: "14px",
    textAlign: "center" as const,
    marginTop: "10px",
  },
  error: {
    color: "red",
    fontSize: "14px",
    textAlign: "center" as const,
    marginTop: "10px",
  },
  divider: {
    height: 1,
    backgroundColor: "#e5e7eb",
    margin: "24px 0",
  },
  sectionTitle: {
    fontSize: "18px",
    fontWeight: "bold",
    marginBottom: "6px",
    color: "#111827",
  },
  sectionHint: {
    fontSize: "14px",
    color: "#4b5563",
    marginBottom: "14px",
  },
  inlineOptionForm: {
    display: "flex",
    gap: "10px",
    alignItems: "flex-end",
    flexWrap: "wrap" as const,
  },
  optionsTableWrapper: {
    marginTop: "16px",
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
  table: {
    width: "100%",
    borderCollapse: "collapse" as const,
  },
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

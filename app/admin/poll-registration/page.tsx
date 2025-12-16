"use client";

import { useState } from "react";

export default function PollRegistration() {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    type: "binary",
    status: "draft",
    allow_multiple: false,
    max_votes_per_user: 1,
    allow_custom_option: false,
    custom_option_max_length: 50,
    closes_at: "",
    vote_cooldown_seconds: 10,
    voting_type: "single",
    start_date: "",
    end_date: "",
    show_partial_results: false,
    icon_name: "",
    icon_url: "",
  });

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
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
      const response = await fetch("/api/admin/create-poll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error("Falha ao cadastrar pesquisa.");
      }

      setSuccess(true);
      setFormData({
        title: "",
        description: "",
        type: "binary",
        status: "draft",
        allow_multiple: false,
        max_votes_per_user: 1,
        allow_custom_option: false,
        custom_option_max_length: 50,
        closes_at: "",
        vote_cooldown_seconds: 10,
        voting_type: "single",
        start_date: "",
        end_date: "",
        show_partial_results: false,
        icon_name: "",
        icon_url: "",
      });
    } catch (err: any) {
      setError(err.message || "Erro desconhecido.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Cadastro de Pesquisas</h1>
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
          />
        </div>

        <div style={styles.fieldGroup}>
          <label style={styles.label}>Tipo de Pesquisa:</label>
          <select
            name="type"
            value={formData.type}
            onChange={handleInputChange}
            style={styles.select}
          >
            <option value="binary">Binária</option>
            <option value="ranking">Ranking</option>
            <option value="single">Escolha Única</option>
          </select>
        </div>

        <div style={styles.fieldGroup}>
          <label style={styles.label}>Status:</label>
          <select
            name="status"
            value={formData.status}
            onChange={handleInputChange}
            style={styles.select}
          >
            <option value="draft">Rascunho</option>
            <option value="open">Aberta</option>
            <option value="paused">Pausada</option>
            <option value="closed">Encerrada</option>
          </select>
        </div>

        <div style={styles.fieldGroup}>
          <label style={styles.checkboxLabel}>
            <input
              type="checkbox"
              name="allow_multiple"
              checked={formData.allow_multiple}
              onChange={handleInputChange}
              style={styles.checkbox}
            />
            Permitir múltiplas escolhas
          </label>
        </div>

        <div style={styles.fieldGroup}>
          <label style={styles.label}>Tempo de Espera Entre Votos (segundos):</label>
          <input
            type="number"
            name="vote_cooldown_seconds"
            value={formData.vote_cooldown_seconds}
            onChange={handleInputChange}
            style={styles.input}
          />
        </div>

        <button type="submit" style={styles.button} disabled={loading}>
          {loading ? "Cadastrando..." : "Cadastrar Pesquisa"}
        </button>

        {success && <p style={styles.success}>Pesquisa cadastrada com sucesso!</p>}
        {error && <p style={styles.error}>{error}</p>}
      </form>
    </div>
  );
}

const styles = {
  container: {
    maxWidth: "600px",
    margin: "0 auto",
    padding: "20px",
    fontFamily: "'Segoe UI', sans-serif",
    backgroundColor: "#f9fafb",
    border: "1px solid #ddd",
    borderRadius: "10px",
  },
  title: {
    fontSize: "24px",
    fontWeight: "bold",
    marginBottom: "20px",
    color: "#333",
    textAlign: "center" as const,
  },
  form: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "20px",
  },
  fieldGroup: {
    display: "flex",
    flexDirection: "column" as const,
  },
  label: {
    fontSize: "14px",
    fontWeight: "600",
    marginBottom: "5px",
    color: "#555",
  },
  input: {
    padding: "10px",
    fontSize: "14px",
    border: "1px solid #ddd",
    borderRadius: "5px",
    backgroundColor: "#fff",
  },
  textarea: {
    padding: "10px",
    fontSize: "14px",
    border: "1px solid #ddd",
    borderRadius: "5px",
    backgroundColor: "#fff",
    minHeight: "80px",
  },
  select: {
    padding: "10px",
    fontSize: "14px",
    border: "1px solid #ddd",
    borderRadius: "5px",
    backgroundColor: "#fff",
  },
  checkbox: {
    marginRight: "10px",
  },
  checkboxLabel: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    fontSize: "14px",
    color: "#555",
  },
  button: {
    padding: "10px",
    fontSize: "16px",
    color: "#fff",
    backgroundColor: "#007bff",
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
  },
  error: {
    color: "red",
    fontSize: "14px",
    textAlign: "center" as const,
  },
};

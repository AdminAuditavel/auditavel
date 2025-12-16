"use client";

import { useState } from "react";

export default function PollRegistration() {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    type: "binary",
    status: "open",
    allow_multiple: false,
    max_votes_per_user: 1,
    allow_custom_option: false,
    closes_at: "",
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

      setFormData({
        title: "",
        description: "",
        type: "binary",
        status: "open",
        allow_multiple: false,
        max_votes_per_user: 1,
        allow_custom_option: false,
        closes_at: "",
      });
      setSuccess(true);
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
        <label style={styles.label}>
          Título:
          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleInputChange}
            style={styles.input}
            required
          />
        </label>

        <label style={styles.label}>
          Descrição:
          <textarea
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            style={styles.textarea}
            required
          />
        </label>

        <label style={styles.label}>
          Tipo de Pesquisa:
          <select
            name="type"
            value={formData.type}
            onChange={handleInputChange}
            style={styles.select}
          >
            <option value="binary">Binária</option>
            <option value="ranking">Ranking</option>
            <option value="single">Única Escolha</option>
          </select>
        </label>

        <label style={styles.label}>
          Permitir múltiplas escolhas:
          <input
            type="checkbox"
            name="allow_multiple"
            checked={formData.allow_multiple}
            onChange={handleInputChange}
          />
        </label>

        <label style={styles.label}>
          Máximo de votos por usuário:
          <input
            type="number"
            name="max_votes_per_user"
            value={formData.max_votes_per_user}
            onChange={handleInputChange}
            style={styles.input}
          />
        </label>

        <label style={styles.label}>
          Permitir opções personalizadas:
          <input
            type="checkbox"
            name="allow_custom_option"
            checked={formData.allow_custom_option}
            onChange={handleInputChange}
          />
        </label>

        <label style={styles.label}>
          Data de encerramento:
          <input
            type="datetime-local"
            name="closes_at"
            value={formData.closes_at}
            onChange={handleInputChange}
            style={styles.input}
          />
        </label>

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
    fontFamily: "Arial, sans-serif",
  },
  title: {
    fontSize: "24px",
    marginBottom: "20px",
  },
  form: {
    display: "flex",
    flexDirection: "column" as "column",
    gap: "15px",
  },
  label: {
    fontSize: "16px",
    marginBottom: "5px",
  },
  input: {
    padding: "10px",
    fontSize: "16px",
    border: "1px solid #ccc",
    borderRadius: "5px",
  },
  textarea: {
    padding: "10px",
    fontSize: "16px",
    border: "1px solid #ccc",
    borderRadius: "5px",
  },
  select: {
    padding: "10px",
    fontSize: "16px",
  },
  button: {
    padding: "10px",
    fontSize: "16px",
    backgroundColor: "#0070f3",
    color: "white",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
  },
  success: {
    color: "green",
  },
  error: {
    color: "red",
  },
};

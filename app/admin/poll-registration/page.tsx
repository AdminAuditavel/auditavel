"use client";

import { useState } from "react";

export default function PollRegistration() {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    type: "binary",
    status: "open",
    allow_multiple: false,
    allow_custom_option: false,
    max_votes_per_user: 1,
    vote_cooldown_seconds: 10,
    created_at: new Date().toISOString(),
    closes_at: "",
    voting_type: "single",
    start_date: new Date().toISOString(),
    end_date: "",
    show_partial_results: true,
    icon_name: "",
    icon_url: "",
  });

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox"
        ? (e.target as HTMLInputElement).checked
        : value,
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

      if (!response.ok) throw new Error("Falha ao cadastrar pesquisa.");

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
        {/* Título */}
        <div style={styles.fieldGroup}>
          <label style={styles.label}>Título</label>
          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleInputChange}
            style={styles.input}
            required
          />
        </div>

        {/* Descrição */}
        <div style={styles.fieldGroup}>
          <label style={styles.label}>Descrição</label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            style={styles.textarea}
            required
          />
        </div>

        {/* Tipo + Status */}
        <div style={styles.inlineFieldGroup}>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Tipo de Pesquisa</label>
            <select name="type" value={formData.type} onChange={handleInputChange} style={styles.select}>
              <option value="binary">Binária</option>
              <option value="ranking">Ranking</option>
              <option value="single">Única Escolha</option>
            </select>
          </div>

          <div style={styles.fieldGroup}>
            <label style={styles.label}>Status</label>
            <select name="status" value={formData.status} onChange={handleInputChange} style={styles.select}>
              <option value="open">Aberta</option>
              <option value="paused">Pausada</option>
              <option value="closed">Fechada</option>
            </select>
          </div>
        </div>

        {/* Flags */}
        <div style={styles.inlineFieldGroup}>
          <label style={styles.checkboxLabel}>
            <input
              type="checkbox"
              name="allow_multiple"
              checked={formData.allow_multiple}
              onChange={handleInputChange}
            />
            Permitir múltiplos votos
          </label>

          <label style={styles.checkboxLabel}>
            <input
              type="checkbox"
              name="allow_custom_option"
              checked={formData.allow_custom_option}
              onChange={handleInputChange}
            />
            Permitir opção personalizada
          </label>
        </div>

        {/* Máx votos + cooldown */}
        <div style={styles.inlineFieldGroup}>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Máx. votos por usuário</label>
            <input
              type="number"
              name="max_votes_per_user"
              value={formData.max_votes_per_user}
              onChange={handleInputChange}
              style={styles.input}
            />
          </div>

          <div style={styles.fieldGroup}>
            <label style={styles.label}>Cooldown (segundos)</label>
            <input
              type="number"
              name="vote_cooldown_seconds"
              value={formData.vote_cooldown_seconds}
              onChange={handleInputChange}
              style={styles.input}
            />
          </div>
        </div>

        {/* Datas início + fim */}
        <div style={styles.inlineFieldGroup}>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Data de Início</label>
            <input
              type="datetime-local"
              name="start_date"
              value={formData.start_date}
              onChange={handleInputChange}
              style={styles.input}
            />
          </div>

          <div style={styles.fieldGroup}>
            <label style={styles.label}>Data de Término</label>
            <input
              type="datetime-local"
              name="end_date"
              value={formData.end_date}
              onChange={handleInputChange}
              style={styles.input}
            />
          </div>
        </div>

        {/* Created + closes */}
        <div style={styles.inlineFieldGroup}>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Criado em</label>
            <input
              type="datetime-local"
              name="created_at"
              value={formData.created_at}
              readOnly
              style={styles.input}
            />
          </div>

          <div style={styles.fieldGroup}>
            <label style={styles.label}>Encerramento</label>
            <input
              type="datetime-local"
              name="closes_at"
              value={formData.closes_at}
              onChange={handleInputChange}
              style={styles.input}
            />
          </div>
        </div>

        {/* Resultados parciais */}
        <label style={styles.checkboxLabel}>
          <input
            type="checkbox"
            name="show_partial_results"
            checked={formData.show_partial_results}
            onChange={handleInputChange}
          />
          Mostrar resultados parciais
        </label>

        {/* Ícones */}
        <div style={styles.fieldGroup}>
          <label style={styles.label}>Nome do ícone</label>
          <input
            type="text"
            name="icon_name"
            value={formData.icon_name}
            onChange={handleInputChange}
            style={styles.input}
          />
        </div>

        <div style={styles.fieldGroup}>
          <label style={styles.label}>URL do ícone</label>
          <input
            type="url"
            name="icon_url"
            value={formData.icon_url}
            onChange={handleInputChange}
            style={styles.input}
          />
        </div>

        <button type="submit" style={styles.button} disabled={loading}>
          {loading ? "Cadastrando..." : "Cadastrar Pesquisa"}
        </button>

        {success && <p style={styles.success}>Pesquisa cadastrada com sucesso</p>}
        {error && <p style={styles.error}>{error}</p>}
      </form>
    </div>
  );
}

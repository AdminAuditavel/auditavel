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
    created_at: new Date().toISOString(),
    closes_at: "",
    vote_cooldown_seconds: 10,
    voting_type: "single",
    start_date: new Date().toISOString(),
    end_date: "",
    show_partial_results: true,
    icon_name: "",
    icon_url: "",
  });

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

    try {
      const response = await fetch("/api/admin/create-poll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error("Erro ao enviar os dados.");
      }

      alert("Pesquisa cadastrada com sucesso!");
    } catch (error) {
      alert("Erro ao cadastrar pesquisa.");
    }
  };

  return (
    <form onSubmit={handleFormSubmit}>
      <h2>Cadastrar Pesquisas</h2>
      <label>
        Título
        <input type="text" name="title" value={formData.title} onChange={handleInputChange} />
      </label>
      <br />
      <label>
        Descrição
        <textarea name="description" value={formData.description} onChange={handleInputChange}></textarea>
      </label>
      <br />
      <button type="submit">Cadastrar</button>
    </form>
  );
}

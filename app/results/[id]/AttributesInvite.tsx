"use client";

import { useEffect, useState } from "react";

type Props = {
  participantId: string;
};

export default function AttributesInvite({ participantId }: Props) {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    age_range: "",
    education_level: "",
    region: "",
    income_range: "",
  });

  /* =======================
     VERIFICAR SE JÁ RESPONDEU
  ======================= */
  useEffect(() => {
    async function check() {
      const res = await fetch(
        `/api/participant-attributes/check?participant_id=${participantId}`
      );

      if (res.ok) {
        const json = await res.json();
        if (!json.exists) setVisible(true);
      }
    }

    if (participantId) check();
  }, [participantId]);

  if (!visible) return null;

  /* =======================
     SALVAR
  ======================= */
  async function handleSubmit() {
    setLoading(true);

    await fetch("/api/participant-attributes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        participant_id: participantId,
        ...form,
      }),
    });

    window.location.href = "/"; // Redireciona para o home após salvar
  }

  return (
    <div className="mt-6 rounded-xl border bg-white p-5 shadow-sm space-y-4">
      <h3 className="text-sm font-semibold text-gray-800">
        Ajude a qualificar os resultados
      </h3>

      <p className="text-xs text-gray-600">
        Suas respostas são anônimas e usadas apenas para análise estatística.
      </p>

      {/* FAIXA ETÁRIA */}
      <select
        className="w-full border rounded px-3 py-2 text-sm"
        value={form.age_range}
        onChange={e => setForm(f => ({ ...f, age_range: e.target.value }))}
      >
        <option value="">Faixa etária (opcional)</option>
        <option value="-18">-18</option>
        <option value="18-24">18–24</option>
        <option value="25-34">25–34</option>
        <option value="35-44">35–44</option>
        <option value="45-59">45–59</option>
        <option value="60+">60+</option>
      </select>

      {/* ESCOLARIDADE */}
      <select
        className="w-full border rounded px-3 py-2 text-sm"
        value={form.education_level}
        onChange={e =>
          setForm(f => ({ ...f, education_level: e.target.value }))
        }
      >
        <option value="">Escolaridade (opcional)</option>
        <option value="fundamental">Ensino fundamental</option>
        <option value="medio">Ensino médio</option>
        <option value="superior">Ensino superior</option>
        <option value="pos">Pós-graduação</option>
      </select>

      {/* REGIÃO */}
      <select
        className="w-full border rounded px-3 py-2 text-sm"
        value={form.region}
        onChange={e => setForm(f => ({ ...f, region: e.target.value }))}
      >
        <option value="">Região (opcional)</option>
        <option value="norte">Norte</option>
        <option value="nordeste">Nordeste</option>
        <option value="centro-oeste">Centro-Oeste</option>
        <option value="sudeste">Sudeste</option>
        <option value="sul">Sul</option>
      </select>

      {/* RENDA */}
      <select
        className="w-full border rounded px-3 py-2 text-sm"
        value={form.income_range}
        onChange={e =>
          setForm(f => ({ ...f, income_range: e.target.value }))
        }
      >
        <option value="">Faixa de renda (opcional)</option>
        <option value="ate_2">Até 2 salários mínimos</option>
        <option value="2_5">2 a 5 salários mínimos</option>
        <option value="5_10">5 a 10 salários mínimos</option>
        <option value="10_plus">Acima de 10 salários mínimos</option>
      </select>

      {/* BOTÃO */}
      <button
        onClick={handleSubmit}
        disabled={loading}
        className="w-full rounded-lg bg-emerald-600 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        {loading ? "Salvando…" : "Salvar respostas"}
      </button>
    </div>
  );
}

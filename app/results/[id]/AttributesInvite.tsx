//app/results/[id]/AttributesInvite.tsx

"use client";

import { useEffect, useState } from "react";

type Props = {
  participantId: string;
};

export default function AttributesInvite({ participantId }: Props) {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
     APÓS ENVIO
  ======================= */
  if (submitted) {
    return (
      <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800">
        <h3 className="font-semibold mb-1">
          Obrigado pela sua contribuição
        </h3>
        <p>
          Suas informações foram registradas com sucesso e serão usadas apenas
          para análise estatística, de forma anônima.
        </p>
      </div>
    );
  }

  /* =======================
     SALVAR
  ======================= */
  async function handleSubmit() {
    setError(null);

    // Validação obrigatória
    if (
      !form.age_range ||
      !form.education_level ||
      !form.region ||
      !form.income_range
    ) {
      setError("Por favor, responda todas as perguntas antes de continuar.");
      return;
    }

    setLoading(true);

    const res = await fetch("/api/participant-attributes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        participant_id: participantId,
        ...form,
      }),
    });

    setLoading(false);

    if (res.ok) {
      setSubmitted(true);
    } else {
      setError(
        "Não foi possível salvar suas respostas. Tente novamente."
      );
    }
  }

  /* =======================
     RENDER
  ======================= */
  return (
    <div className="mt-6 rounded-xl border bg-white p-5 shadow-sm space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-gray-800">
          Ajude a qualificar os resultados
        </h3>
        <p className="text-xs text-gray-600">
          Suas respostas são anônimas e usadas apenas para análise estatística.
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-xs text-red-700">
          {error}
        </div>
      )}

      {/* FAIXA ETÁRIA */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-gray-700">
          Faixa etária
        </legend>
        {["-18", "18-24", "25-34", "35-44", "45-59", "60+"].map(v => (
          <label key={v} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="age_range"
              value={v}
              checked={form.age_range === v}
              onChange={() =>
                setForm(f => ({ ...f, age_range: v }))
              }
            />
            {v === "-18" ? "Menor de 18" : v}
          </label>
        ))}
      </fieldset>

      {/* ESCOLARIDADE */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-gray-700">
          Escolaridade
        </legend>
        {[
          ["fundamental", "Ensino fundamental"],
          ["medio", "Ensino médio"],
          ["superior", "Ensino superior"],
          ["pos", "Pós-graduação"],
        ].map(([value, label]) => (
          <label key={value} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="education_level"
              value={value}
              checked={form.education_level === value}
              onChange={() =>
                setForm(f => ({
                  ...f,
                  education_level: value,
                }))
              }
            />
            {label}
          </label>
        ))}
      </fieldset>

      {/* REGIÃO */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-gray-700">
          Região
        </legend>
        {[
          ["norte", "Norte"],
          ["nordeste", "Nordeste"],
          ["centro-oeste", "Centro-Oeste"],
          ["sudeste", "Sudeste"],
          ["sul", "Sul"],
        ].map(([value, label]) => (
          <label key={value} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="region"
              value={value}
              checked={form.region === value}
              onChange={() =>
                setForm(f => ({ ...f, region: value }))
              }
            />
            {label}
          </label>
        ))}
      </fieldset>

      {/* RENDA */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-gray-700">
          Faixa de renda
        </legend>
        {[
          ["ate_2", "Até 2 salários mínimos"],
          ["2_5", "2 a 5 salários mínimos"],
          ["5_10", "5 a 10 salários mínimos"],
          ["10_plus", "Acima de 10 salários mínimos"],
        ].map(([value, label]) => (
          <label key={value} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="income_range"
              value={value}
              checked={form.income_range === value}
              onChange={() =>
                setForm(f => ({
                  ...f,
                  income_range: value,
                }))
              }
            />
            {label}
          </label>
        ))}
      </fieldset>

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

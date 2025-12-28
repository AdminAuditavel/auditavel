//app/results/[id]/AttributesInvite.tsx

"use client";

import { useEffect, useState } from "react";

type Props = {
  participantId: string;
  pollId: string;
  forceShow?: boolean; // NOVO
};

export default function AttributesInvite({
  participantId,
  pollId,
  forceShow = false,
}: Props) {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasPrefill, setHasPrefill] = useState(false);

  const [form, setForm] = useState({
    age_range: "",
    education_level: "",
    region: "",
    income_range: "",
  });

  /* =======================
     VISIBILIDADE
     - forceShow=true: mostra sempre (pós-voto/alteração)
     - caso contrário: mostra somente se ainda não respondeu nesta poll
  ======================= */
  useEffect(() => {
    if (forceShow) {
      setVisible(true);
      return;
    }

    let cancelled = false;

    async function check() {
      setVisible(false); // estado determinístico
      const res = await fetch(
        `/api/participant-attributes/check?participant_id=${encodeURIComponent(
          participantId
        )}&poll_id=${encodeURIComponent(pollId)}`
      );

      if (!res.ok) return;

      const json = await res.json();
      if (cancelled) return;

      if (!json.exists) setVisible(true);
      else setVisible(false);
    }

    if (participantId && pollId) check();

    return () => {
      cancelled = true;
    };
  }, [participantId, pollId, forceShow]);

  /* =======================
     PRÉ-PREENCHIMENTO (PERFIL GLOBAL)
  ======================= */
  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      const res = await fetch(
        `/api/participant-profile?participant_id=${encodeURIComponent(
          participantId
        )}`
      );

      if (!res.ok) return;

      const json = await res.json();
      if (cancelled) return;

      if (json.profile) {
        setForm({
          age_range: json.profile.age_range ?? "",
          education_level: json.profile.education_level ?? "",
          region: json.profile.region ?? "",
          income_range: json.profile.income_range ?? "",
        });
        setHasPrefill(true);
      }
    }

    if (participantId) loadProfile();

    return () => {
      cancelled = true;
    };
  }, [participantId]);

  if (!visible) return null;

  /* =======================
     APÓS ENVIO
  ======================= */
  if (submitted) {
    return (
      <div className="mt-6 rounded-xl border border-border bg-[color:var(--muted)] p-5 text-sm text-[color:var(--primary)]">
        <h3 className="font-semibold mb-1 text-foreground">
          Obrigado pela sua contribuição
        </h3>
        <p className="text-[color:var(--foreground)]">
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
        poll_id: pollId,
        ...form,
      }),
    });

    setLoading(false);

    if (res.ok) {
      setSubmitted(true);
    } else {
      setError("Não foi possível salvar suas respostas. Tente novamente.");
    }
  }

  /* =======================
     RENDER
  ======================= */
  return (
    <div className="mt-6 rounded-xl border border-border bg-surface p-5 shadow-sm space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-[color:var(--foreground)]">
          Ajude a qualificar os resultados
        </h3>
        <p className="text-xs text-[color:var(--foreground-muted)]">
          Suas respostas são anônimas e usadas apenas para análise estatística.
        </p>
      </div>

      {hasPrefill && (
        <div className="rounded-md border border-border bg-[color:var(--muted)] p-3 text-xs text-[color:var(--primary)]">
          Algumas informações estatísticas já foram usadas anteriormente. Você
          pode confirmar ou alterar antes de enviar.
        </div>
      )}

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-xs text-red-700">
          {error}
        </div>
      )}

      {/* FAIXA ETÁRIA */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-[color:var(--foreground)]">
          Faixa etária
        </legend>
        {["-18", "18-24", "25-34", "35-44", "45-59", "60+"].map((v) => (
          <label
            key={v}
            className="flex items-center gap-2 text-sm text-[color:var(--foreground)]"
          >
            <input
              type="radio"
              name="age_range"
              value={v}
              checked={form.age_range === v}
              onChange={() => setForm((f) => ({ ...f, age_range: v }))}
            />
            {v === "-18" ? "Menor de 18" : v}
          </label>
        ))}
      </fieldset>

      {/* ESCOLARIDADE */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-[color:var(--foreground)]">
          Escolaridade
        </legend>
        {[
          ["fundamental", "Ensino fundamental"],
          ["medio", "Ensino médio"],
          ["superior", "Ensino superior"],
          ["pos", "Pós-graduação"],
        ].map(([value, label]) => (
          <label
            key={value}
            className="flex items-center gap-2 text-sm text-[color:var(--foreground)]"
          >
            <input
              type="radio"
              name="education_level"
              value={value}
              checked={form.education_level === value}
              onChange={() =>
                setForm((f) => ({ ...f, education_level: value }))
              }
            />
            {label}
          </label>
        ))}
      </fieldset>

      {/* REGIÃO */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-[color:var(--foreground)]">
          Região
        </legend>
        {[
          ["norte", "Norte"],
          ["nordeste", "Nordeste"],
          ["centro-oeste", "Centro-Oeste"],
          ["sudeste", "Sudeste"],
          ["sul", "Sul"],
        ].map(([value, label]) => (
          <label
            key={value}
            className="flex items-center gap-2 text-sm text-[color:var(--foreground)]"
          >
            <input
              type="radio"
              name="region"
              value={value}
              checked={form.region === value}
              onChange={() => setForm((f) => ({ ...f, region: value }))}
            />
            {label}
          </label>
        ))}
      </fieldset>

      {/* RENDA */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-[color:var(--foreground)]">
          Faixa de renda
        </legend>
        {[
          ["ate_2", "Até 2 salários mínimos"],
          ["2_5", "2 a 5 salários mínimos"],
          ["5_10", "5 a 10 salários mínimos"],
          ["10_plus", "Acima de 10 salários mínimos"],
        ].map(([value, label]) => (
          <label
            key={value}
            className="flex items-center gap-2 text-sm text-[color:var(--foreground)]"
          >
            <input
              type="radio"
              name="income_range"
              value={value}
              checked={form.income_range === value}
              onChange={() => setForm((f) => ({ ...f, income_range: value }))}
            />
            {label}
          </label>
        ))}
      </fieldset>

      <button
        onClick={handleSubmit}
        disabled={loading}
        className="w-full rounded-lg bg-[color:var(--primary)] py-2 text-sm font-medium text-[color:var(--on-primary)] hover:brightness-95 disabled:opacity-60"
      >
        {loading ? "Salvando…" : "Salvar respostas"}
      </button>
    </div>
  );
}

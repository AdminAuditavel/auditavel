'use server';
import React from 'react';
import type { Metadata } from 'next';
import { supabase } from '@/lib/supabase';

interface Poll {
  id: string;
  title: string;
  voting_type: string;
  allow_multiple?: boolean;
}

interface PollOptionRow {
  id: string;
  option_text: string;
  created_at?: string;
}

interface Option {
  id: string;
  text: string;
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const pollId = params.id;
  try {
    const { data: poll } = await supabase
      .from('polls')
      .select('title')
      .eq('id', pollId)
      .single();

    return {
      title: poll?.title ?? 'Poll',
      description: `Vote on poll ${pollId}`,
    };
  } catch {
    return {
      title: 'Poll',
      description: `Vote on poll ${pollId}`,
    };
  }
}

export default async function PollPage({ params }: { params: { id: string } }) {
  const pollId = params.id;

  // Buscar poll
  const { data: pollData, error: pollErr } = await supabase
    .from('polls')
    .select('*')
    .eq('id', pollId)
    .single();

  if (pollErr || !pollData) {
    return (
      <main className="p-6 max-w-xl mx-auto">
        <p>Enquete não encontrada.</p>
      </main>
    );
  }

  // Buscar opções do poll no servidor
  const { data: optionsData } = await supabase
    .from('poll_options')
    .select('id, option_text, created_at')
    .eq('poll_id', pollId)
    .order('created_at', { ascending: true });

  const options: Option[] = (optionsData as PollOptionRow[] | null)
    ? (optionsData as PollOptionRow[]).map((row) => ({
        id: row.id,
        text: row.option_text,
      }))
    : [];

  const poll = pollData as Poll;

  // Render server-side HTML + minimal client JS to manipulate the DOM and submit vote
  return (
    <main className="p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">{poll.title}</h1>

      {poll.voting_type === 'ranking' ? (
        <>
          <p className="mb-3 text-sm text-gray-600">Use os botões ▲/▼ para ordenar as opções e depois clique em "Submeter Classificação".</p>

          <div id="ranking-container">
            <div id="options-list" className="space-y-3" aria-label="Ranking de opções">
              {options.map((o, idx) => (
                <div
                  key={o.id}
                  data-option-id={o.id}
                  className="flex items-center gap-3 p-3 border rounded-lg bg-white"
                  style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                >
                  <span style={{ width: 28, textAlign: 'center', fontWeight: 600 }}>{idx + 1}</span>
                  <div style={{ flex: 1 }}>{o.text}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <button type="button" data-action="up" aria-label={`Mover ${o.text} para cima`} className="px-2 py-1 bg-gray-100 border rounded">
                      ▲
                    </button>
                    <button type="button" data-action="down" aria-label={`Mover ${o.text} para baixo`} className="px-2 py-1 bg-gray-100 border rounded">
                      ▼
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 16 }}>
              <button id="submit-vote" className="mt-4 px-4 py-2 bg-blue-600 text-white rounded">Submeter Classificação</button>
            </div>
          </div>

          {/* Inline script: minimal vanilla JS para mover itens e submeter voto */}
          <script
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{
              __html: `
(function(){
  const pollId = ${JSON.stringify(pollId)};
  const list = document.getElementById('options-list');
  if (!list) return;

  // Atualiza os números à esquerda (1,2,3)
  function refreshIndexes() {
    Array.from(list.children).forEach((el, i) => {
      const idxSpan = el.querySelector('span');
      if (idxSpan) idxSpan.textContent = String(i + 1);
    });
  }

  // Delegated click handler para os botões up/down
  list.addEventListener('click', function(e) {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const action = btn.getAttribute('data-action');
    const item = btn.closest('[data-option-id]');
    if (!item) return;

    if (action === 'up') {
      const prev = item.previousElementSibling;
      if (prev) list.insertBefore(item, prev);
    } else if (action === 'down') {
      const next = item.nextElementSibling;
      if (next) list.insertBefore(next, item.nextElementSibling?.nextElementSibling || null);
    }
    refreshIndexes();
  });

  // Gera/pega user_hash do localStorage
  function getUserHash() {
    try {
      let h = localStorage.getItem('user_hash');
      if (!h) {
        if (window.crypto && 'randomUUID' in window.crypto) {
          h = window.crypto.randomUUID();
        } else {
          h = 'uid_' + Math.random().toString(36).slice(2,10);
        }
        localStorage.setItem('user_hash', h);
      }
      return h;
    } catch (err) {
      return '';
    }
  }

  // Serializa ordem atual
  function getOrder() {
    return Array.from(list.querySelectorAll('[data-option-id]')).map(el => el.getAttribute('data-option-id'));
  }

  // Submeter via fetch para /api/vote (mesma API que usam)
  const submitBtn = document.getElementById('submit-vote');
  if (submitBtn) {
    submitBtn.addEventListener('click', async function(e) {
      e.preventDefault();
      const optionIds = getOrder();
      const user_hash = getUserHash();
      if (!user_hash) {
        alert('Não foi possível identificar o usuário. Tente novamente.');
        return;
      }

      const payload = {
        poll_id: pollId,
        option_ids: optionIds,
        user_hash: user_hash
      };

      submitBtn.disabled = true;
      submitBtn.textContent = 'Enviando...';

      try {
        const res = await fetch('/api/vote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          alert('Voto registrado com sucesso!');
          // opcional: recarregar para ver resultados / bloquear novo voto
          window.location.reload();
        } else {
          const data = await res.json().catch(()=>null);
          alert(data?.error ? ('Erro: ' + data.error) : 'Erro ao registrar voto.');
        }
      } catch (err) {
        console.error(err);
        alert('Erro ao registrar voto.');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submeter Classificação';
      }
    });
  }

  // Ajudinha: permitir mover via teclado quando um item tiver foco
  list.addEventListener('keydown', function(e) {
    const el = document.activeElement;
    if (!el || !el.closest) return;
    const item = el.closest('[data-option-id]');
    if (!item) return;
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = item.previousElementSibling;
      if (prev) list.insertBefore(item, prev);
      refreshIndexes();
      item.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = item.nextElementSibling;
      if (next) list.insertBefore(next, item.nextElementSibling?.nextElementSibling || null);
      refreshIndexes();
      item.focus();
    }
  });

  // Tornar cada item focável para suporte a teclado
  Array.from(list.querySelectorAll('[data-option-id]')).forEach(el => {
    el.setAttribute('tabindex', '0');
  });

  // inicializa índices
  refreshIndexes();
})();
`,
            }}
          />
        </>
      ) : (
        // voting_type !== 'ranking', fallback para single/multiple
        <div className="space-y-3">
          {options.map((o) => (
            <form key={o.id} action="/api/vote" method="post">
              {/* Este é um fallback simples: cada botão submete um voto único */}
              <input type="hidden" name="poll_id" value={pollId} />
              <input type="hidden" name="option_ids[]" value={o.id} />
              <button className="block w-full p-3 border rounded-lg hover:bg-gray-100">{o.text}</button>
            </form>
          ))}
        </div>
      )}
    </main>
  );
}

//app/admin/PollForm.tsx

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { uploadImageToStorage } from "@/lib/uploadImage"; // Função de upload da imagem

function PollForm() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [votingType, setVotingType] = useState("single");
  const [status, setStatus] = useState("draft");
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [maxVotes, setMaxVotes] = useState("");
  const [iconFile, setIconFile] = useState<File | null>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setIconFile(e.target.files[0]); // Armazenar o arquivo de imagem
    }
  };

  // Função para lidar com o envio do formulário
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Se houver uma imagem, faz o upload
    let iconUrl = "";
    if (iconFile) {
      iconUrl = await uploadImageToStorage(iconFile); // Chama a função de upload
    }

    // Salvar os dados da pesquisa no banco de dados
    const { data, error } = await supabase.from("polls").insert([
      {
        title,
        description,
        start_date: startDate,
        end_date: endDate,
        voting_type: votingType,
        status,
        allow_multiple: allowMultiple,
        max_votes_per_user: maxVotes || null,
        icon_url: iconUrl, // Salva a URL da imagem no banco de dados
      },
    ]);

    if (error) {
      console.error("Erro ao salvar a pesquisa:", error.message);
    } else {
      console.log("Pesquisa salva com sucesso:", data);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block">Título da Pesquisa</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded"
          required
        />
      </div>

      <div>
        <label className="block">Descrição da Pesquisa</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded"
        />
      </div>

      <div>
        <label className="block">Data de Início</label>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded"
        />
      </div>

      <div>
        <label className="block">Data de Término</label>
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded"
        />
      </div>

      <div>
        <label className="block">Tipo de Votação</label>
        <select
          value={votingType}
          onChange={(e) => setVotingType(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded"
        >
          <option value="single">Voto Único</option>
          <option value="ranking">Ranking</option>
        </select>
      </div>

      <div>
        <label className="block">Status da Pesquisa</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded"
        >
          <option value="draft">Rascunho</option>
          <option value="open">Aberta</option>
          <option value="paused">Pausada</option>
          <option value="closed">Encerrada</option>
        </select>
      </div>

      <div>
        <label className="block">Permitir múltiplos votos?</label>
        <input
          type="checkbox"
          checked={allowMultiple}
          onChange={(e) => setAllowMultiple(e.target.checked)}
          className="p-2"
        />
      </div>

      <div>
        <label className="block">Máximo de votos por usuário</label>
        <input
          type="number"
          value={maxVotes}
          onChange={(e) => setMaxVotes(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded"
        />
      </div>

      <div>
        <label className="block">Carregar uma Imagem</label>
        <input
          type="file"
          onChange={handleImageChange} // Lida com a escolha do arquivo
        />
      </div>

      <button type="submit" className="w-full p-2 bg-blue-600 text-white rounded">
        Cadastrar Pesquisa
      </button>
    </form>
  );
}

export default PollForm;

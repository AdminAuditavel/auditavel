"use client";

import { useState } from "react";
import PollRegistration from "./poll-registration/page"; // Importa o formulário de Cadastrar Pesquisas
// Importe outros conteúdos no futuro, como opções e gerenciamento

export default function Dashboard() {
  const [activePage, setActivePage] = useState("home"); // Gerenciar a página ativa (ex.: "home", "poll-registration")

  // Função para renderizar o conteúdo dinamicamente com base na página ativa
  const renderContent = () => {
    switch (activePage) {
      case "poll-registration":
        return <PollRegistration />; // Renderiza o formulário de Cadastrar Pesquisas
      case "options-management":
        return <p>Gerenciar Opções - Conteúdo em Construção</p>;
      case "audit-logs":
        return <p>Logs de Auditoria - Conteúdo em Construção</p>;
      default:
        return <p>Bem-vindo! Escolha uma das opções no menu.</p>;
    }
  };

  return (
    <div style={styles.wrapper}>
      {/* Menu Lateral */}
      <aside style={styles.sidebar}>
        <h2 style={styles.sidebarTitle}>Menu</h2>
        <nav style={styles.nav}>
          <button
            onClick={() => setActivePage("poll-registration")} // Define que "Cadastrar Pesquisas" será mostrado
            style={{
              ...styles.navLink,
              backgroundColor: activePage === "poll-registration" ? "#005bb5" : "transparent",
            }}
          >
            Cadastrar Pesquisas
          </button>
          <button
            onClick={() => setActivePage("options-management")}
            style={{
              ...styles.navLink,
              backgroundColor: activePage === "options-management" ? "#005bb5" : "transparent",
            }}
          >
            Gerenciar Opções
          </button>
          <button
            onClick={() => setActivePage("audit-logs")}
            style={{
              ...styles.navLink,
              backgroundColor: activePage === "audit-logs" ? "#005bb5" : "transparent",
            }}
          >
            Logs de Auditoria
          </button>
        </nav>
      </aside>

      {/* Conteúdo Dinâmico */}
      <main style={styles.main}>
        {renderContent()} {/* Renderiza o conteúdo com base na página ativa */}
      </main>
    </div>
  );
}

const styles = {
  wrapper: {
    display: "flex",
    height: "100vh",
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  },
  sidebar: {
    width: "250px",
    backgroundColor: "#0070f3",
    color: "#fff",
    display: "flex",
    flexDirection: "column" as const,
    padding: "20px",
    boxShadow: "2px 0 5px rgba(0, 0, 0, 0.1)",
  },
  sidebarTitle: {
    fontSize: "18px",
    fontWeight: "bold",
    marginBottom: "20px",
  },
  nav: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "10px",
  },
  navLink: {
    textDecoration: "none",
    color: "#fff",
    fontSize: "16px",
    padding: "10px 15px",
    borderRadius: "5px",
    transition: "background-color 0.3s",
    backgroundColor: "transparent",
    cursor: "pointer",
    border: "none",
  },
  main: {
    flex: "1",
    padding: "40px",
    backgroundColor: "#f5f5f5",
    color: "#333",
    overflowY: "auto" as const,
  },
};

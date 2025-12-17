"use client";

import { useState } from "react";
import PollRegistration from "@/components/PollRegistration"; // Caminho correto para o formulário
// Adicione outros futuros componentes, como Gerenciar Opções e Logs

export default function Dashboard() {
  const [activePage, setActivePage] = useState("home"); // Gerenciar qual página está ativa

  // Renderiza o conteúdo dinâmico com base na página ativa
  const renderContent = () => {
    switch (activePage) {
      case "poll-registration":
        return <PollRegistration />; // Carrega o formulário
      case "options-management":
        return <p>Gerenciar Opções - Conteúdo em Construção</p>;
      case "audit-logs":
        return <p>Logs de Auditoria - Conteúdo em Construção</p>;
      default:
        return <p>Bem-vindo! Escolha uma opção no menu.</p>;
    }
  };

  return (
    <div style={styles.dashboard}>
      {/* Menu Lateral */}
      <aside style={styles.sidebar}>
        <h2 style={styles.sidebarTitle}>Menu</h2>
        <nav style={styles.nav}>
          <button
            onClick={() => setActivePage("poll-registration")}
            style={{
              ...styles.navButton,
              backgroundColor: activePage === "poll-registration" ? "#005bb5" : "transparent",
            }}
          >
            Cadastrar Pesquisas
          </button>
          <button
            onClick={() => setActivePage("options-management")}
            style={{
              ...styles.navButton,
              backgroundColor: activePage === "options-management" ? "#005bb5" : "transparent",
            }}
          >
            Gerenciar Opções
          </button>
          <button
            onClick={() => setActivePage("audit-logs")}
            style={{
              ...styles.navButton,
              backgroundColor: activePage === "audit-logs" ? "#005bb5" : "transparent",
            }}
          >
            Logs de Auditoria
          </button>
        </nav>
      </aside>

      {/* Conteúdo Dinâmico */}
      <main style={styles.main}>{renderContent()}</main>
    </div>
  );
}

const styles = {
  dashboard: {
    display: "flex",
    height: "100vh",
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  },
  sidebar: {
    width: "250px",
    backgroundColor: "#0070f3",
    color: "#fff",
    padding: "20px",
    display: "flex",
    flexDirection: "column" as const,
    boxShadow: "2px 0 5px rgba(0,0,0,0.1)",
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
  navButton: {
    background: "transparent",
    color: "#fff",
    border: "none",
    textAlign: "left" as const,
    fontSize: "16px",
    padding: "10px",
    borderRadius: "5px",
    cursor: "pointer",
    transition: "background-color 0.3s",
  },
  main: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    padding: "20px",
    overflowY: "auto" as const,
  },
};

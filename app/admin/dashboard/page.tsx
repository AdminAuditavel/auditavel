"use client";

import Link from "next/link";

export default function Dashboard() {
  return (
    <div style={styles.wrapper}>
      {/* Menu Lateral */}
      <aside style={styles.sidebar}>
        <h2 style={styles.sidebarTitle}>AUDITÁVEL</h2>

        <nav style={styles.nav}>
          <Link href="/admin/poll-registration" style={styles.navLink}>
            Cadastrar Pesquisas
          </Link>

          <Link href="/admin/options-management" style={styles.navLink}>
            Gerenciar Opções
          </Link>

          <Link href="/admin/audit-logs" style={styles.navLink}>
            Logs de Auditoria
          </Link>
        </nav>
      </aside>

      {/* Conteúdo de Boas-vindas */}
      <main style={styles.main}>
        <h1 style={styles.title}>Painel Administrativo</h1>
        <p style={styles.description}>
          Bem-vindo ao painel administrativo da plataforma Auditável. Use o menu ao lado para acessar as funcionalidades disponíveis.
        </p>
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
    backgroundColor: "#7fbf90", // Verde claro para o menu lateral
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
    color: "#ebf5ee", // Um tom mais claro para destacar
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
    transition: "background-color 0.3s, color 0.3s",
    backgroundColor: "transparent",
    display: "block",
  },
  navLinkHover: {
    backgroundColor: "#659f74", // (não usado com inline styles; para hover de verdade use CSS)
  },
  main: {
    flex: "1",
    backgroundColor: "#f3f6f4", // Cinza muito claro para o fundo do conteúdo principal
    padding: "40px",
    overflowY: "auto" as const,
  },
  title: {
    fontSize: "2rem",
    marginBottom: "1rem",
    color: "#5d705d", // Verde escuro para destacar o título
  },
  description: {
    fontSize: "1rem",
    lineHeight: "1.5",
    color: "#7b8c7b", // Cinza suave para o texto descritivo
  },
};

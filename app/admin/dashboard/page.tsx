"use client";

export default function Dashboard() {
  return (
    <div style={styles.wrapper}>
      <aside style={styles.sidebar}>
        <h2 style={styles.sidebarTitle}>Menu</h2>
        <nav style={styles.nav}>
          <a href="/admin/poll-registration" style={styles.navLink}>Cadastrar Pesquisas</a>
          <a href="/admin/poll-registration" style={styles.navLink}>Cadastrar Opções</a>
          <a href="/admin/options-management" style={styles.navLink}>Gerenciar Opções</a>
          <a href="/admin/audit-logs" style={styles.navLink}>Logs de Auditoria</a>
        </nav>
      </aside>
      <main style={styles.main}>
        <h1 style={styles.title}>Painel Administrativo</h1>
        <p style={styles.description}>Bem-vindo ao painel administrativo da plataforma Auditável. Use o menu ao lado para acessar as funcionalidades disponíveis.</p>
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
  },
  navLinkHover: {
    backgroundColor: "#005bb5",
  },
  main: {
    flex: "1",
    padding: "40px",
    backgroundColor: "#f5f5f5",
    color: "#333",
    overflowY: "auto" as const,
  },
  title: {
    fontSize: "2rem",
    marginBottom: "1rem",
  },
  description: {
    fontSize: "1rem",
    lineHeight: "1.5",
    color: "#666",
  },
};

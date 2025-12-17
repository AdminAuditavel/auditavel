"use client";

export default function Dashboard() {
  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Painel Administrativo - Auditável</h1>
      <div style={styles.menu}>
        <a href="/admin/poll-registration" style={styles.link}>Cadastrar Pesquisas</a>
        <a href="/admin/options-management" style={styles.link}>Gerenciar Opções</a>
        <a href="/admin/audit-logs" style={styles.link}>Logs de Auditoria</a>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    flexDirection: "column" as "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    backgroundColor: "#f5f5f5",
    color: "#333",
  },
  title: {
    fontSize: "2rem",
    marginBottom: "2rem",
  },
  menu: {
    display: "flex",
    flexDirection: "column" as "column",
    gap: "1rem",
  },
  link: {
    padding: "10px 20px",
    textDecoration: "none",
    color: "#fff",
    backgroundColor: "#0070f3",
    borderRadius: "5px",
    textAlign: "center" as "center",
    minWidth: "200px",
  },
};

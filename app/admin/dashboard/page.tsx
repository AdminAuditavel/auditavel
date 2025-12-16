"use client";

const functionalities = [
  {
    name: "Cadastro de Pesquisas",
    description: "Crie, edite e gerencie suas pesquisas.",
    link: "/admin/poll-registration",
  },
  {
    name: "Gerenciar Opções",
    description: "Adicione ou remova opções para suas pesquisas.",
    link: "/admin/options-management",
  },
  {
    name: "Auditoria",
    description: "Veja os logs de auditoria e histórico.",
    link: "/admin/audit-logs",
  },
];

export default function Dashboard() {
  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Painel Administrativo - Auditável</h1>
        <p style={styles.description}>
          Bem-vindo ao painel administrativo! Explore as funcionalidades abaixo para gerenciar seu sistema.
        </p>
      </header>

      <section style={styles.grid}>
        {functionalities.map((func, idx) => (
          <a key={idx} href={func.link} style={styles.card}>
            <h2 style={styles.cardTitle}>{func.name}</h2>
            <p style={styles.cardDescription}>{func.description}</p>
          </a>
        ))}
      </section>
    </div>
  );
}

const styles = {
  container: {
    padding: "20px",
    fontFamily: "Arial, sans-serif",
    backgroundColor: "#f8fafc",
    minHeight: "100vh",
    color: "#333",
    display: "flex",
    flexDirection: "column",
  },
  header: {
    marginBottom: "20px",
    textAlign: "center" as "center",
  },
  title: {
    fontSize: "2.5rem",
    fontWeight: "bold",
    marginBottom: "10px",
    color: "#2c3e50",
  },
  description: {
    fontSize: "1.2rem",
    color: "#7f8c8d",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "20px",
    marginTop: "20px",
  },
  card: {
    textDecoration: "none",
    padding: "20px",
    backgroundColor: "#ffffff",
    border: "1px solid #ddd",
    borderRadius: "8px",
    boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
    display: "flex",
    flexDirection: "column" as "column",
    alignItems: "center" as "center",
    transition: "transform 0.2s, box-shadow 0.2s",
    cursor: "pointer",
  },
  cardTitle: {
    fontSize: "1.5rem",
    marginBottom: "10px",
    color: "#34495e",
  },
  cardDescription: {
    fontSize: "1rem",
    color: "#7f8c8d",
    textAlign: "center" as "center",
  },
  cardHover: {
    transform: "scale(1.05)",
    boxShadow: "0 6px 8px rgba(0, 0, 0, 0.2)",
  },
};

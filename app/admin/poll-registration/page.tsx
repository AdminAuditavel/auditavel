const baseInputStyle = {
  padding: "10px",
  fontSize: "14px",
  border: "1px solid #d1d5db",
  borderRadius: "5px",
  backgroundColor: "#fff",
};

const styles = {
  container: {
    maxWidth: "600px",
    margin: "0 auto",
    padding: "20px",
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    backgroundColor: "#f9fafb",
    border: "1px solid #e5e7eb",
    borderRadius: "10px",
    boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
  },
  title: {
    fontSize: "24px",
    fontWeight: "bold",
    marginBottom: "10px",
    textAlign: "center" as const,
    color: "#1f2937",
  },
  description: {
    fontSize: "16px",
    marginBottom: "20px",
    textAlign: "center" as const,
    color: "#4b5563",
  },
  form: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "20px",
  },
  fieldGroup: {
    display: "flex",
    flexDirection: "column" as const,
  },
  inlineFieldGroup: {
    display: "flex",
    gap: "20px",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: {
    fontSize: "14px",
    fontWeight: "bold",
    color: "#374151",
    marginBottom: "5px",
  },
  checkboxLabel: {
    fontSize: "14px",
    color: "#374151",
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  input: {
    ...baseInputStyle, // Reaproveita o estilo base para inputs
  },
  textarea: {
    ...baseInputStyle, // Reaproveita o estilo base para textareas
    minHeight: "80px",
    resize: "none" as const,
  },
  select: {
    ...baseInputStyle, // Reaproveita o estilo base para selects
  },
  checkbox: {
    marginRight: "10px",
  },
  button: {
    padding: "10px",
    fontSize: "16px",
    color: "#fff",
    backgroundColor: "#3b82f6",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
    fontWeight: "bold",
    transition: "background-color 0.2s",
  },
  success: {
    color: "green",
    fontSize: "14px",
    textAlign: "center" as const,
  },
  error: {
    color: "red",
    fontSize: "14px",
    textAlign: "center" as const,
  },
};

import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error("Render Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 32, color: "#ef4444", fontFamily: "monospace", background: "#111", minHeight: "100vh" }}>
          <h1>渲染错误</h1>
          <pre style={{ whiteSpace: "pre-wrap" }}>{this.state.error?.toString()}</pre>
          <details>
            <summary>组件堆栈</summary>
            <pre style={{ whiteSpace: "pre-wrap" }}>{this.state.errorInfo?.componentStack}</pre>
          </details>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);

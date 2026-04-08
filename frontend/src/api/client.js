const API_BASE =
  import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

async function parseError(res) {
  const contentType = res.headers.get("content-type") || "";

  try {
    if (contentType.includes("application/json")) {
      const data = await res.json();
      return (
        data?.detail ||
        data?.message ||
        data?.error ||
        `HTTP ${res.status}`
      );
    }

    const text = await res.text();
    return text || `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

async function handle(res) {
  const contentType = res.headers.get("content-type") || "";

  if (!res.ok) {
    const message = await parseError(res);
    throw new Error(message);
  }

  if (contentType.includes("application/json")) {
    return res.json();
  }

  if (
    contentType.includes(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ) ||
    contentType.includes("application/octet-stream") ||
    contentType.includes("application/json")
  ) {
    return res;
  }

  if (contentType.includes("text/")) {
    return res.text();
  }

  return res;
}

export async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "GET",
  });
  return handle(res);
}

export async function apiPost(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body || {}),
  });
  return handle(res);
}

export async function apiUpload(path, file, extraFields = {}) {
  const form = new FormData();
  form.append("file", file);

  Object.entries(extraFields).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      form.append(key, value);
    }
  });

  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    body: form,
  });

  return handle(res);
}

export async function apiDelete(path) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "DELETE",
  });
  return handle(res);
}

export async function apiPut(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body || {}),
  });
  return handle(res);
}

export function fileUrl(path) {
  return `${API_BASE}${path}`;
}

export { API_BASE };